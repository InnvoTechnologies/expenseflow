"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Check, Star, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { SubscriptionDialog } from "@/components/subscription-dialog"

interface Plan {
  name: string
  description: string
  price: { monthly: number | string; yearly: number | string }
  features: string[]
  limits: {
    accounts: number
    transactions: number
    categories: number
    exports: number
    extraAccountPrice: number
    extraExportPrice: number
  }
  popular: boolean
  cta: string
  isCustom?: boolean
}

const plans: Plan[] = [
  {
    name: "Starter",
    description: "Perfect for personal budgeting",
    price: { monthly: 9, yearly: 90 },
    features: [
      "Track up to 5 bank accounts",
      "Monthly budget & spending insights",
      "Receipt capture & categorization",
      "Basic CSV export",
      "Email support"
    ],
    limits: {
      accounts: 5,
      transactions: 1000,
      categories: 10,
      exports: 5,
      extraAccountPrice: 200,
      extraExportPrice: 100
    },
    popular: false,
    cta: "Subscribe"
  },
  {
    name: "Pro",
    description: "For growing households",
    price: { monthly: 19, yearly: 190 },
    features: [
      "Track up to 15 bank accounts",
      "Weekly & monthly budgets",
      "Advanced analytics & trends",
      "Unlimited CSV & PDF exports",
      "Shared household budgets",
      "Priority email support"
    ],
    limits: {
      accounts: 15,
      transactions: 5000,
      categories: 50,
      exports: 5,
      extraAccountPrice: 150,
      extraExportPrice: 0
    },
    popular: true,
    cta: "Start 14-day free trial"
  },
  {
    name: "Enterprise",
    description: "Custom solutions",
    price: { monthly: "Custom", yearly: "Custom" },
    features: [
      "Unlimited everything",
      "Custom integrations",
      "White-label options",
      "Dedicated account manager",
      "SLA & priority support",
      "On-premise deployment option"
    ],
    limits: {
      accounts: 0,
      transactions: 0,
      categories: 0,
      exports: 0,
      extraAccountPrice: 0,
      extraExportPrice: 0
    },
    popular: false,
    cta: "Contact Us",
    isCustom: true
  }
]

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(false)

  const formatPrice = (price: number | string) => {
    if (typeof price === "string") return price
    return `$${price}`
  }

  const getDiscount = (monthlyPrice: number, yearlyPrice: number) => {
    const monthlyTotal = monthlyPrice * 12
    const savings = monthlyTotal - yearlyPrice
    const percentage = Math.round((savings / monthlyTotal) * 100)
    return percentage
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Discover More Plans
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Choose the perfect plan for your expense management needs
          </p>
          
          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <span className={cn("text-sm", !isYearly && "font-medium")}>Monthly</span>
            <Switch
              checked={isYearly}
              onCheckedChange={setIsYearly}
              className="data-[state=checked]:bg-primary"
            />
            <span className={cn("text-sm", isYearly && "font-medium")}>Yearly</span>
            {isYearly && (
              <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200">
                Save up to 17%
              </Badge>
            )}
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={cn(
                "relative transition-all duration-200 hover:shadow-lg",
                plan.popular && "ring-2 ring-primary shadow-lg scale-105"
              )}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground px-3 py-1">
                    <Star className="w-3 h-3 mr-1" />
                    Most Popular
                  </Badge>
                </div>
              )}
              
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  {plan.description}
                </CardDescription>
                <div className="mt-4">
                  <div className="text-3xl font-bold">
                    {plan.isCustom ? (
                      "Custom"
                    ) : (
                      <>
                        {formatPrice(plan.price[isYearly ? "yearly" : "monthly"])}
                        <span className="text-lg font-normal text-muted-foreground">
                          /{isYearly ? "year" : "mo"}
                        </span>
                      </>
                    )}
                  </div>
                  {!plan.isCustom && isYearly && typeof plan.price.monthly === 'number' && typeof plan.price.yearly === 'number' && (
                    <div className="text-sm text-green-600 dark:text-green-400 mt-1">
                      Save {getDiscount(plan.price.monthly, plan.price.yearly)}%
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Bank Accounts</span>
                    <span className="font-medium">
                      {plan.isCustom ? "Custom" : plan.limits.accounts === 0 ? "Unlimited" : plan.limits.accounts}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Monthly Transactions</span>
                    <span className="font-medium">
                      {plan.isCustom ? "Custom" : (plan.limits.transactions || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Categories</span>
                    <span className="font-medium">
                      {plan.isCustom ? "Custom" : plan.limits.categories}
                    </span>
                  </div>
                  {/* <div className="flex items-center justify-between text-sm">
                    <span>Extra Account</span>
                    <span className="font-medium">
                      {plan.isCustom ? "Custom" : plan.limits.extraAccountPrice > 0 ? `$${(plan.limits.extraAccountPrice / 100).toFixed(2)}` : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Extra Export</span>
                    <span className="font-medium">
                      {plan.isCustom ? "Included" : plan.limits.extraExportPrice > 0 ? `$${(plan.limits.extraExportPrice / 100).toFixed(2)}` : "—"}
                    </span>
                  </div> */}
                </div>

                <div className="space-y-2 pt-4 border-t">
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>

              <CardFooter>
                <SubscriptionDialog plan={plan} isYearly={isYearly}>
                  <Button
                    className={cn(
                      "w-full",
                      plan.popular && "bg-primary hover:bg-primary/90"
                    )}
                    variant={plan.popular ? "default" : "outline"}
                  >
                    {plan.cta}
                  </Button>
                </SubscriptionDialog>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* Additional Information */}
        <div className="text-center text-sm text-muted-foreground">
          <p>All plans include secure bank-grade encryption and daily sync</p>
          <p className="mt-2">
            Need help choosing? <a href="#" className="text-primary hover:underline">Contact our sales team</a>
          </p>
        </div>
      </div>
    </div>
  )
}
