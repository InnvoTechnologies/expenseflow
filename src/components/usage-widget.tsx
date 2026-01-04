"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Wallet, 
  CreditCard,
  Users, 
  Zap, 
  TrendingUp, 
  Settings,
  Crown,
  Star
} from "lucide-react"
import { cn } from "@/lib/utils"

interface UsageData {
  plan: {
    name: string
    limits: {
      accounts: number
      transactions: number
    }
    isTrial: boolean
    trialDaysLeft?: number
  }
  usage: {
    accountsUsed: number
    transactionsUsed: number
  }
  billing: {
    nextBillingDate: string
    amount: number
    currency: string
  }
}

interface UsageWidgetProps {
  className?: string
}

export function UsageWidget({ className }: UsageWidgetProps) {
  const [usageData, setUsageData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)

  // Mock data for now - replace with actual API call
  useEffect(() => {
    const mockData: UsageData = {
      plan: {
        name: "Plus",
        limits: {
          accounts: 15,
          transactions: 5000
        },
        isTrial: true,
        trialDaysLeft: 12
      },
      usage: {
        accountsUsed: 8,
        transactionsUsed: 1250
      },
      billing: {
        nextBillingDate: "2024-02-15",
        amount: 19,
        currency: "USD"
      }
    }
    
    setTimeout(() => {
      setUsageData(mockData)
      setLoading(false)
    }, 1000)
  }, [])

  if (loading) {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="h-4 bg-muted rounded animate-pulse" />
            <div className="h-2 bg-muted rounded animate-pulse" />
            <div className="h-2 bg-muted rounded animate-pulse" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!usageData) return null

  const accountsPercentage = (usageData.usage.accountsUsed / usageData.plan.limits.accounts) * 100
  const transactionsPercentage = (usageData.usage.transactionsUsed / usageData.plan.limits.transactions) * 100

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    })
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-medium flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Usage & Plan
          </CardTitle>
          {usageData.plan.isTrial && (
            <Badge variant="secondary" className="text-xs px-1 py-0 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200">
              <Star className="w-2 h-2 mr-1" />
              Trial
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Plan Info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Crown className="w-3 h-3 text-yellow-500" />
            <span className="text-xs font-medium">{usageData.plan.name}</span>
          </div>
          {usageData.plan.isTrial && usageData.plan.trialDaysLeft && (
            <span className="text-xs text-muted-foreground">
              {usageData.plan.trialDaysLeft}d left
            </span>
          )}
        </div>

        {/* Accounts Usage */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1">
              <Wallet className="w-3 h-3" />
              <span>Accounts</span>
            </div>
            <span className="font-medium text-xs">
              {usageData.usage.accountsUsed}/{usageData.plan.limits.accounts}
            </span>
          </div>
          <Progress 
            value={accountsPercentage} 
            className={cn(
              "h-1.5",
              accountsPercentage > 80 && "[&>div]:bg-red-500",
              accountsPercentage > 60 && accountsPercentage <= 80 && "[&>div]:bg-yellow-500"
            )}
          />
          {accountsPercentage > 80 && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {accountsPercentage >= 100 ? 'Limit reached' : 'Near limit'}
            </p>
          )}
        </div>

        {/* Transactions Usage */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1">
              <CreditCard className="w-3 h-3" />
              <span>Transactions</span>
            </div>
            <span className="font-medium text-xs">
              {usageData.usage.transactionsUsed.toLocaleString()}/{usageData.plan.limits.transactions.toLocaleString()}
            </span>
          </div>
          <Progress 
            value={transactionsPercentage} 
            className={cn(
              "h-1.5",
              transactionsPercentage > 80 && "[&>div]:bg-red-500",
              transactionsPercentage > 60 && transactionsPercentage <= 80 && "[&>div]:bg-yellow-500"
            )}
          />
        </div>

        {/* Billing Info - Compact */}
        <div className="pt-1 border-t space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span>Next billing</span>
            <span className="font-medium text-xs">
              {formatDate(usageData.billing.nextBillingDate)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span>Amount</span>
            <span className="font-medium text-xs">
              ${usageData.billing.amount}/{usageData.plan.isTrial ? 'trial' : 'mo'}
            </span>
          </div>
        </div>

        {/* Action Buttons - Compact */}
        <div className="flex gap-1 pt-1">
          <Button size="sm" variant="outline" className="flex-1 text-xs h-7" asChild>
            <Link href="/pricing">
              Upgrade Plan
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
