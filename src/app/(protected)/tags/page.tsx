"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, Tag as TagIcon, Trash2, Edit2, Loader2, Check } from "lucide-react"
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
    color: z.string().default("#000000"),
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

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Tags</h1>
                    <p className="text-muted-foreground">Manage your transaction tags</p>
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
                        <Button onClick={() => setIsCreateOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" /> Add Tag
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingTag ? "Edit Tag" : "Create Tag"}</DialogTitle>
                            <DialogDescription>
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
                                                <Input placeholder="e.g. Travel, Urgent" {...field} />
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
                                                                className="pl-10"
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
                                                            className="h-10 w-14 cursor-pointer p-1 bg-transparent border rounded-md"
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

                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => {
                                        setIsCreateOpen(false)
                                        setEditingTag(null)
                                    }}>
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={isPending}>
                                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        {editingTag ? "Update" : "Create"}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardContent className="p-6">
                    {isLoading ? (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="flex items-center justify-between p-4 border rounded-lg animate-pulse">
                                    <div className="h-6 w-1/3 bg-muted rounded" />
                                    <div className="h-8 w-8 bg-muted rounded" />
                                </div>
                            ))}
                        </div>
                    ) : tags.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <TagIcon className="mx-auto h-10 w-10 mb-3 opacity-20" />
                            <p>No tags found. Create one to get started.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {tags.map((tag: any) => (
                                <div key={tag.id} className="flex items-center justify-between p-4 border rounded-lg hover:border-primary/50 transition-colors group">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm"
                                            style={{ backgroundColor: tag.color }}
                                        >
                                            <TagIcon className="h-4 w-4 text-white" />
                                        </div>
                                        <span className="font-medium">{tag.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(tag)}>
                                            <Edit2 className="h-4 w-4 text-muted-foreground" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 hover:text-destructive"
                                            onClick={() => handleDelete(tag.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
