"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { apiClient } from "@/lib/api-client"

const reminderSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  dueDate: z.string().min(1, "Due date and time is required"),
})

type ReminderFormValues = z.infer<typeof reminderSchema>

interface AddReminderDialogProps {
  children: React.ReactNode
  reminderToEdit?: any
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function AddReminderDialog({
  children,
  reminderToEdit,
  open: controlledOpen,
  onOpenChange
}: AddReminderDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? onOpenChange! : setInternalOpen

  const queryClient = useQueryClient()

  const form = useForm<ReminderFormValues>({
    resolver: zodResolver(reminderSchema),
    defaultValues: {
      title: "",
      description: "",
      dueDate: new Date().toISOString().slice(0, 16), // Format: YYYY-MM-DDTHH:mm
    },
  })

  // Set initial values for Edit Mode
  useEffect(() => {
    if (reminderToEdit && open) {
      form.reset({
        title: reminderToEdit.title,
        description: reminderToEdit.description || "",
        dueDate: new Date(reminderToEdit.dueDate).toISOString().slice(0, 16),
      })
    } else if (!reminderToEdit && open) {
      form.reset({
        title: "",
        description: "",
        dueDate: new Date().toISOString().slice(0, 16),
      })
    }
  }, [reminderToEdit, open, form])

  const createMutation = useMutation({
    mutationFn: async (values: ReminderFormValues) => {
      const res = await apiClient.post("/reminders", values)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] })
      toast.success("Reminder created successfully")
      setOpen(false)
      form.reset()
    },
    onError: (error: any) => toast.error(error.message),
  })

  const editMutation = useMutation({
    mutationFn: async (values: ReminderFormValues) => {
      const res = await apiClient.patch(`/reminders/${reminderToEdit.id}`, values)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] })
      toast.success("Reminder updated successfully")
      setOpen(false)
      form.reset()
    },
    onError: (error: any) => toast.error(error.message),
  })

  const onSubmit = (values: ReminderFormValues) => {
    if (reminderToEdit) {
      editMutation.mutate(values)
    } else {
      createMutation.mutate(values)
    }
  }

  const isPending = createMutation.isPending || editMutation.isPending

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{reminderToEdit ? "Edit Reminder" : "Add Reminder"}</DialogTitle>
          <DialogDescription>
            {reminderToEdit
              ? "Update your reminder details"
              : "Set up a reminder for bills, budgets, or other important dates"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Pay Electricity Bill" {...field} />
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
                      placeholder="Add additional details..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Due Date & Time</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                {reminderToEdit ? "Update Reminder" : "Create Reminder"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
