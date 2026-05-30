"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2, Check, ChevronsUpDown } from "lucide-react"

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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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
import { numberToWords } from "@/lib/number-to-words"

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
  payeeId: z.string().nullable().optional(),
  tagIds: z.array(z.string()).default([]),
  subscriptionId: z.string().nullable().optional(),
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
  type?: "EXPENSE" | "INCOME" | "TRANSFER"
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
  const [payeeSearchOpen, setPayeeSearchOpen] = useState(false)
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
    onError: () => toast.error("Failed to create tag")
  });

  // Filter categories by type
  const expenseCategories = categories.filter((c: any) => c.type === "EXPENSE")
  const incomeCategories = categories.filter((c: any) => c.type === "INCOME")

  const sortedActivePayees = payees
    .filter((p: any) => !p.isArchived)
    .sort((a: any, b: any) => a.name.localeCompare(b.name))

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(
      activeTab === "TRANSFER" ? transferSchema : expenseIncomeSchema
    ) as any,
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
  
  // Auto-selection for single options
  useEffect(() => {
    if (open && !transactionToEdit) {
      // Auto-select Account
      if (accounts.length === 1 && !form.getValues("accountId")) {
        form.setValue("accountId", accounts[0].id);
      }

      // Auto-select Category
      const relevantCategories = activeTab === "EXPENSE" ? expenseCategories : incomeCategories;
      if (relevantCategories.length === 1 && !form.getValues("categoryId")) {
        form.setValue("categoryId", relevantCategories[0].id);
      }

      // Auto-select Payee (Active only)
      const activePayees = payees.filter((p: any) => !p.isArchived);
      if (activePayees.length === 1 && activeTab === "EXPENSE" && !form.getValues("payeeId")) {
        form.setValue("payeeId", activePayees[0].id);
      }

      // Auto-select Subscription
      if (subscriptions.length === 1 && activeTab === "EXPENSE" && !form.getValues("subscriptionId")) {
        form.setValue("subscriptionId", subscriptions[0].id);
      }

      // Auto-select To Account for Transfers
      if (activeTab === "TRANSFER" && accounts.length === 2 && !form.getValues("toAccountId")) {
        const fromAccount = form.getValues("accountId");
        if (fromAccount) {
          const toAccount = accounts.find((a: any) => a.id !== fromAccount);
          if (toAccount) {
            form.setValue("toAccountId", toAccount.id);
          }
        }
      }
    }
  }, [open, transactionToEdit, accounts, expenseCategories, incomeCategories, payees, subscriptions, activeTab, form]);

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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto sm:rounded-[24px] dark:bg-[#09090B] dark:border-white/5 shadow-2xl p-6 sm:p-8">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-2xl font-semibold tracking-tight">{transactionToEdit ? "Edit Transaction" : "Add Transaction"}</DialogTitle>
          <DialogDescription className="text-zinc-500 dark:text-zinc-400">
            {transactionToEdit ? "Modify the details of your transaction." : "Record a new expense, income, or transfer."}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => !transactionToEdit && setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-3 rounded-full bg-zinc-100 dark:bg-white/5 p-1">
            <TabsTrigger 
              className="rounded-full text-xs font-semibold tracking-wider uppercase transition-all data-[state=active]:bg-zinc-900 data-[state=active]:text-white data-[state=active]:dark:bg-white data-[state=active]:dark:text-black shadow-sm" 
              value="EXPENSE" 
              disabled={!!transactionToEdit}
            >
              EXPENSE
            </TabsTrigger>
            <TabsTrigger 
              className="rounded-full text-xs font-semibold tracking-wider uppercase transition-all data-[state=active]:bg-zinc-900 data-[state=active]:text-white data-[state=active]:dark:bg-white data-[state=active]:dark:text-black shadow-sm" 
              value="INCOME" 
              disabled={!!transactionToEdit}
            >
              INCOME
            </TabsTrigger>
            <TabsTrigger 
              className="rounded-full text-xs font-semibold tracking-wider uppercase transition-all data-[state=active]:bg-zinc-900 data-[state=active]:text-white data-[state=active]:dark:bg-white data-[state=active]:dark:text-black shadow-sm" 
              value="TRANSFER" 
              disabled={!!transactionToEdit}
            >
              TRANSFER
            </TabsTrigger>
          </TabsList>

          {/* Note: We disable tab switching in edit mode for simplicity to avoid complex form reset logic 
               and type mismatch handling, unless requested otherwise. 
               The user can stick to the same type or we can enable it but need careful handling. 
               For now disabled to ensure stability. */}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-6">

              {/* Common Fields: Amount, Fee */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Amount</FormLabel>
                      <div className="flex items-center gap-2 border dark:border-white/10 dark:bg-[#121214] rounded-2xl px-4 py-1 focus-within:ring-1 focus-within:ring-white/20 transition-all">
                        <span className="text-xl font-medium text-zinc-400">{baseCurrency}</span>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className="text-2xl font-light border-none shadow-none focus-visible:ring-0 px-0 dark:bg-transparent h-10"
                            {...field}
                          />
                        </FormControl>
                      </div>
                      {field.value && !isNaN(Number(field.value)) && Number(field.value) > 0 && (
                        <p className="text-xs text-muted-foreground mt-1 animate-in fade-in slide-in-from-top-1 duration-300 ml-1">
                          {numberToWords(Number(field.value))}
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="feeAmount"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Fee (Optional)</FormLabel>
                      <div className="flex items-center gap-2 border dark:border-white/10 dark:bg-[#121214] rounded-2xl px-4 py-1 focus-within:ring-1 focus-within:ring-white/20 transition-all">
                        <span className="text-xl font-medium text-zinc-400">{baseCurrency}</span>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className="text-2xl font-light border-none shadow-none focus-visible:ring-0 px-0 dark:bg-transparent h-10"
                            {...field}
                          />
                        </FormControl>
                      </div>
                      {field.value && !isNaN(Number(field.value)) && Number(field.value) > 0 && (
                        <p className="text-xs text-muted-foreground mt-1 animate-in fade-in slide-in-from-top-1 duration-300 ml-1">
                          {numberToWords(Number(field.value))}
                        </p>
                      )}
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
                    <FormItem className="space-y-2">
                      <FormLabel className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Category</FormLabel>
                      <FormControl>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                          {(activeTab === "EXPENSE" ? expenseCategories : incomeCategories).map((cat: any) => (
                            <div
                              key={cat.id}
                              onClick={() => field.onChange(cat.id)}
                              className={cn(
                                "cursor-pointer rounded-full p-2 flex items-center justify-center transition-all text-center text-xs border h-9",
                                field.value === cat.id 
                                  ? "border-transparent font-semibold scale-[1.03]" 
                                  : "font-medium hover:opacity-80"
                              )}
                              style={{
                                borderColor: cat.color,
                                backgroundColor: field.value === cat.id ? cat.color : `${cat.color}15`,
                                color: field.value === cat.id ? "#ffffff" : cat.color
                              }}
                            >
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

              {/* Account and Date Selection */}
              <div className={cn(
                "grid grid-cols-1 gap-4",
                activeTab === "TRANSFER" ? "sm:grid-cols-3" : "sm:grid-cols-2"
              )}>
                <FormField
                  control={form.control}
                  name="accountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{activeTab === "TRANSFER" ? "From Account" : "Account"}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="rounded-full bg-zinc-100/50 dark:bg-white/5 border-transparent h-10">
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-xl dark:bg-[#121214] dark:border-white/10">
                          {accounts.map((acc: any) => (
                            <SelectItem key={acc.id} value={acc.id} className="rounded-lg">
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
                        <FormLabel className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">To Account</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="rounded-xl dark:bg-[#121214] dark:border-white/5 h-12">
                              <SelectValue placeholder="Select destination" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-xl dark:bg-[#121214] dark:border-white/10">
                            {accounts.map((acc: any) => (
                              <SelectItem key={acc.id} value={acc.id} disabled={acc.id === form.getValues("accountId")} className="rounded-lg">
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

                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} className="rounded-full bg-zinc-100/50 dark:bg-white/5 border-transparent h-10 w-full relative [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-4 [&::-webkit-calendar-picker-indicator]:cursor-pointer pl-4 pr-10" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {activeTab === "EXPENSE" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="payeeId"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Payee (Optional)</FormLabel>
                        <Popover open={payeeSearchOpen} onOpenChange={setPayeeSearchOpen} modal={true}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={payeeSearchOpen}
                                className="w-full justify-between rounded-full bg-zinc-100/50 dark:bg-white/5 border-transparent h-10 px-4 font-normal text-left hover:bg-zinc-100 dark:hover:bg-white/5"
                              >
                                <span className="truncate">
                                  {field.value
                                    ? payees.find((p: any) => p.id === field.value)?.name || "Select payee (optional)"
                                    : "Select payee (optional)"}
                                </span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2 rounded-[24px] dark:bg-[#121214] border-none shadow-2xl" align="start">
                            <Command>
                              <CommandInput
                                placeholder="Search payees..."
                                className="rounded-full border-none focus-visible:ring-0 focus-visible:ring-offset-0 px-4 mb-2"
                              />
                              <CommandList>
                                <CommandEmpty>No payees found.</CommandEmpty>
                                <CommandGroup>
                                  <CommandItem
                                    value="__none__"
                                    onSelect={() => {
                                      field.onChange(null)
                                      setPayeeSearchOpen(false)
                                    }}
                                    className="rounded-lg"
                                  >
                                    <div className="flex items-center gap-2 w-full">
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          !field.value ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <span>None</span>
                                    </div>
                                  </CommandItem>
                                  {sortedActivePayees.map((payee: any) => (
                                    <CommandItem
                                      key={payee.id}
                                      value={payee.name}
                                      onSelect={() => {
                                        field.onChange(payee.id)
                                        setPayeeSearchOpen(false)
                                      }}
                                      className="rounded-lg"
                                    >
                                      <div className="flex items-center gap-2 w-full">
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            field.value === payee.id ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        <span>{payee.name}</span>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="subscriptionId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Subscription (Optional)</FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(value === "__none__" ? undefined : value)}
                          value={field.value || undefined}
                        >
                          <FormControl>
                            <SelectTrigger className="rounded-full bg-zinc-100/50 dark:bg-white/5 border-transparent h-10">
                              <SelectValue placeholder="Select subscription (optional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-xl dark:bg-[#121214] dark:border-white/10">
                            <SelectItem value="__none__" className="rounded-lg">None</SelectItem>
                            {subscriptions.map((sub: any) => (
                              <SelectItem key={sub.id} value={sub.id} className="rounded-lg">
                                {sub.title} ({baseCurrency} {parseFloat(sub.amount).toFixed(2)})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Description (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Add a note..." {...field} className="rounded-full bg-zinc-100/50 dark:bg-white/5 border-transparent h-10 px-4" />
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
                    <FormLabel className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Tags (Optional)</FormLabel>
                    <FormControl>
                      <div className="w-full">
                        <TagInput
                          value={field.value || []}
                          onChange={field.onChange}
                          options={tags}
                          onCreate={async (name) => {
                            const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
                            await createTagMutation.mutateAsync({ name, color: randomColor });
                          }}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="mt-8 pt-4 border-t dark:border-white/5">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="rounded-xl hover:dark:bg-white/5">
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending} className="rounded-xl dark:bg-white dark:text-black dark:hover:bg-white/90 font-medium px-6">
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
