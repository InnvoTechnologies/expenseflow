"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, Tag as TagIcon, Trash2, Pencil, Loader2, Check, Search } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { apiClient } from "@/lib/api-client"
import { useOrganizationScope } from "@/hooks/use-organization-scope"

const tagSchema = z.object({
    name: z.string().min(1, "Name is required"),
    color: z.string(),
})

type TagFormValues = z.infer<typeof tagSchema>

const COLORS = [
    "#EF4444", "#F97316", "#F59E0B", "#84CC16", "#10B981",
    "#06B6D4", "#3B82F6", "#6366F1", "#8B5CF6", "#D946EF",
    "#EC4899", "#64748B", "#71717A", "#737373", "#78716C"
]

export default function TagsPage() {
    const { organizationId } = useOrganizationScope()
    const queryClient = useQueryClient()
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [editingTag, setEditingTag] = useState<any>(null)
    const [searchQuery, setSearchQuery] = useState("")

    // Fetch Tags
    const { data: tags = [], isLoading } = useQuery({
        queryKey: ["tags", organizationId],
        queryFn: async () => {
            const res = await apiClient.get("/tags")
            return res.data
        },
    })

    // Create Mutation
    const createMutation = useMutation({
        mutationFn: async (values: TagFormValues) => {
            const res = await apiClient.post("/tags", values)
            return res.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["tags", organizationId] })
            toast.success("Tag created successfully")
            setIsCreateOpen(false)
            form.reset()
        },
        onError: (error) => toast.error(error.message),
    })

    // Update Mutation
    const updateMutation = useMutation({
        mutationFn: async (values: TagFormValues) => {
            const res = await apiClient.patch(`/tags/${editingTag.id}`, values)
            return res.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["tags", organizationId] })
            toast.success("Tag updated successfully")
            setEditingTag(null)
            form.reset()
        },
        onError: (error) => toast.error(error.message),
    })

    // Delete Mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await apiClient.delete(`/tags/${id}`)
            return res.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["tags", organizationId] })
            toast.success("Tag deleted successfully")
        },
        onError: (error) => toast.error(error.message),
    })

    const form = useForm<TagFormValues>({
        resolver: zodResolver(tagSchema),
        defaultValues: {
            name: "",
            color: "#6366f1",
        },
    })

    const onSubmit = (values: TagFormValues) => {
        if (editingTag) {
            updateMutation.mutate(values)
        } else {
            createMutation.mutate(values)
        }
    }

    const handleEdit = (tag: any) => {
        setEditingTag(tag);
        form.reset({
            name: tag.name,
            color: tag.color || "#000000",
        });
    }

    const handleDelete = (id: string) => {
        if (confirm("Are you sure you want to delete this tag?")) {
            deleteMutation.mutate(id);
        }
    }

    const isPending = createMutation.isPending || updateMutation.isPending

    const filteredTags = tags.filter((tag: any) =>
        tag.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-medium tracking-tight">Tags</h1>
                    <p className="text-sm text-zinc-500 mt-1">Manage your transaction tags</p>
                </div>
                <Dialog open={isCreateOpen || !!editingTag} onOpenChange={(open) => {
                    if (!open) {
                        setIsCreateOpen(false);
                        setEditingTag(null);
                        form.reset({ name: "", color: "#6366f1" });
                    } else {
                        if (!editingTag) setIsCreateOpen(true);
                    }
                }}>
                    <DialogTrigger asChild>
                        <Button onClick={() => setIsCreateOpen(true)} className="rounded-full">
                            <Plus className="mr-2 h-4 w-4" /> Add Tag
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto sm:rounded-[24px] dark:bg-[#09090B] dark:border-white/5 shadow-2xl p-6 sm:p-8">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-semibold tracking-tight">{editingTag ? "Edit Tag" : "Create Tag"}</DialogTitle>
                            <DialogDescription className="text-zinc-500 dark:text-zinc-400">
                                {editingTag ? "Update the tag details." : "Add a new tag to organize your transactions."}
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
                                                <Input placeholder="e.g. Travel, Urgent" {...field} className="rounded-full bg-zinc-100/50 dark:bg-white/5 border-transparent h-10 px-4" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Color Selection */}
                                <FormField
                                    control={form.control}
                                    name="color"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Color</FormLabel>
                                            <FormControl>
                                                <div className="space-y-3">
                                                    <div className="flex gap-2 items-center">
                                                        <div className="relative">
                                                            <Input
                                                                placeholder="#000000"
                                                                {...field}
                                                                className="pl-10 rounded-full bg-zinc-100/50 dark:bg-white/5 border-transparent h-10 px-4"
                                                            />
                                                            <div
                                                                className="absolute left-3 top-2.5 h-5 w-5 rounded-full border shadow-sm"
                                                                style={{ backgroundColor: field.value }}
                                                            />
                                                        </div>
                                                        <input
                                                            type="color"
                                                            value={field.value}
                                                            onChange={(e) => field.onChange(e.target.value)}
                                                            className="h-10 w-14 cursor-pointer p-1 bg-transparent border dark:border-white/10 rounded-full"
                                                        />
                                                    </div>

                                                    <div className="grid grid-cols-5 gap-2">
                                                        {COLORS.map((color) => (
                                                            <div
                                                                key={color}
                                                                className={cn(
                                                                    "h-8 w-8 rounded-full cursor-pointer flex items-center justify-center transition-all hover:scale-110",
                                                                    field.value === color ? "ring-2 ring-primary ring-offset-2" : ""
                                                                )}
                                                                style={{ backgroundColor: color }}
                                                                onClick={() => field.onChange(color)}
                                                            >
                                                                {field.value === color && <Check className="h-4 w-4 text-white" />}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <DialogFooter className="pt-4 mt-2 border-t dark:border-white/5">
                                    <Button type="button" variant="ghost" className="rounded-full hover:dark:bg-white/5" onClick={() => {
                                        setIsCreateOpen(false)
                                        setEditingTag(null)
                                    }}>
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={isPending} className="rounded-full dark:bg-white dark:text-black dark:hover:bg-white/90">
                                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        {editingTag ? "Update" : "Create"}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                <div className="relative w-full sm:w-72 sm:ml-auto">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search tags..."
                        className="pl-10 rounded-full dark:bg-[#121214] border-transparent dark:border-white/5"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {isLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Card key={i} className="animate-pulse border-none shadow-none dark:bg-[#121214] bg-zinc-50 rounded-[24px] h-20" />
                    ))}
                </div>
            ) : filteredTags.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                    <TagIcon className="mx-auto h-10 w-10 mb-3 opacity-20" />
                    <p>{searchQuery ? "No tags match your search." : "No tags found. Create one to get started."}</p>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredTags.map((tag: any) => (
                        <Card key={tag.id} className="group border-none shadow-none dark:bg-[#121214] bg-zinc-50 rounded-[24px] transition-all hover:dark:bg-white/5 p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div
                                    className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm"
                                    style={{ backgroundColor: tag.color }}
                                >
                                    <TagIcon className="h-4 w-4 text-white" />
                                </div>
                                <span className="font-medium text-sm">{tag.name}</span>
                            </div>
                            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-zinc-200 dark:hover:bg-white/10" onClick={() => handleEdit(tag)}>
                                    <Pencil className="h-4 w-4 text-muted-foreground" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-full hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-destructive"
                                    onClick={() => handleDelete(tag.id)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
