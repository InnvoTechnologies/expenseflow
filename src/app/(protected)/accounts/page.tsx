"use client"

import { useState, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import * as currencyCodes from "currency-codes"
import {
  Plus,
  Wallet,
  CreditCard,
  Building2,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
  Smartphone
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
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useCurrency } from "@/hooks/use-currency"
import { withProtection } from "@/lib/with-protection"
import { apiClient } from "@/lib/api-client"
import posthog from "posthog-js"

// Get all currencies and sort them
function getCurrencyList() {
  return currencyCodes
    .codes()
    .map((code: string) => {
      const currency = currencyCodes.code(code)
      return {
        code: code || "",
        name: currency?.currency || "",
      }
    })
    .filter((c) => c.code && c.name) // Filter out invalid entries
    .sort((a, b) => a.code.localeCompare(b.code))
}

// Type definition matches the API response
type Account = {
  id: string
  name: string
  type: "BANK" | "CASH" | "MOBILE_WALLET" | "CREDIT_CARD"
  currency: string
  currentBalance: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

const accountFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["BANK", "CASH", "MOBILE_WALLET", "CREDIT_CARD"]),
  currency: z.string().min(1, "Currency is required"),
  currentBalance: z.string().refine((val) => !isNaN(Number(val)), {
    message: "Must be a valid number",
  }),
  isDefault: z.boolean(),
})

type AccountFormValues = z.infer<typeof accountFormSchema>

