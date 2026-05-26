"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, Plus, TrendingUp, TrendingDown, Wallet, Loader2, ArrowUp, ArrowDown, ArrowLeftRight, Receipt, CheckCircle2, Circle } from "lucide-react"
import { withProtection } from "@/lib/with-protection"
import { useAuth } from "@/hooks/use-auth"
import { useCurrency } from "@/hooks/use-currency"
import { useEffect, useState } from "react"
import Link from "next/link"
import { AddAccountDialog } from "@/components/add-account-dialog"
import { TransactionDialog } from "@/components/add-transaction-dialog"
import { useQuery } from "@tanstack/react-query"
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  startOfYear, 
  endOfYear, 
  parseISO,
  subMonths,
  addMonths,
} from "date-fns"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { apiClient } from "@/lib/api-client"

function DashboardPage() {
  const currentHour = new Date().getHours()
  const greeting = currentHour < 12 ? "Good Morning" : currentHour < 18 ? "Good Afternoon" : "Good Evening"
  const { user } = useAuth()
  const { formatAmount } = useCurrency()

  const [viewMode, setViewMode] = useState<"monthly" | "weekly" | "yearly" | "custom">("monthly")
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"))
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString())
  const [customRange, setCustomRange] = useState<{ from: string, to: string }>({
    from: format(startOfMonth(new Date()), "yyyy-MM-dd"),
    to: format(new Date(), "yyyy-MM-dd")
  })

  const [skippedSteps, setSkippedSteps] = useState<string[]>([])

  // Calculate Date Range based on viewMode
  let fromDate: string;
  let toDate: string;
  let displayRange: string;

  if (viewMode === "monthly") {
    const d = parseISO(selectedMonth + "-01");
    fromDate = format(startOfMonth(d), "yyyy-MM-dd");
    toDate = format(endOfMonth(d), "yyyy-MM-dd");
    displayRange = format(d, "MMMM yyyy");
  } else if (viewMode === "weekly") {
    const now = new Date();
    const start = startOfWeek(now, { weekStartsOn: 1 });
    const end = endOfWeek(now, { weekStartsOn: 1 });
    fromDate = format(start, "yyyy-MM-dd");
    toDate = format(end, "yyyy-MM-dd");
    displayRange = `This Week (${format(start, "MMM d")} - ${format(end, "MMM d")})`;
  } else if (viewMode === "yearly") {
    const d = parseISO(selectedYear + "-01-01");
    fromDate = format(startOfYear(d), "yyyy-MM-dd");
    toDate = format(endOfYear(d), "yyyy-MM-dd");
    displayRange = `Full Year ${selectedYear}`;
  } else {
    fromDate = customRange.from || format(new Date(), "yyyy-MM-dd");
    toDate = customRange.to || format(new Date(), "yyyy-MM-dd");
    displayRange = `${format(parseISO(fromDate), "MMM d, yyyy")} - ${format(parseISO(toDate), "MMM d, yyyy")}`;
  }

  // Fetch Dashboard Data
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", fromDate, toDate],
    queryFn: async () => {
      const res = await apiClient.get(`/dashboard?from=${fromDate}&to=${toDate}`)
      return res.data
    }
  })

  useEffect(() => {
    const saved = localStorage.getItem("onboardingSkippedSteps")
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          setSkippedSteps(parsed)
        }
      } catch {
        setSkippedSteps([])
      }
    }
  }, [])

  // Generate years for selector (current and last 5)
  const yearOptions = Array.from({ length: 6 }, (_, i) => {
    const year = (new Date().getFullYear() - i).toString()
    return { value: year, label: year }
  })

  // Generate months for selector
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(new Date(), i)
    return {
      value: format(d, "yyyy-MM"),
      label: format(d, "MMMM yyyy")
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

  const { totalBalance = 0, monthlyIncome = 0, monthlyExpense = 0, recentTransactions = [], accounts = [], onboarding } = data || {}

  const steps = [
    // { key: "profile", title: "Set currency and country", href: "/settings", done: profileStepComplete },
    { key: "categories", title: "Create categories", href: "/categories", done: (onboarding?.categoriesCount || 0) > 0 },
    { key: "payees", title: "Create payees", href: "/payees", done: (onboarding?.payeesCount || 0) > 0 },
    { key: "transaction", title: "Make your first transaction", href: "/transactions", done: (onboarding?.transactionsCount || 0) > 0 },
    { key: "subscriptions", title: "Add subscriptions", href: "/subscriptions", done: (onboarding?.subscriptionsCount || 0) > 0, optional: true },
    { key: "reminders", title: "Add reminders", href: "/reminders", done: (onboarding?.remindersCount || 0) > 0, optional: true },
    { key: "tags", title: "Add tags", href: "/tags", done: (onboarding?.tagsCount || 0) > 0 },
  ]

  const totalSteps = steps.length
  const completedSteps = steps.filter(step => step.done || (step.optional && skippedSteps.includes(step.key))).length
  const progressValue = Math.round((completedSteps / totalSteps) * 100)

  const toggleSkip = (key: string, shouldSkip: boolean) => {
    const next = shouldSkip
      ? Array.from(new Set([...skippedSteps, key]))
      : skippedSteps.filter(step => step !== key)
    setSkippedSteps(next)
    localStorage.setItem("onboardingSkippedSteps", JSON.stringify(next))
  }

  return (
    <div className="space-y-6">
      {/* Header with Range Selector */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-tight">
            {greeting}, {user?.name || "User"}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Financial overview for {displayRange}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>

          {viewMode === "monthly" && (
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={() => {
                const d = parseISO(selectedMonth + "-01")
                setSelectedMonth(format(subMonths(d, 1), "yyyy-MM"))
              }}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[160px]">
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
                const d = parseISO(selectedMonth + "-01")
                setSelectedMonth(format(addMonths(d, 1), "yyyy-MM"))
              }}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {viewMode === "yearly" && (
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={() => {
                setSelectedYear((parseInt(selectedYear) - 1).toString())
              }}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => {
                setSelectedYear((parseInt(selectedYear) + 1).toString())
              }}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {viewMode === "custom" && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                className="w-[140px]"
                value={customRange.from}
                onChange={(e) => setCustomRange(prev => ({ ...prev, from: e.target.value }))}
              />
              <span className="text-muted-foreground">-</span>
              <Input
                type="date"
                className="w-[140px]"
                value={customRange.to}
                onChange={(e) => setCustomRange(prev => ({ ...prev, to: e.target.value }))}
              />
            </div>
          )}
        </div>
      </div>

      {completedSteps < totalSteps && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Getting started</CardTitle>
                <p className="text-sm text-muted-foreground">Complete these steps to get more out of ExpenseFlow</p>
              </div>
              <div className="text-sm text-muted-foreground">{completedSteps}/{totalSteps}</div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={progressValue} />
            <div className="space-y-3">
              {steps.map(step => {
                const isSkipped = step.optional && skippedSteps.includes(step.key)
                const isDone = step.done || isSkipped
                return (
                  <div key={step.key} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      {isDone ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div className="space-y-1">
                        <p className={cn("font-medium", isDone && "text-muted-foreground line-through")}>{step.title}</p>
                        <div className="flex items-center gap-2">
                          {step.optional && !isDone && <Badge variant="outline">Optional</Badge>}
                          {isSkipped && <Badge variant="secondary">Skipped</Badge>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!step.done && !isSkipped && (
                        <Button variant="outline" size="sm" asChild>
                          <Link href={step.href}>Start</Link>
                        </Button>
                      )}
                      {step.optional && !step.done && !isSkipped && (
                        <Button variant="ghost" size="sm" onClick={() => toggleSkip(step.key, true)}>
                          Skip
                        </Button>
                      )}
                      {isSkipped && (
                        <Button variant="ghost" size="sm" onClick={() => toggleSkip(step.key, false)}>
                          Unskip
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-none dark:bg-[#121214] bg-zinc-50 rounded-[24px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Total Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-light tracking-tight">{formatAmount(totalBalance)}</div>
            <p className="text-xs text-zinc-500 mt-2">Across all accounts</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-none dark:bg-[#121214] bg-zinc-50 rounded-[24px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Income</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-light tracking-tight text-green-500 dark:text-green-400">{formatAmount(monthlyIncome)}</div>
            <div className="flex items-center mt-2">
              <TrendingUp className="h-3 w-3 text-green-500 mr-1.5" />
              <span className="text-xs font-medium text-zinc-500">{displayRange}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-none dark:bg-[#121214] bg-zinc-50 rounded-[24px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Expense</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-light tracking-tight text-red-500 dark:text-red-400">{formatAmount(monthlyExpense)}</div>
            <div className="flex items-center mt-2">
              <TrendingDown className="h-3 w-3 text-red-500 mr-1.5" />
              <span className="text-xs font-medium text-zinc-500">{displayRange}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Accounts Overview */}
      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="px-0 pt-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-medium">Accounts</CardTitle>
            <Button variant="ghost" size="sm" asChild className="rounded-full text-xs font-semibold text-zinc-500">
              <Link href="/accounts">
                View All
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 dark:bg-[#121214] rounded-[24px]">
              <Wallet className="h-8 w-8 text-zinc-500 mb-3" />
              <p className="text-sm text-zinc-500">No accounts yet</p>
              <AddAccountDialog>
                <Button variant="outline" size="sm" className="mt-4 rounded-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Account
                </Button>
              </AddAccountDialog>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {accounts.map((acc: any) => (
                <Card key={acc.id} className="border-none shadow-none dark:bg-[#121214] bg-zinc-50 rounded-[20px]">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-sm font-medium text-zinc-400 uppercase tracking-wider">{acc.name}</CardTitle>
                        <p className="text-[10px] text-zinc-600 capitalize mt-1">{acc.type.replace('_', ' ').toLowerCase()}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-light tracking-tight">{formatAmount(acc.currentBalance)}</div>
                  </CardContent>
                </Card>
              ))}
              <div className="flex items-center justify-center min-h-[100px] border border-dashed dark:border-white/10 rounded-[20px]">
                <AddAccountDialog>
                  <Button variant="ghost" className="h-full w-full rounded-[20px] text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
                    <Plus className="mr-2 h-4 w-4" /> Add Account
                  </Button>
                </AddAccountDialog>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Category Breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Income by Category */}
        <Card className="h-full border-none shadow-none bg-transparent">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-lg font-medium">Income by Category</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {!data?.incomeByCategory || data.incomeByCategory.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="mb-2">No income data available</p>
                <p className="text-sm">Income categories will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.incomeByCategory.map((cat: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-4 rounded-[20px] dark:bg-[#121214] bg-zinc-50 border border-transparent dark:border-white/5 hover:dark:bg-white/5 transition-all">
                    <div className="flex items-center gap-4">
                      <div
                        className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: cat.color + '20', color: cat.color }}
                      >
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{cat.name}</p>
                        <div className="w-24 h-1 bg-muted rounded-full mt-2 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${(cat.amount / (data.incomeByCategory[0].amount || 1)) * 100}%`,
                              backgroundColor: cat.color
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="font-medium text-green-500 dark:text-green-400 text-sm ml-2">
                      +{formatAmount(cat.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expenses by Category */}
        <Card className="h-full border-none shadow-none bg-transparent">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-lg font-medium">Expenses by Category</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {!data?.expensesByCategory || data.expensesByCategory.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="mb-2">No expense data available</p>
                <p className="text-sm">Expense categories will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.expensesByCategory.map((cat: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-4 rounded-[20px] dark:bg-[#121214] bg-zinc-50 border border-transparent dark:border-white/5 hover:dark:bg-white/5 transition-all">
                    <div className="flex items-center gap-4">
                      <div
                        className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: cat.color + '20', color: cat.color }}
                      >
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{cat.name}</p>
                        <div className="w-24 h-1 bg-muted rounded-full mt-2 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${(cat.amount / (data.expensesByCategory[0].amount || 1)) * 100}%`,
                              backgroundColor: cat.color
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="font-medium text-red-500 dark:text-red-400 text-sm ml-2">
                      -{formatAmount(cat.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      {/* Recent Transactions, Top Payees & Top Tags */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Recent Transactions */}
        <Card className="h-full col-span-1 md:col-span-2 lg:col-span-1 border-none shadow-none bg-transparent">
          <CardHeader className="px-0 pt-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-medium">Recent Transactions</CardTitle>
              <TransactionDialog>
                <Button variant="outline" size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add
                </Button>
              </TransactionDialog>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
              <div className="space-y-3">
              {recentTransactions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="mb-2">No transactions found</p>
                  <p className="text-sm">Press the &quot;+&quot; button to add your first transaction</p>
                </div>
              ) : (
                recentTransactions.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between p-4 rounded-[20px] dark:bg-[#121214] bg-zinc-50 border border-transparent dark:border-white/5 hover:dark:bg-white/5 transition-all">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                        t.type === "EXPENSE" ? "bg-red-100 dark:bg-red-900/20 text-red-500" :
                        t.type === "INCOME" ? "bg-green-100 dark:bg-green-900/20 text-green-500" :
                        "bg-blue-100 dark:bg-blue-900/20 text-blue-500"
                      )}>
                        {getTransactionIcon(t.type)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{t.description || "No description"}</p>
                        <p className="text-xs text-zinc-500 truncate mt-0.5">
                          {format(new Date(t.date), "MMM d")} • {t.category?.name || t.type}
                        </p>
                      </div>
                    </div>
                    <div className={cn(
                      "font-medium text-sm whitespace-nowrap ml-2",
                      t.type === "EXPENSE" && "text-red-500 dark:text-red-400",
                      t.type === "INCOME" && "text-green-500 dark:text-green-400",
                    )}>
                      {t.type === "EXPENSE" ? "-" : t.type === "INCOME" ? "+" : ""}{formatAmount(t.amount)}
                    </div>
                  </div>
                ))
              )}

              {recentTransactions.length > 0 && (
                <div className="pt-2 text-center">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/transactions">View All</Link>
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Payees */}
        <Card className="h-full border-none shadow-none bg-transparent">
          <CardHeader className="px-0 pt-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-medium">Top Payees</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/payees">
                  View All
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {!data?.topPayees || data.topPayees.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="mb-2">No payee data available</p>
                <p className="text-sm">Top spending recipients will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.topPayees.map((payee: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-4 rounded-[20px] dark:bg-[#121214] bg-zinc-50 border border-transparent dark:border-white/5 hover:dark:bg-white/5 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full flex items-center justify-center bg-zinc-200 dark:bg-white/10 font-medium shrink-0 text-sm">
                        {payee.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{payee.name}</p>
                        <div className="w-24 h-1 bg-muted rounded-full mt-2 overflow-hidden">
                          <div
                            className="h-full bg-zinc-500 rounded-full"
                            style={{ width: `${(payee.amount / (data.topPayees[0].amount || 1)) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="font-medium text-red-500 dark:text-red-400 text-sm ml-2">
                      {formatAmount(payee.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Tags */}
        <Card className="h-full border-none shadow-none bg-transparent">
          <CardHeader className="px-0 pt-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-medium">Top Tags</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/tags">
                  View All
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {!data?.topTags || data.topTags.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="mb-2">No tag data available</p>
                <p className="text-sm">Tags with most spending will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.topTags.map((tag: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-4 rounded-[20px] dark:bg-[#121214] bg-zinc-50 border border-transparent dark:border-white/5 hover:dark:bg-white/5 transition-all">
                    <div className="flex items-center gap-4">
                      <div
                        className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: tag.color + '20', color: tag.color }}
                      >
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{tag.name}</p>
                        <div className="w-24 h-1 bg-muted rounded-full mt-2 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${(tag.amount / (data.topTags[0].amount || 1)) * 100}%`,
                              backgroundColor: tag.color
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="font-medium text-red-500 dark:text-red-400 text-sm ml-2">
                      {formatAmount(tag.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Subscriptions */}
        <Card className="h-full border-none shadow-none bg-transparent">
          <CardHeader className="px-0 pt-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-medium">Top Subscriptions</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/subscriptions">
                  View All
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {!data?.topSubscriptions || data.topSubscriptions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="mb-2">No subscription data</p>
                <p className="text-sm"> recurring expenses will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.topSubscriptions.map((sub: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-4 rounded-[20px] dark:bg-[#121214] bg-zinc-50 border border-transparent dark:border-white/5 hover:dark:bg-white/5 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full flex items-center justify-center bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold shrink-0">
                        {sub.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{sub.name}</p>
                        <div className="w-24 h-1 bg-muted rounded-full mt-2 overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${(sub.amount / (data.topSubscriptions[0].amount || 1)) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="font-medium text-red-500 dark:text-red-400 text-sm ml-2">
                      {formatAmount(sub.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div >
  )
}

export default withProtection(DashboardPage)
