"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
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
import { Switch } from "@/components/ui/switch"
import { apiClient } from "@/lib/api-client"

const payeeSchema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email").optional().or(z.literal("")),
    phone: z.string().optional(),
    address: z.string().optional(),
    description: z.string().optional(),
    isArchived: z.boolean().optional(),
})

type PayeeFormValues = z.infer<typeof payeeSchema>

interface AddPayeeDialogProps {
    children: React.ReactNode
    payeeToEdit?: any
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function AddPayeeDialog({
    children,
    payeeToEdit,
    open: controlledOpen,
    onOpenChange
}: AddPayeeDialogProps) {
    const [internalOpen, setInternalOpen] = useState(false)
    const isControlled = controlledOpen !== undefined
    const open = isControlled ? controlledOpen : internalOpen
    const setOpen = isControlled ? onOpenChange! : setInternalOpen

    const queryClient = useQueryClient()

    const form = useForm<PayeeFormValues>({
        resolver: zodResolver(payeeSchema),
        defaultValues: {
            name: "",
            email: "",
            phone: "",
            address: "",
            description: "",
            isArchived: false,
        },
    })

    // Set initial values for Edit Mode
    useEffect(() => {
        if (payeeToEdit && open) {
            form.reset({
                name: payeeToEdit.name,
                email: payeeToEdit.email || "",
                phone: payeeToEdit.phone || "",
                address: payeeToEdit.address || "",
                description: payeeToEdit.description || "",
                isArchived: payeeToEdit.isArchived || false,
            })
        } else if (!payeeToEdit && open) {
            form.reset({
                name: "",
                email: "",
                phone: "",
                address: "",
                description: "",
                isArchived: false,
            })
        }
    }, [payeeToEdit, open, form])

    const { mutate: createPayee, isPending: isCreating } = useMutation({
        mutationFn: async (values: PayeeFormValues) => {
            const res = await apiClient.post("/payees", values)
            return res.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["payees"] })
            toast.success("Payee created successfully")
            setOpen(false)
            form.reset()
        },
        onError: (error) => {
            toast.error(error.message)
        },
    })

    const { mutate: updatePayee, isPending: isUpdating } = useMutation({
        mutationFn: async (values: PayeeFormValues) => {
            const res = await apiClient.patch(`/payees/${payeeToEdit.id}`, values)
            return res.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["payees"] })
            toast.success("Payee updated successfully")
            setOpen(false)
        },
        onError: (error) => {
            toast.error(error.message)
        },
    })

    const onSubmit = (values: PayeeFormValues) => {
        if (payeeToEdit) {
            updatePayee(values)
        } else {
            createPayee(values)
        }
    }

    const isPending = isCreating || isUpdating

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto sm:rounded-[24px] dark:bg-[#09090B] dark:border-white/5 shadow-2xl p-6 sm:p-8">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-semibold tracking-tight">{payeeToEdit ? "Edit Payee" : "Add Payee"}</DialogTitle>
                    <DialogDescription className="text-zinc-500 dark:text-zinc-400">
                        {payeeToEdit
                            ? "Update payee details"
                            : "Add a person or entity you make payments to"}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="John Doe or Acme Inc." {...field} className="rounded-full bg-zinc-100/50 dark:bg-white/5 border-transparent h-10 px-4" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email (Optional)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="john@example.com" {...field} className="rounded-full bg-zinc-100/50 dark:bg-white/5 border-transparent h-10 px-4" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="phone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Phone (Optional)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="+123456789" {...field} className="rounded-full bg-zinc-100/50 dark:bg-white/5 border-transparent h-10 px-4" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name="address"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Address (Optional)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="123 Main St, City" {...field} className="rounded-full bg-zinc-100/50 dark:bg-white/5 border-transparent h-10 px-4" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description (Optional)</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Additional notes about this payee"
                                            className="rounded-2xl bg-zinc-100/50 dark:bg-white/5 border-transparent px-4 py-3"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {payeeToEdit && (
                            <FormField
                                control={form.control}
                                name="isArchived"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-[20px] dark:bg-[#121214] dark:border-white/5 border p-4">
                                        <div className="space-y-0.5">
                                            <FormLabel className="text-base">Archive Payee</FormLabel>
                                            <FormDescription>
                                                Archived payees won&apos;t show up in transaction dropdowns.
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
                        )}
                        <DialogFooter className="pt-4 mt-2 border-t dark:border-white/5">
                            <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="rounded-full hover:dark:bg-white/5">
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isPending} className="rounded-full dark:bg-white dark:text-black dark:hover:bg-white/90">
                                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {payeeToEdit ? "Update Payee" : "Create Payee"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
