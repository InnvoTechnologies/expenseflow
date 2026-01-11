"use client"

import { useState, useEffect } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { useCurrency } from "@/hooks/use-currency"
import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import { useOrganizationScope } from "@/hooks/use-organization-scope"
import posthog from "posthog-js"
import { TagInput } from "./tag-input"

const COLORS = [
  "#EF4444", "#F97316", "#F59E0B", "#84CC16", "#10B981",
  "#06B6D4", "#3B82F6", "#6366F1", "#8B5CF6", "#D946EF",
  "#EC4899", "#64748B", "#71717A", "#737373", "#78716C"
]

// Schemas
const baseTransactionSchema = z.object({
  amount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Amount must be greater than 0"),
  feeAmount: z.string().optional().refine((val) => !val || (!isNaN(Number(val)) && Number(val) >= 0), "Fee must be a valid number"),
  date: z.string().min(1, "Date is required"),
  description: z.string().optional(),
  toAccountId: z.string().optional(),
  payeeId: z.string().optional(),
  tagIds: z.array(z.string()).default([]),
  subscriptionId: z.string().optional(),
  status: z.enum(["pending", "completed", "failed"]),
  type: z.enum(["EXPENSE", "INCOME", "TRANSFER"]),
})

const expenseIncomeSchema = baseTransactionSchema.extend({
  accountId: z.string().min(1, "Account is required"),
  categoryId: z.string().optional(),
}).refine((data) => !!data.categoryId, {
  message: "Category is required",
  path: ["categoryId"],
})

const transferSchema = baseTransactionSchema.extend({
  accountId: z.string().min(1, "From Account is required"),
  toAccountId: z.string().min(1, "To Account is required"),
}).refine((data) => data.accountId !== data.toAccountId, {
  message: "Source and destination accounts must be different",
  path: ["toAccountId"],
})

// Unified form values type
type TransactionFormValues = {
  type: "EXPENSE" | "INCOME" | "TRANSFER"
  amount: string
  feeAmount?: string
  date: string
  description?: string
  accountId: string
  toAccountId?: string
  categoryId?: string
  payeeId?: string | null
  tagIds?: string[]
  subscriptionId?: string | null
  status: "pending" | "completed" | "failed"
}

