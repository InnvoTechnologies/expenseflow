"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Tag,
  Check,
  Sparkles
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { withProtection } from "@/lib/with-protection"
import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"

// Type definition matches the API response
type Category = {
  id: string
  name: string
  type: "EXPENSE" | "INCOME"
  color: string
  parentId: string | null
  createdAt: string
}

const categoryFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["EXPENSE", "INCOME"]),
  color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid color hex code"),
  parentId: z.string().optional().nullable(), // For future hierarchy support
})

type CategoryFormValues = z.infer<typeof categoryFormSchema>

const COLORS = [
  "#EF4444", "#F97316", "#F59E0B", "#84CC16", "#10B981",
  "#06B6D4", "#3B82F6", "#6366F1", "#8B5CF6", "#D946EF",
  "#EC4899", "#64748B", "#71717A", "#737373", "#78716C"
]

// Default categories to be created
const DEFAULT_CATEGORIES = [
  // Expense categories
  { name: "Food & Dining", type: "EXPENSE" as const, color: "#EF4444" },
  { name: "Transportation", type: "EXPENSE" as const, color: "#F97316" },
  { name: "Housing & Utilities", type: "EXPENSE" as const, color: "#F59E0B" },
  { name: "Groceries", type: "EXPENSE" as const, color: "#84CC16" },
  { name: "Shopping & Clothing", type: "EXPENSE" as const, color: "#10B981" },
  { name: "Healthcare & Medical", type: "EXPENSE" as const, color: "#06B6D4" },
  { name: "Entertainment", type: "EXPENSE" as const, color: "#3B82F6" },
  { name: "Education", type: "EXPENSE" as const, color: "#6366F1" },
  { name: "Business & Work", type: "EXPENSE" as const, color: "#8B5CF6" },
  { name: "Gifts & Donations", type: "EXPENSE" as const, color: "#D946EF" },
  { name: "Bills & Subscriptions", type: "EXPENSE" as const, color: "#EC4899" },
  { name: "Travel", type: "EXPENSE" as const, color: "#64748B" },

  // Income categories
  { name: "Salary", type: "INCOME" as const, color: "#10B981" },
  { name: "Freelance", type: "INCOME" as const, color: "#06B6D4" },
  { name: "Investments", type: "INCOME" as const, color: "#3B82F6" },
  { name: "Bonus", type: "INCOME" as const, color: "#8B5CF6" },
  { name: "Gifts Received", type: "INCOME" as const, color: "#D946EF" },
  { name: "Refunds", type: "INCOME" as const, color: "#EC4899" },
  { name: "Rental Income", type: "INCOME" as const, color: "#F59E0B" },
  { name: "Side Business", type: "INCOME" as const, color: "#84CC16" },
  { name: "Dividends", type: "INCOME" as const, color: "#EF4444" },
  { name: "Commission", type: "INCOME" as const, color: "#F97316" },
  { name: "Interest", type: "INCOME" as const, color: "#6366F1" },
  { name: "Other Income", type: "INCOME" as const, color: "#71717A" },
]

function CategoriesPage() {
  const queryClient = useQueryClient()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [activeTab, setActiveTab] = useState<"EXPENSE" | "INCOME">("EXPENSE")

  // Fetch Categories
  const { data: categories, isLoading } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await apiClient.get("/categories")
      return res.data
    },
  })

  // Create Category Mutation
  const createMutation = useMutation({
    mutationFn: async (values: CategoryFormValues) => {
      const res = await apiClient.post("/categories", values)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] })
      toast.success("Category created successfully")
      setIsDialogOpen(false)
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  // Update Category Mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: CategoryFormValues }) => {
      const res = await apiClient.patch(`/categories/${id}`, values)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] })
      toast.success("Category updated successfully")
      setIsDialogOpen(false)
      setEditingCategory(null)
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  // Delete Category Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/categories/${id}`)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] })
      toast.success("Category deleted successfully")
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  // Bulk Create Default Categories Mutation
  const bulkCreateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post("/categories/bulk-create", { categories: DEFAULT_CATEGORIES })
      return res.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["categories"] })
      toast.success(`Successfully created ${data.count} default categories!`)
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: "",
      type: "EXPENSE",
      color: "#9CA3AF",
    },
  })

  const onSubmit = (values: CategoryFormValues) => {
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, values })
    } else {
      createMutation.mutate(values)
    }
  }

  const handleEdit = (category: Category) => {
    setEditingCategory(category)
    form.reset({
      name: category.name,
      type: category.type,
      color: category.color,
      parentId: category.parentId,
    })
    setIsDialogOpen(true)
  }

  const handleCreate = () => {
    setEditingCategory(null)
    form.reset({
      name: "",
      type: activeTab, // Set default type based on active tab
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    })
    setIsDialogOpen(true)
  }

  const filteredCategories = categories?.filter(c => c.type === activeTab) || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Categories</h1>
          <p className="text-muted-foreground">Manage your expense and income categories</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (confirm("This will create 24 default categories (12 expense + 12 income). Continue?")) {
                bulkCreateMutation.mutate()
              }
            }}
            disabled={bulkCreateMutation.isPending}
          >
            {bulkCreateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Add Default Categories
              </>
            )}
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Category
          </Button>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open)
        if (!open) setEditingCategory(null)
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edit Category" : "Add Category"}</DialogTitle>
            <DialogDescription>
              {editingCategory ? "Make changes to your category details here." : "Add a new category to organize your transactions."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Groceries" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="EXPENSE">Expense</SelectItem>
                        <SelectItem value="INCOME">Income</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color</FormLabel>
                    <FormControl>
                      <div className="grid grid-cols-5 gap-2 mt-2">
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
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="EXPENSE">EXPENSE</TabsTrigger>
              <TabsTrigger value="INCOME">INCOME</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-4 mt-6">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-4 border rounded-lg animate-pulse">
                    <div className="h-6 w-1/3 bg-muted rounded" />
                    <div className="h-8 w-8 bg-muted rounded" />
                  </div>
                ))
              ) : filteredCategories.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No categories found. Click "Add Category" to create one.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredCategories.map((category) => (
                    <div key={category.id} className="flex items-center justify-between p-4 border rounded-lg hover:border-primary/50 transition-colors group">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm"
                          style={{ backgroundColor: category.color }}
                        >
                          {category.name.substring(0, 1).toUpperCase()}
                        </div>
                        <span className="font-medium">{category.name}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(category)}>
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:text-destructive"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this category?")) {
                              deleteMutation.mutate(category.id)
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

export default withProtection(CategoriesPage)
