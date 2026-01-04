"use client"

import { useState, useEffect } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { apiClient } from "@/lib/api-client"
import { useOrganizationScope } from "@/hooks/use-organization-scope"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from "@/components/ui/form"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useCurrency } from "@/hooks/use-currency"

const subscriptionSchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    startDate: z.string().min(1, "Start date is required"),
    billingCycle: z.enum(["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"]),
    amount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Amount must be greater than 0"),
    currency: z.string().min(1, "Currency is required"),
    categoryId: z.string().uuid().optional().nullable(),
    accountId: z.string().uuid().optional().nullable(),
    notifyDaysBefore: z.number().min(0).optional().nullable(),
    reminderEnabled: z.boolean(),
})

type SubscriptionFormValues = z.infer<typeof subscriptionSchema>

interface AddSubscriptionDialogProps {
    children: React.ReactNode
    subscriptionToEdit?: any
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function AddSubscriptionDialog({
    children,
    subscriptionToEdit,
    open: controlledOpen,
    onOpenChange
}: AddSubscriptionDialogProps) {
    const [internalOpen, setInternalOpen] = useState(false)
    const isControlled = controlledOpen !== undefined
    const open = isControlled ? controlledOpen : internalOpen
    const setOpen = isControlled ? onOpenChange! : setInternalOpen

    const { baseCurrency } = useCurrency()
    const { organizationId } = useOrganizationScope()
    const queryClient = useQueryClient()

    // Fetch Categories
    const { data: categories = [] } = useQuery({
        queryKey: ["categories", organizationId],
        queryFn: async () => {
            const res = await apiClient.get("/categories")
            return res.data
        },
    })

    // Fetch Accounts
    const { data: accounts = [] } = useQuery({
        queryKey: ["accounts", organizationId],
        queryFn: async () => {
            const res = await apiClient.get("/accounts")
            return res.data
        },
    })

    const form = useForm<SubscriptionFormValues>({
        resolver: zodResolver(subscriptionSchema),
        defaultValues: {
            title: "",
            description: "",
            startDate: new Date().toISOString().split('T')[0],
            billingCycle: "MONTHLY",
            amount: "",
            currency: baseCurrency || "USD",
            categoryId: "",
            accountId: "",
            notifyDaysBefore: 3,
            reminderEnabled: true,
        },
    })

    // Set initial values for Edit Mode
    useEffect(() => {
        if (subscriptionToEdit && open) {
            form.reset({
                title: subscriptionToEdit.title,
                description: subscriptionToEdit.description || "",
                startDate: new Date(subscriptionToEdit.startDate).toISOString().split('T')[0],
                billingCycle: subscriptionToEdit.billingCycle,
                amount: subscriptionToEdit.amount.toString(),
                currency: subscriptionToEdit.currency || baseCurrency,
                categoryId: subscriptionToEdit.categoryId || "",
                accountId: subscriptionToEdit.accountId || "",
                notifyDaysBefore: subscriptionToEdit.notifyDaysBefore || 3,
                reminderEnabled: subscriptionToEdit.reminderEnabled ?? true,
            })
        } else if (!subscriptionToEdit && open) {
            form.reset({
                title: "",
                description: "",
                startDate: new Date().toISOString().split('T')[0],
                billingCycle: "MONTHLY",
                amount: "",
                currency: baseCurrency || "USD",
                categoryId: "",
                accountId: "",
                notifyDaysBefore: 3,
                reminderEnabled: true,
            })
        }
    }, [subscriptionToEdit, open, form])

    const createMutation = useMutation({
        mutationFn: async (values: SubscriptionFormValues) => {
            const res = await apiClient.post("/subscriptions", {
                ...values,
                categoryId: values.categoryId === "__none__" ? null : values.categoryId || null,
                accountId: values.accountId === "__none__" ? null : values.accountId || null,
            })
            return res.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["subscriptions"] })
            toast.success("Subscription created successfully")
            setOpen(false)
            form.reset()
        },
        onError: (error: any) => {
            toast.error(error.message || "Failed to create subscription")
        },
    })

    const updateMutation = useMutation({
        mutationFn: async (values: SubscriptionFormValues) => {
            const res = await apiClient.patch(`/subscriptions/${subscriptionToEdit.id}`, {
                ...values,
                categoryId: values.categoryId === "__none__" ? null : values.categoryId || null,
                accountId: values.accountId === "__none__" ? null : values.accountId || null,
            })
            return res.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["subscriptions"] })
            toast.success("Subscription updated successfully")
            setOpen(false)
            form.reset()
        },
        onError: (error: any) => {
            toast.error(error.message || "Failed to update subscription")
        },
    })

    const onSubmit = (values: SubscriptionFormValues) => {
        if (subscriptionToEdit) {
            updateMutation.mutate(values)
        } else {
            createMutation.mutate(values)
        }
    }

    const isPending = createMutation.isPending || updateMutation.isPending

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{subscriptionToEdit ? "Edit Subscription" : "Add Subscription"}</DialogTitle>
                    <DialogDescription>
                        {subscriptionToEdit
                            ? "Update your subscription details"
                            : "Track recurring payments and get notified before they're due"}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                        {/* Title */}
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Title</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Netflix Premium" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Description */}
                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description (Optional)</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Add additional details..."
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Start Date and Billing Cycle */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="startDate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Start Date</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="billingCycle"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Billing Cycle</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select cycle" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="DAILY">Daily</SelectItem>
                                                <SelectItem value="WEEKLY">Weekly</SelectItem>
                                                <SelectItem value="MONTHLY">Monthly</SelectItem>
                                                <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                                                <SelectItem value="YEARLY">Yearly</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Amount */}
                        <FormField
                            control={form.control}
                            name="amount"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Amount</FormLabel>
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg font-medium">{baseCurrency}</span>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                placeholder="0.00"
                                                className="text-2xl font-bold"
                                                {...field}
                                            />
                                        </FormControl>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Category (Optional) */}
                        <FormField
                            control={form.control}
                            name="categoryId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Category (Optional)</FormLabel>
                                    <Select 
                                        onValueChange={(value) => field.onChange(value === "__none__" ? undefined : value)} 
                                        value={field.value || undefined}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select category" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="__none__">None</SelectItem>
                                            {categories.map((cat: any) => (
                                                <SelectItem key={cat.id} value={cat.id}>
                                                    {cat.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Account (Optional) */}
                        <FormField
                            control={form.control}
                            name="accountId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Payment Account (Optional)</FormLabel>
                                    <Select 
                                        onValueChange={(value) => field.onChange(value === "__none__" ? undefined : value)} 
                                        value={field.value || undefined}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select account" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="__none__">None</SelectItem>
                                            {accounts.map((acc: any) => (
                                                <SelectItem key={acc.id} value={acc.id}>
                                                    {acc.name} ({acc.currency} {parseFloat(acc.currentBalance).toFixed(2)})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Reminder Enabled */}
                        <FormField
                            control={form.control}
                            name="reminderEnabled"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base">Enable Reminders</FormLabel>
                                        <FormDescription>
                                            Get notified before your subscription renews
                                        </FormDescription>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        {/* Notify Days Before */}
                        {form.watch("reminderEnabled") && (
                            <FormField
                                control={form.control}
                                name="notifyDaysBefore"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Notify Me Before (Days)</FormLabel>
                                        <FormDescription>
                                            How many days before renewal you want to be notified
                                        </FormDescription>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min="0"
                                                placeholder="e.g., 3"
                                                value={field.value || ""}
                                                onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isPending}>
                                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {subscriptionToEdit ? "Update Subscription" : "Create Subscription"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