interface TransactionDialogProps {
  children?: React.ReactNode
  transactionToEdit?: any
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function TransactionDialog({ children, transactionToEdit, open: controlledOpen, onOpenChange }: TransactionDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? onOpenChange! : setInternalOpen

  const [activeTab, setActiveTab] = useState<"EXPENSE" | "INCOME" | "TRANSFER">("EXPENSE")
  const { baseCurrency } = useCurrency()
  const queryClient = useQueryClient()
  const { organizationId } = useOrganizationScope()

  // Fetch Accounts
  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts", organizationId],
    queryFn: async () => {
      const res = await apiClient.get("/accounts")
      return res.data
    },
  })

  // Fetch Categories
  const { data: categories = [] } = useQuery({
    queryKey: ["categories", organizationId],
    queryFn: async () => {
      const res = await apiClient.get("/categories")
      return res.data
    },
  })

  // Fetch Payees
  const { data: payees = [] } = useQuery({
    queryKey: ["payees", organizationId],
    queryFn: async () => {
      const res = await apiClient.get("/payees")
      return res.data
    },
  })

  // Fetch Tags
  const { data: tags = [] } = useQuery({
    queryKey: ["tags", organizationId],
    queryFn: async () => {
      const res = await apiClient.get("/tags")
      return res.data
    },
  })

  // Fetch Subscriptions
  const { data: subscriptions = [] } = useQuery({
    queryKey: ["subscriptions", organizationId],
    queryFn: async () => {
      const res = await apiClient.get("/subscriptions")
      return res.data
    },
  })

  const createTagMutation = useMutation({
    mutationFn: async (vars: { name: string, color: string }) => {
      const res = await apiClient.post("/tags", vars);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags", organizationId] });
    },
    onError: (err) => toast.error("Failed to create tag")
  });

  // Filter categories by type
  const expenseCategories = categories.filter((c: any) => c.type === "EXPENSE")
  const incomeCategories = categories.filter((c: any) => c.type === "INCOME")

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(
      activeTab === "TRANSFER" ? transferSchema : expenseIncomeSchema
    ),
    defaultValues: {
      type: "EXPENSE",
      amount: "",
      feeAmount: "",
      date: new Date().toISOString().split('T')[0],
      description: "",
      accountId: "",
      toAccountId: "",
      categoryId: "",
      payeeId: "",
      subscriptionId: "",
      status: "completed",
    },
  })

  // Set initial values for Edit Mode
  useEffect(() => {
    if (transactionToEdit && open) {
      setActiveTab(transactionToEdit.type)
      form.reset({
        type: transactionToEdit.type,
        amount: transactionToEdit.amount.toString(),
        feeAmount: transactionToEdit.feeAmount ? transactionToEdit.feeAmount.toString() : "",
        date: new Date(transactionToEdit.date).toISOString().split('T')[0],
        description: transactionToEdit.description || "",
        accountId: transactionToEdit.accountId,
        toAccountId: transactionToEdit.toAccountId || "",
        categoryId: transactionToEdit.categoryId || "",
        payeeId: transactionToEdit.payeeId || "",
        tagIds: transactionToEdit.tagIds || [],
        subscriptionId: transactionToEdit.subscription?.id || "",
        status: transactionToEdit.status,
      })
    } else if (!transactionToEdit && open) {
      // Reset to default for Add Mode if opening fresh
      form.reset({
        type: activeTab,
        amount: "",
        feeAmount: "",
        date: new Date().toISOString().split('T')[0],
        description: "",
        accountId: "",
        toAccountId: "",
        categoryId: "",
        payeeId: "",
        tagIds: [],
        subscriptionId: "",
        status: "completed",
      })
    }
  }, [transactionToEdit, open, form])

  // Also reset when tab changes in Add Mode
  useEffect(() => {
    if (!transactionToEdit) {
      form.reset((prev) => ({
        ...prev,
        type: activeTab,
      }))
    }
  }, [activeTab, form, transactionToEdit])


  const createMutation = useMutation({
    mutationFn: async (values: TransactionFormValues) => {
      const res = await apiClient.post("/transactions", values)
      return res.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      queryClient.invalidateQueries({ queryKey: ["insights"] })
      queryClient.invalidateQueries({ queryKey: ["accounts"] })
      toast.success("Transaction created successfully")

      // Track transaction creation
      const selectedCategory = categories.find((c: any) => c.id === variables.categoryId);
      const selectedAccount = accounts.find((a: any) => a.id === variables.accountId);

      posthog.capture('transaction_created', {
        transaction_type: variables.type,
        transaction_amount: parseFloat(variables.amount),
        transaction_category: selectedCategory?.name,
        transaction_account: selectedAccount?.name,
        has_description: !!variables.description,
        has_fee: !!variables.feeAmount && parseFloat(variables.feeAmount) > 0,
      });

      setOpen(false)
      form.reset()
    },
    onError: (error) => {
      toast.error(error.message)

      // Track transaction creation error
      posthog.captureException(error as Error);
    },
  })

  const editMutation = useMutation({
    mutationFn: async (values: TransactionFormValues) => {
      const res = await apiClient.patch(`/transactions/${transactionToEdit.id}`, values)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      queryClient.invalidateQueries({ queryKey: ["insights"] })
      queryClient.invalidateQueries({ queryKey: ["accounts"] })
      toast.success("Transaction updated successfully")
      setOpen(false)
      form.reset()
    },
    onError: (error) => toast.error(error.message),
  })

  const onSubmit = (values: TransactionFormValues) => {
    const submissionData = {
      ...values,
      type: activeTab,
      payeeId: values.payeeId === "" || values.payeeId === "__none__" ? null : values.payeeId,
      subscriptionId: values.subscriptionId === "" || values.subscriptionId === "__none__" ? null : values.subscriptionId,
      categoryId: values.categoryId === "" ? undefined : values.categoryId, // Category is required for Expense/Income, so undefined is fine (validations catch empty)
      toAccountId: values.toAccountId === "" ? undefined : values.toAccountId,
    }
    if (transactionToEdit) {
      editMutation.mutate(submissionData)
    } else {
      createMutation.mutate(submissionData)
    }
  }

  const isPending = createMutation.isPending || editMutation.isPending

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{transactionToEdit ? "Edit Transaction" : "Add Transaction"}</DialogTitle>
          <DialogDescription>
            {transactionToEdit ? "Modify the details of your transaction." : "Record a new expense, income, or transfer."}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => !transactionToEdit && setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="EXPENSE" disabled={!!transactionToEdit}>EXPENSE</TabsTrigger>
            <TabsTrigger value="INCOME" disabled={!!transactionToEdit}>INCOME</TabsTrigger>
            <TabsTrigger value="TRANSFER" disabled={!!transactionToEdit}>TRANSFER</TabsTrigger>
          </TabsList>

          {/* Note: We disable tab switching in edit mode for simplicity to avoid complex form reset logic 
               and type mismatch handling, unless requested otherwise. 
               The user can stick to the same type or we can enable it but need careful handling. 
               For now disabled to ensure stability. */}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">

              {/* Common Fields: Amount, Fee */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                <FormField
                  control={form.control}
                  name="feeAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fee (Optional)</FormLabel>
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
              </div>

              {/* Expense/Income Specific: Category */}
              {(activeTab === "EXPENSE" || activeTab === "INCOME") && (
                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <FormControl>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-40 overflow-y-auto p-1">
                          {(activeTab === "EXPENSE" ? expenseCategories : incomeCategories).map((cat: any) => (
                            <div
                              key={cat.id}
                              onClick={() => field.onChange(cat.id)}
                              className={cn(
                                "cursor-pointer border rounded-md p-2 flex flex-col items-center justify-center gap-1 transition-all hover:bg-muted text-center text-xs",
                                field.value === cat.id ? "ring-2 ring-primary bg-muted" : "bg-card"
                              )}
                            >
                              <div
                                className="h-6 w-6 rounded-full"
                                style={{ backgroundColor: cat.color }}
                              />
                              <span className="truncate w-full">{cat.name}</span>
                            </div>
                          ))}
                          {(activeTab === "EXPENSE" ? expenseCategories : incomeCategories).length === 0 && (
                            <div className="col-span-4 text-center text-sm text-muted-foreground py-4">
                              No categories found.
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Account Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="accountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{activeTab === "TRANSFER" ? "From Account" : "Account"}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {accounts.map((acc: any) => (
                            <SelectItem key={acc.id} value={acc.id}>
                              {acc.name} ({baseCurrency} {parseFloat(acc.currentBalance).toFixed(2)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {activeTab === "TRANSFER" && (
                  <FormField
                    control={form.control}
                    name="toAccountId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>To Account</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select destination" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {accounts.map((acc: any) => (
                              <SelectItem key={acc.id} value={acc.id} disabled={acc.id === form.getValues("accountId")}>
                                {acc.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {activeTab === "EXPENSE" && (
                  <FormField
                    control={form.control}
                    name="payeeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payee (Optional)</FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(value === "__none__" ? undefined : value)}
                          value={field.value || undefined}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select payee (optional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {payees.map((payee: any) => (
                              <SelectItem key={payee.id} value={payee.id}>
                                {payee.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {activeTab === "EXPENSE" && (
                <FormField
                  control={form.control}
                  name="subscriptionId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subscription (Optional)</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value === "__none__" ? undefined : value)}
                        value={field.value || undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select subscription (optional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {subscriptions.map((sub: any) => (
                            <SelectItem key={sub.id} value={sub.id}>
                              {sub.title} ({baseCurrency} {parseFloat(sub.amount).toFixed(2)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Add a note..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tagIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tags (Optional)</FormLabel>
                    <FormControl>
                      <TagInput
                        value={field.value || []}
                        onChange={field.onChange}
                        options={tags}
                        onCreate={async (name) => {
                          const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
                          await createTagMutation.mutateAsync({ name, color: randomColor });
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {transactionToEdit ? "Update Transaction" : "Save Transaction"}
                </Button>
              </DialogFooter>

            </form>
          </Form>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
