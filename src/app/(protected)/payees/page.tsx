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
    Archive,
    ArchiveRestore,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

    const { mutate: toggleArchive } = useMutation({
        mutationFn: async ({ id, isArchived }: { id: string, isArchived: boolean }) => {
            const res = await apiClient.patch(`/payees/${id}`, { isArchived })
            return res.data
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["payees"] })
            toast.success(variables.isArchived ? "Payee archived" : "Payee restored")
        },
        onError: (error) => {
            toast.error(error.message)
        },
    })

    const filteredPayees = payees.filter((p: any) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.email?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const activePayees = filteredPayees.filter((p: any) => !p.isArchived)
    const archivedPayees = filteredPayees.filter((p: any) => p.isArchived)

    const handleEdit = (payee: any) => {
        setPayeeToEdit(payee)
        setEditDialogOpen(true)
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-medium tracking-tight">Payees</h1>
                    <p className="text-sm text-zinc-500 mt-1">Manage people and entities you send payments to</p>
                </div>
                <AddPayeeDialog>
                    <Button className="rounded-full">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Payee
                    </Button>
                </AddPayeeDialog>
            </div>

            <Tabs defaultValue="active" className="w-full">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                    <TabsList className="mb-0 rounded-full p-1 h-auto">
                        <TabsTrigger value="active" className="rounded-full py-2">Active ({activePayees.length})</TabsTrigger>
                        <TabsTrigger value="archived" className="rounded-full py-2">Archived ({archivedPayees.length})</TabsTrigger>
                    </TabsList>
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search payees..."
                            className="pl-10 rounded-full dark:bg-[#121214] border-transparent dark:border-white/5"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <TabsContent value="active">
                    {isLoading ? (
                        <LoadingState />
                    ) : activePayees.length === 0 ? (
                        <EmptyState 
                            searchQuery={searchQuery} 
                            title="No active payees found" 
                            description={searchQuery ? "Try a different search term" : "Add your first payee to start tracking payments"}
                        />
                    ) : (
                        <PayeeGrid 
                            payees={activePayees} 
                            onEdit={handleEdit} 
                            onDelete={setPayeeToDelete} 
                            onArchive={(id: string, archived: boolean) => toggleArchive({ id, isArchived: archived })} 
                        />
                    )}
                </TabsContent>

                <TabsContent value="archived">
                    {isLoading ? (
                        <LoadingState />
                    ) : archivedPayees.length === 0 ? (
                        <EmptyState 
                            searchQuery={searchQuery} 
                            title="No archived payees" 
                            description={searchQuery ? "Try a different search term" : "Archived payees will appear here"}
                            hideAdd={true}
                        />
                    ) : (
                        <PayeeGrid 
                            payees={archivedPayees} 
                            onEdit={handleEdit} 
                            onDelete={setPayeeToDelete} 
                            onArchive={(id: string, archived: boolean) => toggleArchive({ id, isArchived: archived })} 
                        />
                    )}
                </TabsContent>
            </Tabs>

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

function LoadingState() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse border-none shadow-none dark:bg-[#121214] rounded-[24px]">
                    <CardHeader className="h-32 bg-muted rounded-t-[24px]" />
                </Card>
            ))}
        </div>
    )
}

function EmptyState({ searchQuery, title, description, hideAdd = false }: any) {
    return (
        <Card className="border-dashed dark:border-white/10 dark:bg-transparent shadow-none rounded-[24px]">
            <CardContent className="flex flex-col items-center justify-center py-12">
                <User className="h-12 w-12 text-zinc-500 mb-4" />
                <h3 className="text-lg font-semibold mb-2">{title}</h3>
                <p className="text-muted-foreground text-center mb-6">{description}</p>
                {!searchQuery && !hideAdd && (
                    <AddPayeeDialog>
                        <Button className="rounded-full">
                            <Plus className="mr-2 h-4 w-4" />
                            Add Payee
                        </Button>
                    </AddPayeeDialog>
                )}
            </CardContent>
        </Card>
    )
}

function PayeeGrid({ payees, onEdit, onDelete, onArchive }: any) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {payees.map((payee: any) => (
                <Card key={payee.id} className="group border-none shadow-none dark:bg-[#121214] bg-zinc-50 rounded-[24px] transition-all hover:dark:bg-white/5">
                    <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                    {payee.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <CardTitle className="text-base">{payee.name}</CardTitle>
                                        {payee.isArchived && <Badge variant="secondary">Archived</Badge>}
                                    </div>
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
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full hover:bg-zinc-200 dark:hover:bg-white/10">
                                        <MoreVertical className="h-4 w-4 text-zinc-500" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="rounded-xl border-transparent dark:border-white/5 shadow-2xl">
                                    <DropdownMenuItem onClick={() => onEdit(payee)} className="rounded-lg cursor-pointer">
                                        <Pencil className="h-4 w-4 mr-2" />
                                        Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onArchive(payee.id, !payee.isArchived)} className="rounded-lg cursor-pointer">
                                        {payee.isArchived ? (
                                            <>
                                                <ArchiveRestore className="h-4 w-4 mr-2" />
                                                Restore
                                            </>
                                        ) : (
                                            <>
                                                <Archive className="h-4 w-4 mr-2" />
                                                Archive
                                            </>
                                        )}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        className="text-red-500 dark:text-red-400 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/30 rounded-lg cursor-pointer"
                                        onClick={() => onDelete(payee)}
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
    )
}

export default withProtection(PayeesPage)
