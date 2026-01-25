"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, CreditCard, Calendar, Bell, Pencil, Trash2 } from "lucide-react"
import { withProtection } from "@/lib/with-protection"
import { AddSubscriptionDialog } from "@/components/add-subscription-dialog"
import { apiClient } from "@/lib/api-client"
import { useOrganizationScope } from "@/hooks/use-organization-scope"
import { useCurrency } from "@/hooks/use-currency"
import { calculateNextBillingDate } from "@/lib/date-utils"

// Subscription type matching the API response
interface Subscription {
    id: string
    title: string
    description: string | null
    startDate: string
    billingCycle: "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY"
    amount: string
    currency: string
    categoryId: string | null
    accountId: string | null
    notifyDaysBefore: number | null
    reminderEnabled: boolean
    status: "ACTIVE" | "CANCELLED" | "PAUSED" | "EXPIRED"
    createdAt: string
    updatedAt: string
}

// Extended type with calculated/joined data
interface SubscriptionWithDetails extends Subscription {
    categoryName?: string | null
    categoryColor?: string | null
    accountName?: string | null
}

function SubscriptionsTrackingPage() {
    const { organizationId } = useOrganizationScope()
    const { formatAmount, baseCurrency } = useCurrency()
    const queryClient = useQueryClient()
    const [subscriptionToEdit, setSubscriptionToEdit] = useState<Subscription | null>(null)
    const [editDialogOpen, setEditDialogOpen] = useState(false)

    // Fetch subscriptions
    const { data: subscriptions = [], isLoading } = useQuery<Subscription[]>({
        queryKey: ["subscriptions", organizationId],
        queryFn: async () => {
            const res = await apiClient.get("/subscriptions")
            return res.data
        },
    })

    // Fetch categories for display
    const { data: categories = [] } = useQuery({
        queryKey: ["categories", organizationId],
        queryFn: async () => {
            const res = await apiClient.get("/categories")
            return res.data
        },
    })

    // Fetch accounts for display
    const { data: accounts = [] } = useQuery({
        queryKey: ["accounts", organizationId],
        queryFn: async () => {
            const res = await apiClient.get("/accounts")
            return res.data
        },
    })

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await apiClient.delete(`/subscriptions/${id}`)
            return res.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["subscriptions"] })
            toast.success("Subscription deleted successfully")
        },
        onError: (error: any) => {
            toast.error(error.message || "Failed to delete subscription")
        },
    })

    const handleEdit = (subscription: Subscription) => {
        setSubscriptionToEdit(subscription)
        setEditDialogOpen(true)
    }

    const handleDelete = (id: string) => {
        if (confirm("Are you sure you want to delete this subscription?")) {
            deleteMutation.mutate(id)
        }
    }

    // Enrich subscriptions with category and account info
    const subscriptionsWithDetails: SubscriptionWithDetails[] = subscriptions.map(sub => {
        const category = categories.find((c: any) => c.id === sub.categoryId)
        const account = accounts.find((a: any) => a.id === sub.accountId)
        return {
            ...sub,
            categoryName: category?.name || null,
            categoryColor: category?.color || null,
            accountName: account?.name || null,
        }
    })

    // Filter only active subscriptions for stats
    const activeSubscriptions = subscriptionsWithDetails.filter(sub => sub.status === "ACTIVE")

    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        })
    }

    const getBillingCycleText = (cycle: string) => {
        const cycleMap: Record<string, string> = {
            DAILY: "Daily",
            WEEKLY: "Weekly",
            MONTHLY: "Monthly",
            QUARTERLY: "Quarterly",
            YEARLY: "Yearly",
        }
        return cycleMap[cycle] || cycle
    }

    const calculateTotalMonthly = () => {
        return activeSubscriptions.reduce((total, sub) => {
            const amount = parseFloat(sub.amount)
            const multiplier = {
                DAILY: 30,
                WEEKLY: 4.33,
                MONTHLY: 1,
                QUARTERLY: 0.33,
                YEARLY: 0.083,
            }[sub.billingCycle] || 1
            return total + (amount * multiplier)
        }, 0)
    }

    const calculateTotalYearly = () => {
        return activeSubscriptions.reduce((total, sub) => {
            const amount = parseFloat(sub.amount)
            const multiplier = {
                DAILY: 365,
                WEEKLY: 52,
                MONTHLY: 12,
                QUARTERLY: 4,
                YEARLY: 1,
            }[sub.billingCycle] || 1
            return total + (amount * multiplier)
        }, 0)
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Subscription Tracking</h1>
                    <p className="text-muted-foreground">Manage your recurring payments and subscriptions</p>
                </div>
                <AddSubscriptionDialog>
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Subscription
                    </Button>
                </AddSubscriptionDialog>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Active Subscriptions
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{activeSubscriptions.length}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {subscriptions.length - activeSubscriptions.length > 0 && 
                                `${subscriptions.length - activeSubscriptions.length} inactive`
                            }
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Monthly Cost
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatAmount(calculateTotalMonthly())}</div>
                        <p className="text-xs text-muted-foreground mt-1">Estimated average</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Yearly Cost
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatAmount(calculateTotalYearly())}</div>
                        <p className="text-xs text-muted-foreground mt-1">Estimated total</p>
                    </CardContent>
                </Card>
            </div>

            {/* Subscriptions List */}
            {isLoading ? (
                <Card>
                    <CardContent className="flex items-center justify-center py-12">
                        <p className="text-muted-foreground">Loading subscriptions...</p>
                    </CardContent>
                </Card>
            ) : subscriptionsWithDetails.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No subscriptions yet</h3>
                        <p className="text-muted-foreground text-center mb-4">
                            Start tracking your recurring payments and never miss a renewal
                        </p>
                        <AddSubscriptionDialog>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                Add Subscription
                            </Button>
                        </AddSubscriptionDialog>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {subscriptionsWithDetails.map((subscription) => {
                        const nextBillingDate = calculateNextBillingDate(subscription.startDate, subscription.billingCycle)
                        return (
                        <Card key={subscription.id}>
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <CardTitle className="text-lg">{subscription.title}</CardTitle>
                                            {subscription.categoryName && subscription.categoryColor && (
                                                <Badge
                                                    variant="outline"
                                                    style={{
                                                        backgroundColor: `${subscription.categoryColor}20`,
                                                        borderColor: subscription.categoryColor,
                                                        color: subscription.categoryColor
                                                    }}
                                                >
                                                    {subscription.categoryName}
                                                </Badge>
                                            )}
                                            {subscription.reminderEnabled && (
                                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                                    <Bell className="h-3 w-3 mr-1" />
                                                    Reminders On
                                                </Badge>
                                            )}
                                        </div>
                                        {subscription.description && (
                                            <p className="text-sm text-muted-foreground">{subscription.description}</p>
                                        )}

                                        <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground">
                                            <div className="flex items-center gap-1">
                                                <span className="font-medium text-foreground">
                                                    {formatAmount(parseFloat(subscription.amount), subscription.currency)}
                                                </span>
                                                <span>/ {getBillingCycleText(subscription.billingCycle)}</span>
                                            </div>

                                            <div className="flex items-center gap-1">
                                                <Calendar className="h-4 w-4" />
                                                <span>Next: {formatDate(nextBillingDate.toISOString())}</span>
                                            </div>

                                            {subscription.accountName && (
                                                <div className="flex items-center gap-1">
                                                    <CreditCard className="h-4 w-4" />
                                                    <span>{subscription.accountName}</span>
                                                </div>
                                            )}
                                        </div>

                                        {subscription.reminderEnabled && subscription.notifyDaysBefore && (
                                            <div className="mt-2 text-xs text-muted-foreground">
                                                <Bell className="h-3 w-3 inline mr-1" />
                                                Notify: {subscription.notifyDaysBefore} {subscription.notifyDaysBefore === 1 ? 'day' : 'days'} before
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleEdit(subscription)}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleDelete(subscription.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                        </Card>
                        )
                    })}
                </div>
            )}

            {/* Edit Dialog */}
            <AddSubscriptionDialog
                subscriptionToEdit={subscriptionToEdit}
                open={editDialogOpen}
                onOpenChange={(open) => {
                    setEditDialogOpen(open)
                    if (!open) setSubscriptionToEdit(null)
                }}
            >
                <></>
            </AddSubscriptionDialog>
        </div>
    )
}

export default withProtection(SubscriptionsTrackingPage)
