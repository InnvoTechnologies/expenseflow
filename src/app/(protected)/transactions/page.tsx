"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Receipt, ArrowUp, ArrowDown, ArrowLeftRight, Loader2, Trash2, Pencil } from "lucide-react"
import { withProtection } from "@/lib/with-protection"
import { TransactionDialog } from "@/components/add-transaction-dialog"
import { format } from "date-fns"
import { useCurrency } from "@/hooks/use-currency"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"

function TransactionsPage() {
  const { formatAmount: formatCurrency } = useCurrency()
  const queryClient = useQueryClient()
  const [filterType, setFilterType] = useState<string>("ALL")

  // Edit State
  const [transactionToEdit, setTransactionToEdit] = useState<any>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const res = await apiClient.get("/transactions")
      return res.data
    },
  })

  // Delete Transaction Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/transactions/${id}`)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      queryClient.invalidateQueries({ queryKey: ["insights"] })
      queryClient.invalidateQueries({ queryKey: ["accounts"] }) // Refresh balances
      toast.success("Transaction deleted successfully")
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "EXPENSE":
        return <ArrowDown className="h-4 w-4 text-red-500" />
      case "INCOME":
        return <ArrowUp className="h-4 w-4 text-green-500" />
      case "TRANSFER":
        return <ArrowLeftRight className="h-4 w-4 text-blue-500" />
      default:
        return <Receipt className="h-4 w-4" />
    }
  }

  const formatAmount = (amount: string | number, type: string) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
    const sign = type === "EXPENSE" ? "-" : type === "INCOME" ? "+" : ""
    const formatted = formatCurrency(Math.abs(numAmount))
    return `${sign}${formatted}`
  }

  const filteredTransactions = transactions.filter((t: any) => {
    if (filterType === "ALL") return true
    return t.type === filterType
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Transactions</h1>
          <p className="text-muted-foreground">View and manage all your transactions</p>
        </div>
        <TransactionDialog>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Transaction
          </Button>
        </TransactionDialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <Button
              variant={filterType === "ALL" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterType("ALL")}
            >
              All
            </Button>
            <Button
              variant={filterType === "EXPENSE" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterType("EXPENSE")}
            >
              Expense
            </Button>
            <Button
              variant={filterType === "INCOME" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterType("INCOME")}
            >
              Income
            </Button>
            <Button
              variant={filterType === "TRANSFER" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterType("TRANSFER")}
            >
              Transfer
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Transactions List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No transactions found</h3>
              <p className="text-muted-foreground mb-4">
                {filterType === "ALL"
                  ? "Start tracking your expenses and income by adding your first transaction"
                  : `No ${filterType.toLowerCase()} transactions found`}
              </p>
              <TransactionDialog>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Transaction
                </Button>
              </TransactionDialog>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Group transactions by date */}
              {(Object.entries(
                filteredTransactions.reduce((acc: any, transaction: any) => {
                  const date = format(new Date(transaction.date), "MMM d, yyyy")
                  if (!acc[date]) acc[date] = []
                  acc[date].push(transaction)
                  return acc
                }, {} as Record<string, any[]>)
              ) as [string, any[]][]).map(([date, dateTransactions]) => (
                <div key={date}>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">{date}</h3>
                  <div className="space-y-2">
                    {dateTransactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors group relative"
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "h-10 w-10 rounded-full flex items-center justify-center bg-muted",
                            transaction.type === "EXPENSE" && "bg-red-100 dark:bg-red-900/20",
                            transaction.type === "INCOME" && "bg-green-100 dark:bg-green-900/20",
                            transaction.type === "TRANSFER" && "bg-blue-100 dark:bg-blue-900/20",
                          )}>
                            {getTransactionIcon(transaction.type)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{transaction.description || "No description"}</p>
                              <span className={cn(
                                "text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider",
                                transaction.status === "completed" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                                transaction.status === "pending" && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
                                transaction.status === "failed" && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                              )}>
                                {transaction.status}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {transaction.category?.name || transaction.type} • {transaction.account?.name}
                              {transaction.toAccount && ` → ${transaction.toAccount.name}`}
                              {transaction.feeAmount && parseFloat(transaction.feeAmount) > 0 && (
                                <span className="ml-2 text-xs text-muted-foreground/80">
                                  (Fee: {formatCurrency(parseFloat(transaction.feeAmount))})
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <p className={cn(
                            "font-semibold",
                            transaction.type === "EXPENSE" && "text-red-600",
                            transaction.type === "INCOME" && "text-green-600",
                          )}>
                            {formatAmount(transaction.amount, transaction.type)}
                          </p>

                          <div className="flex items-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:text-blue-500"
                              onClick={() => {
                                setTransactionToEdit(transaction)
                                setIsEditDialogOpen(true)
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                              onClick={() => {
                                if (confirm("Are you sure you want to delete this transaction? This will revert the balance changes.")) {
                                  deleteMutation.mutate(transaction.id)
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog - Controlled */}
      <TransactionDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        transactionToEdit={transactionToEdit}
      />
    </div>
  )
}

export default withProtection(TransactionsPage)
