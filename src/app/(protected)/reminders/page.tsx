"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, BellRing, Pencil, Trash2, Check, X, Calendar, Search } from "lucide-react"
import { withProtection } from "@/lib/with-protection"
import { AddReminderDialog } from "@/components/add-reminder-dialog"
import { apiClient } from "@/lib/api-client"
import { Input } from "@/components/ui/input"
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

type ReminderStatus = "PENDING" | "COMPLETED" | "SKIPPED"

interface Reminder {
  id: string
  title: string
  description: string | null
  dueDate: string
  status: ReminderStatus
  createdAt: string
  updatedAt: string
}

function RemindersPage() {
  const [statusFilter, setStatusFilter] = useState<ReminderStatus | "ALL">("ALL")
  const [searchQuery, setSearchQuery] = useState("")
  const [reminderToEdit, setReminderToEdit] = useState<Reminder | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [reminderToDelete, setReminderToDelete] = useState<string | null>(null)

  const queryClient = useQueryClient()

  // Fetch reminders
  const { data: reminders = [], isLoading } = useQuery<Reminder[]>({
    queryKey: ["reminders"],
    queryFn: async () => {
      const res = await apiClient.get("/reminders")
      return res.data
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/reminders/${id}`)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] })
      toast.success("Reminder deleted successfully")
      setDeleteDialogOpen(false)
      setReminderToDelete(null)
    },
    onError: (error: any) => toast.error(error.message),
  })

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ReminderStatus }) => {
      const res = await apiClient.patch(`/reminders/${id}`, { status })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] })
      toast.success("Reminder status updated")
    },
    onError: (error: any) => toast.error(error.message),
  })

  const handleEdit = (reminder: Reminder) => {
    setReminderToEdit(reminder)
    setEditDialogOpen(true)
  }

  const handleDelete = (id: string) => {
    setReminderToDelete(id)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (reminderToDelete) {
      deleteMutation.mutate(reminderToDelete)
    }
  }

  const handleStatusUpdate = (id: string, status: ReminderStatus) => {
    updateStatusMutation.mutate({ id, status })
  }

  // Filter reminders
  const filteredReminders = reminders.filter((reminder) => {
    const matchesStatus = statusFilter === "ALL" || reminder.status === statusFilter
    const matchesSearch = reminder.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (reminder.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
    return matchesStatus && matchesSearch
  })

  // Check if reminder is overdue
  const isOverdue = (dueDate: string, status: ReminderStatus) => {
    if (status !== "PENDING") return false
    return new Date(dueDate) < new Date()
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl sm:text-4xl font-medium tracking-tight">Reminders</h1>
          <p className="text-muted-foreground">Manage your bill reminders and notifications</p>
        </div>
        <AddReminderDialog>
          <Button className="rounded-full">
            <Plus className="mr-2 h-4 w-4" />
            Add Reminder
          </Button>
        </AddReminderDialog>
      </div>

      {/* Status Filter */}
      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)} className="w-full">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <TabsList className="mb-0 rounded-full p-1 h-auto">
            <TabsTrigger value="ALL" className="rounded-full py-2">All</TabsTrigger>
            <TabsTrigger value="PENDING" className="rounded-full py-2">Pending</TabsTrigger>
            <TabsTrigger value="COMPLETED" className="rounded-full py-2">Completed</TabsTrigger>
            <TabsTrigger value="SKIPPED" className="rounded-full py-2">Skipped</TabsTrigger>
          </TabsList>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search reminders..."
              className="pl-10 rounded-full dark:bg-[#121214] border-transparent dark:border-white/5"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </Tabs>

      {/* Reminders List */}
      {isLoading ? (
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="border-none shadow-none dark:bg-[#121214] bg-zinc-50 rounded-[24px] animate-pulse">
              <CardContent className="p-6">
                <div className="flex items-start justify-between w-full">
                  <div className="flex-1 space-y-2">
                    <div className="h-5 w-40 bg-zinc-200 dark:bg-zinc-800 rounded" />
                    <div className="h-4 w-60 bg-zinc-200 dark:bg-zinc-800 rounded" />
                    <div className="h-3 w-32 bg-zinc-200 dark:bg-zinc-800 rounded mt-2" />
                  </div>
                  <div className="h-8 w-24 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredReminders.length === 0 ? (
        <Card className="border border-dashed shadow-none dark:bg-[#121214] bg-zinc-50 rounded-[24px]">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BellRing className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No reminders yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Set up reminders for bills, budgets, and other important dates
            </p>
            <AddReminderDialog>
              <Button className="rounded-full">
                <Plus className="mr-2 h-4 w-4" />
                Add Reminder
              </Button>
            </AddReminderDialog>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredReminders.map((reminder) => (
            <Card key={reminder.id} className={isOverdue(reminder.dueDate, reminder.status) ? "border border-destructive shadow-none dark:bg-[#121214] bg-zinc-50 rounded-[24px]" : "border-none shadow-none dark:bg-[#121214] bg-zinc-50 rounded-[24px]"}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="text-lg">{reminder.title}</CardTitle>
                      {reminder.status === "COMPLETED" && (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          <Check className="h-3 w-3 mr-1" />
                          Completed
                        </Badge>
                      )}
                      {reminder.status === "SKIPPED" && (
                        <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                          <X className="h-3 w-3 mr-1" />
                          Skipped
                        </Badge>
                      )}
                      {isOverdue(reminder.dueDate, reminder.status) && (
                        <Badge variant="destructive">Overdue</Badge>
                      )}
                    </div>
                    {reminder.description && (
                      <p className="text-sm text-muted-foreground">{reminder.description}</p>
                    )}
                    <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Due: {formatDate(reminder.dueDate)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {reminder.status === "PENDING" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusUpdate(reminder.id, "COMPLETED")}
                          className="rounded-full"
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Complete
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusUpdate(reminder.id, "SKIPPED")}
                          className="rounded-full"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Skip
                        </Button>
                      </>
                    )}
                    {reminder.status !== "PENDING" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusUpdate(reminder.id, "PENDING")}
                        className="rounded-full"
                      >
                        Reopen
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(reminder)}
                      className="rounded-full h-8 w-8 p-0"
                    >
                      <Pencil className="h-4 w-4 text-zinc-500" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(reminder.id)}
                      className="rounded-full h-8 w-8 p-0 hover:bg-red-500/10 hover:text-red-500 text-zinc-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <AddReminderDialog
        reminderToEdit={reminderToEdit}
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open)
          if (!open) setReminderToEdit(null)
        }}
      >
        <></>
      </AddReminderDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the reminder.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default withProtection(RemindersPage)
