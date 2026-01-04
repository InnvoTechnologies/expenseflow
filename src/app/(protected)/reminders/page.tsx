"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, BellRing, Pencil, Trash2, Check, X, Calendar } from "lucide-react"
import { withProtection } from "@/lib/with-protection"
import { AddReminderDialog } from "@/components/add-reminder-dialog"
import { apiClient } from "@/lib/api-client"
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
    if (statusFilter === "ALL") return true
    return reminder.status === statusFilter
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
          <h1 className="text-2xl font-semibold">Reminders</h1>
          <p className="text-muted-foreground">Manage your bill reminders and notifications</p>
        </div>
        <AddReminderDialog>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Reminder
          </Button>
        </AddReminderDialog>
      </div>

      {/* Status Filter */}
      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
        <TabsList>
          <TabsTrigger value="ALL">All</TabsTrigger>
          <TabsTrigger value="PENDING">Pending</TabsTrigger>
          <TabsTrigger value="COMPLETED">Completed</TabsTrigger>
          <TabsTrigger value="SKIPPED">Skipped</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Reminders List */}
      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading reminders...</p>
          </CardContent>
        </Card>
      ) : filteredReminders.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BellRing className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No reminders yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Set up reminders for bills, budgets, and other important dates
            </p>
            <AddReminderDialog>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Reminder
              </Button>
            </AddReminderDialog>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredReminders.map((reminder) => (
            <Card key={reminder.id} className={isOverdue(reminder.dueDate, reminder.status) ? "border-destructive" : ""}>
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
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Complete
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusUpdate(reminder.id, "SKIPPED")}
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
                      >
                        Reopen
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(reminder)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(reminder.id)}
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
