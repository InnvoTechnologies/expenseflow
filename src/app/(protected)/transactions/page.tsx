"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Receipt, ArrowUp, ArrowDown, ArrowLeftRight, Loader2, Trash2, Pencil, Search, Repeat, User, Tag } from "lucide-react"
import { withProtection } from "@/lib/with-protection"
import { TransactionDialog } from "@/components/add-transaction-dialog"
import { format } from "date-fns"
import { useCurrency } from "@/hooks/use-currency"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import posthog from "posthog-js"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

function TransactionsPage() {
  const { formatAmount: formatCurrency } = useCurrency()
  const queryClient = useQueryClient()

  // State
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [type, setType] = useState<string>("ALL")
  const [debouncedSearch, setDebouncedSearch] = useState("")

  // Edit State
  const [transactionToEdit, setTransactionToEdit] = useState<any>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1) // Reset to first page on search
    }, 500)
    return () => clearTimeout(timer)
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ["transactions", page, type, debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      })

      if (type !== "ALL") params.append("type", type)
      if (debouncedSearch) params.append("search", debouncedSearch)

      const res = await apiClient.get(`/transactions?${params.toString()}`)
      return res.data // { data: [], metadata: {} }
    },
  })

  const transactions = data?.data || []
  const metadata = data?.metadata || { total: 0, totalPages: 0 }

  // Delete Transaction Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/transactions/${id}`)
      return res.data
    },
    onSuccess: (_, transactionId) => {
      // Find the deleted transaction for tracking purposes
      const deletedTransaction = transactions.find((t: any) => t.id === transactionId);

      queryClient.invalidateQueries({ queryKey: ["transactions"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      queryClient.invalidateQueries({ queryKey: ["insights"] })
      queryClient.invalidateQueries({ queryKey: ["accounts"] }) // Refresh balances
      toast.success("Transaction deleted successfully")

      // Track transaction deletion
      posthog.capture('transaction_deleted', {
        transaction_type: deletedTransaction?.type,
        transaction_amount: deletedTransaction?.amount,
        transaction_category: deletedTransaction?.category?.name,
      });
    },
    onError: (error) => {
      toast.error(error.message)

      // Track deletion error
      posthog.captureException(error as Error);
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
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="flex flex-wrap gap-2">
              <Button
                variant={type === "ALL" ? "default" : "outline"}
                size="sm"
                onClick={() => { setType("ALL"); setPage(1); }}
              >
                All
              </Button>
              <Button
                variant={type === "EXPENSE" ? "default" : "outline"}
                size="sm"
                onClick={() => { setType("EXPENSE"); setPage(1); }}
              >
                Expense
              </Button>
              <Button
                variant={type === "INCOME" ? "default" : "outline"}
                size="sm"
                onClick={() => { setType("INCOME"); setPage(1); }}
              >
                Income
              </Button>
              <Button
                variant={type === "TRANSFER" ? "default" : "outline"}
                size="sm"
                onClick={() => { setType("TRANSFER"); setPage(1); }}
              >
                Transfer
              </Button>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Transactions</CardTitle>
            <p className="text-sm text-muted-foreground">
              Showing {transactions.length} of {metadata.total}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No transactions found</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your filters or search query
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Group transactions by date */}
              {(Object.entries(
                transactions.reduce((acc: any, transaction: any) => {
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
                            "h-10 w-10 rounded-full flex items-center justify-center bg-muted shrink-0",
                            transaction.type === "EXPENSE" && "bg-red-100 dark:bg-red-900/20",
                            transaction.type === "INCOME" && "bg-green-100 dark:bg-green-900/20",
                            transaction.type === "TRANSFER" && "bg-blue-100 dark:bg-blue-900/20",
                          )}>
                            {getTransactionIcon(transaction.type)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium">{transaction.description || "No description"}</p>

                              <span className={cn(
                                "text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider",
                                transaction.status === "completed" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                                transaction.status === "pending" && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
                                transaction.status === "failed" && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                              )}>
                                {transaction.status}
                              </span>

                              {/* Subscription Badge */}
                              {transaction.subscription && (
                                <Badge variant="secondary" className="text-[10px] h-5 gap-1">
                                  <Repeat className="h-3 w-3" />
                                  Sub
                                </Badge>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-x-2 gap-y-1 text-sm text-muted-foreground mt-0.5">
                              <span>{transaction.category?.name || transaction.type}</span>
                              <span>•</span>
                              <span>{transaction.account?.name}</span>
                              {transaction.toAccount && <span>→ {transaction.toAccount.name}</span>}
                              {transaction.payee && (
                                <>
                                  <span>•</span>
                                  <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {transaction.payee.name}
                                  </span>
                                </>
                              )}
                            </div>

                            {/* Tags */}
                            {transaction.tags && transaction.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {transaction.tags.map((tag: any) => (
                                  <div
                                    key={tag.id}
                                    className="text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-1 border"
                                    style={{
                                      borderColor: tag.color + '40',
                                      backgroundColor: tag.color + '10',
                                      color: tag.color
                                    }}
                                  >
                                    <Tag className="h-3 w-3" />
                                    {tag.name}
                                  </div>
                                ))}
                              </div>
                            )}

                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className={cn(
                              "font-semibold",
                              transaction.type === "EXPENSE" && "text-red-600",
                              transaction.type === "INCOME" && "text-green-600",
                            )}>
                              {formatAmount(transaction.amount, transaction.type)}
                            </p>
                            {transaction.feeAmount && parseFloat(transaction.feeAmount) > 0 && (
                              <p className="text-xs text-muted-foreground/80">
                                Fee: {formatCurrency(parseFloat(transaction.feeAmount))}
                              </p>
                            )}
                          </div>

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

          {/* Pagination */}
          {metadata.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {metadata.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(metadata.totalPages, p + 1))}
                disabled={page === metadata.totalPages}
              >
                Next
              </Button>
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
