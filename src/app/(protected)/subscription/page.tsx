"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  Crown, 
  Calendar, 
  CreditCard, 
  Settings, 
  TrendingUp, 
  Clock, 
  Users, 
  Phone, 
  Zap,
  Star,
  AlertTriangle
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface SubscriptionData {
  plan: {
    name: string
    description: string
    price: number
    currency: string
    billingInterval: string
    isTrial: boolean
    trialDaysLeft?: number
  }
  usage: {
    minutesUsed: number
    minutesIncluded: number
    concurrentCallsUsed: number
    concurrentCallsIncluded: number
    phoneNumbersUsed: number
    boostedQueuingUsed: boolean
  }
  billing: {
    nextBillingDate: string
    amount: number
    currency: string
    status: string
  }
  limits: {
    extraMinutePrice: number
    extraConcurrentCallPrice: number
    phoneNumberPrice: number
    boostedQueuingPrice: number
  }
}

export default function SubscriptionPage() {
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)

  // Mock data for now - replace with actual API call
  useEffect(() => {
    const mockData: SubscriptionData = {
      plan: {
        name: "Pro",
        description: "For growing businesses",
        price: 450,
        currency: "USD",
        billingInterval: "monthly",
        isTrial: true,
        trialDaysLeft: 12
      },
      usage: {
        minutesUsed: 1250,
        minutesIncluded: 2000,
        concurrentCallsUsed: 8,
        concurrentCallsIncluded: 25,
        phoneNumbersUsed: 3,
        boostedQueuingUsed: false
      },
      billing: {
        nextBillingDate: "2024-02-15",
        amount: 450,
        currency: "USD",
        status: "active"
      },
      limits: {
        extraMinutePrice: 13,
        extraConcurrentCallPrice: 700,
        phoneNumberPrice: 150,
        boostedQueuingPrice: 50000
      }
    }
    
    setTimeout(() => {
      setSubscriptionData(mockData)
      setLoading(false)
    }, 1000)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="space-y-6">
            <div className="h-8 bg-muted rounded animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 bg-muted rounded animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!subscriptionData) return null

  const minutesPercentage = (subscriptionData.usage.minutesUsed / subscriptionData.usage.minutesIncluded) * 100
  const callsPercentage = (subscriptionData.usage.concurrentCallsUsed / subscriptionData.usage.concurrentCallsIncluded) * 100

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'
      case 'trial': return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
      case 'past_due': return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200'
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Subscription Management</h1>
              <p className="text-muted-foreground mt-2">
                Manage your plan, usage, and billing
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link href="/pricing">Change Plan</Link>
              </Button>
              <Button variant="outline">
                <Settings className="w-4 h-4 mr-2" />
                Billing Settings
              </Button>
            </div>
          </div>

          {/* Current Plan */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Crown className="w-6 h-6 text-yellow-500" />
                  <div>
                    <CardTitle className="text-xl">{subscriptionData.plan.name}</CardTitle>
                    <CardDescription>{subscriptionData.plan.description}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={getStatusColor(subscriptionData.billing.status)}>
                    {subscriptionData.billing.status === 'active' ? 'Active' : 
                     subscriptionData.plan.isTrial ? 'Trial' : subscriptionData.billing.status}
                  </Badge>
                  {subscriptionData.plan.isTrial && subscriptionData.plan.trialDaysLeft && (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                      <Star className="w-3 h-3 mr-1" />
                      {subscriptionData.plan.trialDaysLeft} days left
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <div className="text-2xl font-bold">
                    ${subscriptionData.plan.price}/{subscriptionData.plan.billingInterval}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Billed {subscriptionData.plan.billingInterval}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Next billing</div>
                  <div className="font-medium">
                    {formatDate(subscriptionData.billing.nextBillingDate)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Status</div>
                  <div className="font-medium capitalize">
                    {subscriptionData.billing.status}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Usage Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Minutes Usage */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Minutes Used
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span>This month</span>
                    <span className="font-medium">
                      {subscriptionData.usage.minutesUsed.toLocaleString()} / {subscriptionData.usage.minutesIncluded.toLocaleString()}
                    </span>
                  </div>
                  <Progress 
                    value={minutesPercentage} 
                    className="h-2"
                    style={{
                      '--progress-background': minutesPercentage > 80 ? '#ef4444' : minutesPercentage > 60 ? '#f59e0b' : undefined
                    } as React.CSSProperties}
                  />
                  {minutesPercentage > 80 && (
                    <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                      <AlertTriangle className="w-3 h-3" />
                      {minutesPercentage > 100 ? 'Over limit' : 'Near limit'}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Extra minutes: ${(subscriptionData.limits.extraMinutePrice / 100).toFixed(2)} each
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Concurrent Calls */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Concurrent Calls
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span>Currently using</span>
                    <span className="font-medium">
                      {subscriptionData.usage.concurrentCallsUsed} / {subscriptionData.usage.concurrentCallsIncluded}
                    </span>
                  </div>
                  <Progress 
                    value={callsPercentage} 
                    className="h-2"
                    style={{
                      '--progress-background': callsPercentage > 80 ? '#ef4444' : callsPercentage > 60 ? '#f59e0b' : undefined
                    } as React.CSSProperties}
                  />
                  <div className="text-xs text-muted-foreground">
                    Extra calls: ${(subscriptionData.limits.extraConcurrentCallPrice / 100).toFixed(0)} each
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Additional Resources */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Additional Resources
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      <span>Phone Numbers</span>
                    </div>
                    <span className="font-medium">{subscriptionData.usage.phoneNumbersUsed}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    New numbers: ${(subscriptionData.limits.phoneNumberPrice / 100).toFixed(2)} each
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      <span>Boosted Queuing</span>
                    </div>
                    <span className="font-medium">
                      {subscriptionData.usage.boostedQueuingUsed ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {subscriptionData.limits.boostedQueuingPrice > 0 
                      ? `$${(subscriptionData.limits.boostedQueuingPrice / 100).toFixed(0)}/month`
                      : 'Included in plan'
                    }
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Billing History */}
          <Card>
            <CardHeader>
              <CardTitle>Billing History</CardTitle>
              <CardDescription>
                Your recent invoices and payment history
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Billing history will appear here once you have active subscriptions.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
