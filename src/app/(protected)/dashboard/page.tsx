"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronLeft, ChevronRight, Plus, TrendingUp, TrendingDown, Wallet, Loader2, ArrowUp, ArrowDown, ArrowLeftRight, Receipt } from "lucide-react"
import { withProtection } from "@/lib/with-protection"
import { useAuth } from "@/hooks/use-auth"
import { useCurrency } from "@/hooks/use-currency"
import { useState } from "react"
import Link from "next/link"
import { AddAccountDialog } from "@/components/add-account-dialog"
import { TransactionDialog } from "@/components/add-transaction-dialog"
import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"

function DashboardPage() {
  const currentHour = new Date().getHours()
  const greeting = currentHour < 12 ? "Good Morning" : currentHour < 18 ? "Good Afternoon" : "Good Evening"
  const { user } = useAuth()
  const { formatAmount } = useCurrency()

  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))

  // Format month for display
  const monthDisplay = new Date(selectedMonth + "-01").toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  

  // Fetch Dashboard Data
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", selectedMonth],
    queryFn: async () => {
      const res = await apiClient.get(`/dashboard?month=${selectedMonth}`)
      return res.data
    }
  })

  // Generate last 12 months for selector
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    return {
      value: d.toISOString().slice(0, 7),
      label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    }
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

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const { totalBalance = 0, monthlyIncome = 0, monthlyExpense = 0, recentTransactions = [], accounts = [] } = data || {}

  return (
    <div className="space-y-6">
      {/* Header with Month Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {greeting}, {user?.name || "User"}
          </h1>
          <p className="text-muted-foreground">Here's your financial overview for {monthDisplay}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => {
            const date = new Date(selectedMonth + "-01")
            date.setMonth(date.getMonth() - 1)
            setSelectedMonth(date.toISOString().slice(0, 7))
          }}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => {
            const date = new Date(selectedMonth + "-01")
            date.setMonth(date.getMonth() + 1)
            setSelectedMonth(date.toISOString().slice(0, 7))
          }}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatAmount(totalBalance)}</div>
            <p className="text-sm text-muted-foreground mt-1">Across all accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Income</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{formatAmount(monthlyIncome)}</div>
            <div className="flex items-center mt-1">
              <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
              <span className="text-xs text-muted-foreground">{monthDisplay}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Expense</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{formatAmount(monthlyExpense)}</div>
            <div className="flex items-center mt-1">
              <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
              <span className="text-xs text-muted-foreground">{monthDisplay}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Accounts Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Accounts</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href="/accounts">
                View All
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <Card className="border-dashed shadow-none">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <Wallet className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No accounts yet</p>
                <AddAccountDialog>
                  <Button variant="outline" size="sm" className="mt-4">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Account
                  </Button>
                </AddAccountDialog>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {accounts.map((acc: any) => (
                <Card key={acc.id} className="shadow-sm">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base font-medium">{acc.name}</CardTitle>
                        <p className="text-xs text-muted-foreground capitalize">{acc.type.replace('_', ' ').toLowerCase()}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold">{formatAmount(acc.currentBalance)}</div>
                  </CardContent>
                </Card>
              ))}
              <Card className="border-dashed shadow-none flex items-center justify-center min-h-[100px]">
                <AddAccountDialog>
                  <Button variant="ghost" className="h-full w-full">
                    <Plus className="mr-2 h-4 w-4" /> Add Account
                  </Button>
                </AddAccountDialog>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Transactions & Top Payees Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <Card className="h-full">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Transactions</CardTitle>
              <TransactionDialog>
                <Button variant="outline" size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Transaction
                </Button>
              </TransactionDialog>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentTransactions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="mb-2">No transactions found</p>
                  <p className="text-sm">Press the "+" button to add your first transaction</p>
                </div>
              ) : (
                recentTransactions.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center bg-muted",
                        t.type === "EXPENSE" && "bg-red-100 dark:bg-red-900/20",
                        t.type === "INCOME" && "bg-green-100 dark:bg-green-900/20",
                        t.type === "TRANSFER" && "bg-blue-100 dark:bg-blue-900/20",
                      )}>
                        {getTransactionIcon(t.type)}
                      </div>
                      <div>
                        <p className="font-medium line-clamp-1">{t.description || "No description"}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(t.date), "MMM d")} • {t.category?.name || t.type} • {t.account?.name}
                        </p>
                      </div>
                    </div>
                    <div className={cn(
                      "font-semibold whitespace-nowrap",
                      t.type === "EXPENSE" && "text-red-600",
                      t.type === "INCOME" && "text-green-600",
                    )}>
                      {t.type === "EXPENSE" ? "-" : t.type === "INCOME" ? "+" : ""}{formatAmount(t.amount)}
                    </div>
                  </div>
                ))
              )}

              {recentTransactions.length > 0 && (
                <div className="pt-2 text-center">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/transactions">View All Transactions</Link>
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Payees */}
        <Card className="h-full">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Top Payees</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/payees">
                  View All
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!data?.topPayees || data.topPayees.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="mb-2">No payee data available</p>
                <p className="text-sm">Top spending recipients will appear here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {data.topPayees.map((payee: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full flex items-center justify-center bg-primary/10 text-primary font-bold">
                        {payee.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{payee.name}</p>
                        <div className="w-24 h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full" 
                            style={{ width: `${(payee.amount / (data.topPayees[0].amount || 1)) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="font-semibold text-red-600">
                      {formatAmount(payee.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default withProtection(DashboardPage)
