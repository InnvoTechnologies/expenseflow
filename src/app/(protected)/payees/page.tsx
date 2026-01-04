"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
    Plus,
    Pencil,
    Trash2,
    User,
    Mail,
    Phone,
    MapPin,
    Search,
    MoreVertical,
    ChevronRight
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { withProtection } from "@/lib/with-protection"
import { AddPayeeDialog } from "@/components/add-payee-dialog"
import { apiClient } from "@/lib/api-client"

function PayeesPage() {
    const [searchQuery, setSearchQuery] = useState("")
    const [payeeToEdit, setPayeeToEdit] = useState<any>(null)
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [payeeToDelete, setPayeeToDelete] = useState<any>(null)

    const queryClient = useQueryClient()

    const { data: payees = [], isLoading } = useQuery({
        queryKey: ["payees"],
        queryFn: async () => {
            const res = await apiClient.get("/payees")
            return res.data
        },
    })

    const { mutate: deletePayee, isPending: isDeleting } = useMutation({
        mutationFn: async (id: string) => {
            const res = await apiClient.delete(`/payees/${id}`)
            return res.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["payees"] })
            toast.success("Payee deleted successfully")
            setPayeeToDelete(null)
        },
        onError: (error) => {
            toast.error(error.message)
        },
    })

    const filteredPayees = payees.filter((p: any) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.email?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const handleEdit = (payee: any) => {
        setPayeeToEdit(payee)
        setEditDialogOpen(true)
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Payees</h1>
                    <p className="text-muted-foreground">Manage people and entities you send payments to</p>
                </div>
                <AddPayeeDialog>
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Payee
                    </Button>
                </AddPayeeDialog>
            </div>

            <div className="flex items-center gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search payees by name or email..."
                        className="pl-10"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => (
                        <Card key={i} className="animate-pulse">
                            <CardHeader className="h-32 bg-muted" />
                        </Card>
                    ))}
                </div>
            ) : filteredPayees.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <User className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No payees found</h3>
                        <p className="text-muted-foreground text-center mb-6">
                            {searchQuery ? "Try a different search term" : "Add your first payee to start tracking payments"}
                        </p>
                        {!searchQuery && (
                            <AddPayeeDialog>
                                <Button>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Payee
                                </Button>
                            </AddPayeeDialog>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredPayees.map((payee: any) => (
                        <Card key={payee.id} className="group hover:border-primary/50 transition-colors">
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                            {payee.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <CardTitle className="text-base">{payee.name}</CardTitle>
                                            {payee.email && (
                                                <CardDescription className="flex items-center gap-1 mt-0.5">
                                                    <Mail className="h-3 w-3" />
                                                    {payee.email}
                                                </CardDescription>
                                            )}
                                        </div>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => handleEdit(payee)}>
                                                <Pencil className="h-4 w-4 mr-2" />
                                                Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                className="text-destructive focus:text-destructive"
                                                onClick={() => setPayeeToDelete(payee)}
                                            >
                                                <Trash2 className="h-4 w-4 mr-2" />
                                                Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </CardHeader>
                            <CardContent className="text-sm space-y-2">
                                {payee.phone && (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Phone className="h-3 w-3" />
                                        <span>{payee.phone}</span>
                                    </div>
                                )}
                                {payee.address && (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <MapPin className="h-3 w-3" />
                                        <span className="truncate">{payee.address}</span>
                                    </div>
                                )}
                                {payee.description && (
                                    <p className="text-xs text-muted-foreground line-clamp-2 mt-2 pt-2 border-t">
                                        {payee.description}
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Edit Dialog */}
            <AddPayeeDialog
                payeeToEdit={payeeToEdit}
                open={editDialogOpen}
                onOpenChange={(open) => {
                    setEditDialogOpen(open)
                    if (!open) setPayeeToEdit(null)
                }}
            >
                <></>
            </AddPayeeDialog>

            {/* Delete Alert */}
            <AlertDialog open={!!payeeToDelete} onOpenChange={(open) => !open && setPayeeToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Payee</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete <strong>{payeeToDelete?.name}</strong>?
                            This will not delete existing transactions associated with this payee, but the reference will be cleared.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => deletePayee(payeeToDelete.id)}
                            disabled={isDeleting}
                        >
                            {isDeleting ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

export default withProtection(PayeesPage)