function AccountsPage() {
  const { formatAmount, baseCurrency } = useCurrency()
  const queryClient = useQueryClient()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  
  const currencyList = useMemo(() => getCurrencyList(), [])

  // Fetch Accounts
  const { data: accounts, isLoading } = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: async () => {
      const res = await apiClient.get("/accounts")
      return res.data
    },
  })

  // Create Account Mutation
  const createMutation = useMutation({
    mutationFn: async (values: AccountFormValues) => {
      const res = await apiClient.post("/accounts", values)
      return res.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] })
      toast.success("Account created successfully")

      // Track account creation
      posthog.capture('account_created', {
        account_type: variables.type,
        account_currency: variables.currency,
        is_default: variables.isDefault,
      });

      setIsDialogOpen(false)
    },
    onError: (error) => {
      toast.error(error.message)

      // Track account creation error
      posthog.captureException(error as Error);
    },
  })

  // Update Account Mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: AccountFormValues }) => {
      const res = await apiClient.patch(`/accounts/${id}`, values)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] })
      toast.success("Account updated successfully")
      setIsDialogOpen(false)
      setEditingAccount(null)
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  // Delete Account Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/accounts/${id}`)
      return res.data
    },
    onSuccess: (_, accountId) => {
      // Find deleted account for tracking
      const deletedAccount = accounts?.find((a) => a.id === accountId);

      queryClient.invalidateQueries({ queryKey: ["accounts"] })
      toast.success("Account deleted successfully")

      // Track account deletion
      posthog.capture('account_deleted', {
        account_type: deletedAccount?.type,
        account_currency: deletedAccount?.currency,
      });
    },
    onError: (error) => {
      toast.error(error.message)

      // Track account deletion error
      posthog.captureException(error as Error);
    },
  })

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      name: "",
      type: "BANK",
      currency: baseCurrency || "USD",
      currentBalance: "0",
      isDefault: false,
    },
  })

  const onSubmit = (values: AccountFormValues) => {
    if (editingAccount) {
      updateMutation.mutate({ id: editingAccount.id, values })
    } else {
      createMutation.mutate(values)
    }
  }

  const handleEdit = (account: Account) => {
    setEditingAccount(account)
    form.reset({
      name: account.name,
      type: account.type,
      currency: account.currency,
      currentBalance: account.currentBalance,
      isDefault: account.isDefault,
    })
    setIsDialogOpen(true)
  }

  const handleCreate = () => {
    setEditingAccount(null)
    form.reset({
      name: "",
      type: "BANK",
      currency: baseCurrency || "USD",
      currentBalance: "0",
      isDefault: false,
    })
    setIsDialogOpen(true)
  }

  const getIcon = (type: Account["type"]) => {
    switch (type) {
      case "BANK":
        return <Building2 className="h-5 w-5" />
      case "CREDIT_CARD":
        return <CreditCard className="h-5 w-5" />
      case "MOBILE_WALLET":
        return <Smartphone className="h-5 w-5" />
      case "CASH":
      default:
        return <Wallet className="h-5 w-5" />
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-medium tracking-tight">Accounts</h1>
          <p className="text-sm text-zinc-500 mt-1">Manage your accounts and balances</p>
        </div>
        <Button onClick={handleCreate} className="rounded-full">
          <Plus className="mr-2 h-4 w-4" />
          Add Account
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open)
        if (!open) setEditingAccount(null)
      }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto sm:rounded-[24px] dark:bg-[#09090B] dark:border-white/5 shadow-2xl p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold tracking-tight">{editingAccount ? "Edit Account" : "Add Account"}</DialogTitle>
            <DialogDescription className="text-zinc-500 dark:text-zinc-400">
              {editingAccount ? "Make changes to your account details here." : "Add a new financial account to track your balance."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Chase Checking" {...field} className="rounded-full bg-zinc-100/50 dark:bg-white/5 border-transparent h-10 px-4" />
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
                        <SelectTrigger className="rounded-full bg-zinc-100/50 dark:bg-white/5 border-transparent h-10 px-4">
                          <SelectValue placeholder="Select account type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="rounded-2xl dark:bg-[#121214] dark:border-white/10">
                        <SelectItem value="BANK">Bank Account</SelectItem>
                        <SelectItem value="CASH">Cash</SelectItem>
                        <SelectItem value="CREDIT_CARD">Credit Card</SelectItem>
                        <SelectItem value="MOBILE_WALLET">Mobile Wallet</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="rounded-full bg-zinc-100/50 dark:bg-white/5 border-transparent h-10 px-4">
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-[300px] rounded-2xl dark:bg-[#121214] dark:border-white/10">
                          {currencyList.map((currency) => (
                            <SelectItem key={currency.code} value={currency.code}>
                              {currency.code} - {currency.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="currentBalance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Balance</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} className="rounded-full bg-zinc-100/50 dark:bg-white/5 border-transparent h-10 px-4" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="isDefault"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-[20px] dark:bg-[#121214] dark:border-white/5 border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Default Account
                      </FormLabel>
                      <FormDescription>
                        Use this account as the default for new transactions.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
              <DialogFooter className="pt-4 mt-2 border-t dark:border-white/5">
                <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-full hover:dark:bg-white/5">Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="rounded-full dark:bg-white dark:text-black dark:hover:bg-white/90">
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

      {/* Account Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          // Skeleton loading state
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 w-1/3 bg-muted rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-1/2 bg-muted rounded" />
              </CardContent>
            </Card>
          ))
        ) : accounts?.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-12 dark:bg-[#121214] rounded-[24px]">
            <Wallet className="h-8 w-8 text-zinc-500 mb-3" />
            <p className="text-sm text-zinc-500">No accounts found. Create one to get started.</p>
            <Button variant="outline" className="mt-4 rounded-full" onClick={handleCreate}>
              Create Account
            </Button>
          </div>
        ) : (
          accounts?.map((account) => (
            <Card key={account.id} className="border-none shadow-none dark:bg-[#121214] bg-zinc-50 rounded-[24px]">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full flex items-center justify-center bg-zinc-200 dark:bg-white/10 shrink-0 text-zinc-500 dark:text-zinc-400">
                    {getIcon(account.type)}
                  </div>
                  <div>
                    <CardTitle className="text-sm font-medium uppercase tracking-wider text-zinc-500">
                      {account.name}
                    </CardTitle>
                    <p className="text-[10px] text-zinc-600 capitalize mt-1">
                      {account.type.replace('_', ' ').toLowerCase()}
                      {account.isDefault && (
                        <span className="ml-2 text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-sm uppercase tracking-widest">Default</span>
                      )}
                    </p>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0 rounded-full hover:bg-zinc-200 dark:hover:bg-white/10">
                      <span className="sr-only">Open menu</span>
                      <MoreVertical className="h-4 w-4 text-zinc-500" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl border-transparent dark:border-white/5 shadow-2xl">
                    <DropdownMenuItem onClick={() => handleEdit(account)} className="rounded-lg cursor-pointer">
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-500 dark:text-red-400 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/30 rounded-lg cursor-pointer"
                      onClick={() => deleteMutation.mutate(account.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-light tracking-tight mt-2">{formatAmount(parseFloat(account.currentBalance), account.currency)}</div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

    </div>
  )
}

export default withProtection(AccountsPage)
