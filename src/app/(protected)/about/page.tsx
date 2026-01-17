"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Logo } from "@/components/logo"
import {
  Info,
  Globe,
  Wallet,
  ArrowLeftRight,
  LayoutGrid,
  User,
  Brain,
  MessageSquareText,
  BarChart3,
  Bot,
  Activity,
  PieChart,
  Target,
  Repeat,
  ShieldCheck,
  ShieldAlert,
  Database,
  Bell,
  Link2,
  FileDown,
  Tag,
  Users,
  PiggyBank
} from "lucide-react"
import { withProtection } from "@/lib/with-protection"

function AboutPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">About</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 auto-rows-[minmax(140px,auto)] grid-flow-row-dense">
        <Card className="col-span-1 sm:col-span-2 lg:col-span-2 xl:col-span-3 row-span-2 bg-gradient-to-br from-teal-500/10 via-emerald-400/5 to-foreground/5 border-teal-500/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Info className="h-6 w-6 text-teal-500" />
                <CardTitle className="text-xl">ExpenseFlow</CardTitle>
              </div>
              <Logo width={160} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground">
              Multi-currency tracking, AI assistance, powerful analytics, and secure authentication, designed for clarity and control.
            </div>
          </CardContent>
        </Card>

        <Card className="row-span-2 bg-gradient-to-br from-teal-500/10 to-transparent border-teal-500/20">
          <CardContent className="p-6 h-full flex flex-col justify-between">
            <div className="flex items-center gap-3">
              <Globe className="h-6 w-6 text-teal-500" />
              <div className="font-semibold">Multi-Currency Support</div>
            </div>
            <div className="text-sm text-muted-foreground">
              Track any currency with automatic base conversions.
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-500/20">
          <CardContent className="p-6 h-full flex flex-col justify-between">
            <div className="flex items-center gap-3">
              <Wallet className="h-6 w-6 text-emerald-500" />
              <div className="font-semibold">Account Types</div>
            </div>
            <div className="text-sm text-muted-foreground">
              Bank, cash, wallets, cards, savings, and investments.
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-teal-500/10 to-transparent border-teal-500/20">
          <CardContent className="p-6 h-full flex flex-col justify-between">
            <div className="flex items-center gap-3">
              <ArrowLeftRight className="h-6 w-6 text-teal-500" />
              <div className="font-semibold">Transaction Handling</div>
            </div>
            <div className="text-sm text-muted-foreground">Income, expenses, and transfers between accounts.</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-500/20">
          <CardContent className="p-6 h-full flex flex-col justify-between">
            <div className="flex items-center gap-3">
              <LayoutGrid className="h-6 w-6 text-emerald-500" />
              <div className="font-semibold">Category Management</div>
            </div>
            <div className="text-sm text-muted-foreground">Hierarchical categories with custom icons and types.</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-teal-500/10 to-transparent border-teal-500/20">
          <CardContent className="p-6 h-full flex flex-col justify-between">
            <div className="flex items-center gap-3">
              <User className="h-6 w-6 text-teal-500" />
              <div className="font-semibold">Payee Management</div>
            </div>
            <div className="text-sm text-muted-foreground">Track who you pay or receive money from.</div>
          </CardContent>
        </Card>

        <Card className="col-span-1 sm:col-span-2 xl:col-span-3 row-span-2 bg-gradient-to-br from-primary/10 via-teal-500/10 to-emerald-500/10 border-primary/20">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <Brain className="h-6 w-6 text-primary" />
              <CardTitle className="text-xl">AI-Powered Assistance</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
            <div className="flex items-start gap-3 rounded-lg border p-3">
              <MessageSquareText className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <div className="text-sm font-medium">Smart Categorization</div>
                <div className="text-xs text-muted-foreground">Suggests categories based on description and history.</div>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border p-3">
              <Bot className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <div className="text-sm font-medium">Natural Language Input</div>
                <div className="text-xs text-muted-foreground">Parses entries like “Lunch 12.85 AUD at KFC”.</div>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border p-3">
              <BarChart3 className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <div className="text-sm font-medium">Financial Insights</div>
                <div className="text-xs text-muted-foreground">Spending patterns, anomalies, and monthly summaries.</div>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border p-3">
              <Bot className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <div className="text-sm font-medium">Chat Assistant</div>
                <div className="text-xs text-muted-foreground">Query your data and ask about your spending.</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20 xl:col-span-2">
          <CardContent className="p-6 h-full flex flex-col justify-between">
            <div className="flex items-center gap-3">
              <Activity className="h-6 w-6 text-primary" />
              <div className="font-semibold">Real-time Dashboard</div>
            </div>
            <div className="text-sm text-muted-foreground">Overview of net worth, activity, and trends.</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
          <CardContent className="p-6 h-full flex flex-col justify-between">
            <div className="flex items-center gap-3">
              <PieChart className="h-6 w-6 text-primary" />
              <div className="font-semibold">Visual Reports</div>
            </div>
            <div className="text-sm text-muted-foreground">Income vs expenses, category breakdowns, and more.</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
          <CardContent className="p-6 h-full flex flex-col justify-between">
            <div className="flex items-center gap-3">
              <Target className="h-6 w-6 text-primary" />
              <div className="font-semibold">Savings Goals</div>
            </div>
            <div className="text-sm text-muted-foreground">Set targets and track progress over time.</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20 xl:col-span-2">
          <CardContent className="p-6 h-full flex flex-col justify-between">
            <div className="flex items-center gap-3">
              <Repeat className="h-6 w-6 text-primary" />
              <div className="font-semibold">Subscription Tracker</div>
            </div>
            <div className="text-sm text-muted-foreground">Manage recurring payments and billing cycles.</div>
          </CardContent>
        </Card>

        <Card className="col-span-1 sm:col-span-2 lg:col-span-2 xl:col-span-3 row-span-2 bg-gradient-to-br from-emerald-500/10 via-teal-500/10 to-primary/10 border-emerald-500/20">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-6 w-6 text-emerald-500" />
              <CardTitle className="text-xl">Security & Auth</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <div className="text-sm font-medium">Secure Authentication</div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">Better-Auth with Google OAuth.</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-emerald-500" />
                <div className="text-sm font-medium">Bot Protection</div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">Cloudflare Turnstile on auth forms.</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-emerald-500" />
                <div className="text-sm font-medium">Data Privacy</div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">Export and wipe options with control.</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-500/20">
          <CardContent className="p-6 h-full flex flex-col justify-between">
            <div className="flex items-center gap-3">
              <Bell className="h-6 w-6 text-emerald-500" />
              <div className="font-semibold">Reminders</div>
            </div>
            <div className="text-sm text-muted-foreground">Get alerts for bills and upcoming payments.</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
          <CardContent className="p-6 h-full flex flex-col justify-between">
            <div className="flex items-center gap-3">
              <Tag className="h-6 w-6 text-primary" />
              <div className="font-semibold">Tags</div>
            </div>
            <div className="text-sm text-muted-foreground">Organize transactions with flexible labels.</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-teal-500/10 to-transparent border-teal-500/20">
          <CardContent className="p-6 h-full flex flex-col justify-between">
            <div className="flex items-center gap-3">
              <Link2 className="h-6 w-6 text-teal-500" />
              <div className="font-semibold">Integrations</div>
            </div>
            <div className="text-sm text-muted-foreground">Webhooks and API connectivity.</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-teal-500/10 to-transparent border-teal-500/20">
          <CardContent className="p-6 h-full flex flex-col justify-between">
            <div className="flex items-center gap-3">
              <PiggyBank className="h-6 w-6 text-teal-500" />
              <div className="font-semibold">Budgets</div>
            </div>
            <div className="text-sm text-muted-foreground">Plan spending and track adherence per category.</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-500/20">
          <CardContent className="p-6 h-full flex flex-col justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6 text-emerald-500" />
              <div className="font-semibold">Organizations</div>
            </div>
            <div className="text-sm text-muted-foreground">Manage team workspaces and collaboration.</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
          <CardContent className="p-6 h-full flex flex-col justify-between">
            <div className="flex items-center gap-3">
              <FileDown className="h-6 w-6 text-primary" />
              <div className="font-semibold">Data Export</div>
            </div>
            <div className="text-sm text-muted-foreground">Export transactions to CSV or Excel.</div>
          </CardContent>
        </Card>
      </div>
      
    </div>
  )
}

export default withProtection(AboutPage)
