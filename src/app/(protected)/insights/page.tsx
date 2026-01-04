"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react"
import { withProtection } from "@/lib/with-protection"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useCurrency } from "@/hooks/use-currency"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Sankey } from 'recharts';

function InsightsPage() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const { formatAmount } = useCurrency()
  const SankeyTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const p = payload[0]?.payload || {}
    const title =
      p?.source && p?.target
        ? `${p.source?.name || ""} → ${p.target?.name || ""}`
        : p?.name || "Cash Flow"
    const value = typeof payload[0]?.value === "number" ? payload[0]?.value : p?.value
    let baseTotal = 0
    if (p?.source?.side === "left") baseTotal = incomeTotal
    else if (p?.target?.side === "right") baseTotal = expenseTotal
    else if (p?.target?.name === "Surplus") baseTotal = incomeTotal
    const pct = baseTotal ? ((Number(value || 0) / baseTotal) * 100) : 0
    return (
      <div className="rounded-md border bg-popover text-popover-foreground px-2 py-1 text-xs">
        <div className="font-medium">{title}</div>
        <div>{formatAmount(Number(value || 0))} • {pct.toFixed(1)}%</div>
      </div>
    )
  }
  const SankeyNode = (props: any) => {
    const { x, y, width, height, payload } = props
    const showLabel = height > 28
    const isLeft = payload?.side === "left"
    const isRight = payload?.side === "right"
    const isCenter = payload?.side === "center"
    const labelX = isLeft ? x - 8 : isRight ? x + width + 8 : x + width / 2
    const labelY = isCenter ? y - 6 : y + height / 2
    const anchor = isLeft ? "end" : isRight ? "start" : "middle"
    let nodeValue = 0
    let baseTotal = 0
    if (isLeft) {
      nodeValue = incomeByCategory.find((c: any) => c.name === payload?.name)?.value || 0
      baseTotal = incomeTotal
    } else if (isRight) {
      nodeValue = expenseByCategory.find((c: any) => c.name === payload?.name)?.value || 0
      baseTotal = expenseTotal
    } else {
      nodeValue = incomeTotal
      baseTotal = incomeTotal
    }
    const pct = baseTotal ? ((nodeValue / baseTotal) * 100) : 0
    return (
      <g>
        <rect x={x} y={y} width={width} height={height} fill={payload?.fill || "hsl(var(--primary))"} rx={6} />
        {showLabel && (
          <text x={labelX} y={labelY} textAnchor={anchor} dominantBaseline="middle" className="fill-foreground text-[10px]">
            {payload?.name} • {pct.toFixed(1)}%
          </text>
        )}
      </g>
    )
  }

  const { data, isLoading } = useQuery({
    queryKey: ["insights", selectedMonth],
    queryFn: async () => {
      const res = await fetch(`/api/insights?month=${selectedMonth}`)
      if (!res.ok) throw new Error("Failed to fetch insights")
      return res.json()
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

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const { expenseByCategory = [], incomeByCategory = [], history = [] } = data || {}
  const cashflowLabel = "Cash Flow"
  const incomeTotal = incomeByCategory.reduce((sum: number, c: any) => sum + (c.value || 0), 0)
  const expenseTotal = expenseByCategory.reduce((sum: number, c: any) => sum + (c.value || 0), 0)
  const hasSurplus = incomeTotal > expenseTotal
  const surplusValue = hasSurplus ? incomeTotal - expenseTotal : 0

  const sankeyNodes = [
    ...incomeByCategory.map((c: any) => ({ name: c.name, fill: c.fill, side: "left" })),
    { name: cashflowLabel, fill: "hsl(var(--primary))", side: "center" },
    ...expenseByCategory.map((c: any) => ({ name: c.name, fill: c.fill, side: "right" })),
    ...(hasSurplus ? [{ name: "Surplus", fill: "#16a34a", side: "right" }] : []),
  ]
  const centerIndex = incomeByCategory.length
  const expenseStartIndex = centerIndex + 1
  const sankeyLinks = [
    ...incomeByCategory.map((c: any, i: number) => ({
      source: i,
      target: centerIndex,
      value: c.value,
      color: c.fill,
    })),
    ...expenseByCategory.map((c: any, j: number) => ({
      source: centerIndex,
      target: expenseStartIndex + j,
      value: c.value,
      color: c.fill,
    })),
    ...(hasSurplus
      ? [
          {
            source: centerIndex,
            target: sankeyNodes.length - 1,
            value: surplusValue,
            color: "#16a34a",
          },
        ]
      : []),
  ]

  return (
    <div className="space-y-6">
      {/* Header with Month Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Insights</h1>
          <p className="text-muted-foreground">Analyze your spending patterns and trends</p>
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

      {/* Cashflow Sankey - Full Width */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Cashflow</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {sankeyNodes.length <= 1 ? (
            <div className="h-96 flex items-center justify-center text-muted-foreground">
              No cashflow data for this month
            </div>
          ) : (
            <div className="h-96 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <Sankey
                  data={{ nodes: sankeyNodes, links: sankeyLinks }}
                  nodePadding={20}
                  nodeWidth={14}
                  margin={{ left: 20, right: 120, top: 20, bottom: 20 }}
                  node={<SankeyNode />}
                >
                  <Tooltip content={<SankeyTooltip />} />
                </Sankey>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Income vs Expense Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Income vs Expense (Yearly Overview)</CardTitle>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={history}
                margin={{
                  top: 20,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="month"
                  tickFormatter={(value) => new Date(value + "-01").toLocaleDateString('en-US', { month: 'short' })}
                />
                <YAxis
                  tickFormatter={(value) => formatAmount(value).replace(/[^0-9.,]/g, '')} // Simplified formatter for axis
                />
                <Tooltip
                  formatter={(value: number) => formatAmount(value)}
                  labelFormatter={(label) => new Date(label + "-01").toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                />
                <Legend />
                <Bar dataKey="income" name="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Expense Breakdown */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Expense Breakdown</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {expenseByCategory.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No expense data for this month
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseByCategory}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {expenseByCategory.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatAmount(value)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Income Breakdown */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Income Breakdown</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {incomeByCategory.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No income data for this month
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={incomeByCategory}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {incomeByCategory.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatAmount(value)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Insights Description Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>AI Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-muted-foreground">
            <p>Spending Analysis: You spent {formatAmount(data?.monthlyExpense || 0)} this month.</p>
            {/* Simple insight logic */}
            {expenseByCategory.length > 0 && (
              <p>Top Spending Category: <span className="font-semibold text-foreground">{expenseByCategory[0].name}</span> ({formatAmount(expenseByCategory[0].value)})</p>
            )}
            {data?.monthlyIncome > 0 && (
              <p>Savings Rate: <span className="font-semibold text-foreground">{((data.monthlyIncome - data.monthlyExpense) / data.monthlyIncome * 100).toFixed(1)}%</span></p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default withProtection(InsightsPage)
