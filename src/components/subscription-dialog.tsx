"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, Star, Wallet, CreditCard, Tag, FileDown } from "lucide-react"
import { cn } from "@/lib/utils"

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

interface SubscriptionDialogProps {
  plan: Plan
  isYearly: boolean
  children: React.ReactNode
}

export function SubscriptionDialog({ plan, isYearly, children }: SubscriptionDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubscribe = async () => {
    setIsLoading(true)
    // TODO: Implement actual subscription logic
    console.log(`Subscribing to ${plan.name} plan (${isYearly ? 'yearly' : 'monthly'})`)
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    setIsLoading(false)
    setIsOpen(false)
    // TODO: Show success message and redirect
  }

  const formatPrice = (price: number | string) => {
    if (typeof price === "string") return price
    return `$${price}`
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Confirm Your Subscription</DialogTitle>
          <DialogDescription>
            Review your plan details before subscribing
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Plan Summary */}
          <Card className={cn(plan.popular && "ring-2 ring-primary")}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </div>
                {plan.popular && (
                  <Badge className="bg-primary text-primary-foreground">
                    <Star className="w-3 h-3 mr-1" />
                    Most Popular
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
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

                {/* Plan Limits */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-muted-foreground" />
                    <span>Accounts: {plan.isCustom ? "Custom" : plan.limits.accounts === 0 ? "Unlimited" : plan.limits.accounts}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-muted-foreground" />
                    <span>Transactions: {plan.isCustom ? "Custom" : plan.limits.transactions.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-muted-foreground" />
                    <span>Categories: {plan.isCustom ? "Custom" : plan.limits.categories}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileDown className="w-4 h-4 text-muted-foreground" />
                    <span>Exports: {plan.isCustom ? "Included" : plan.limits.exports === 0 ? "Unlimited" : plan.limits.exports}</span>
                  </div>
                </div>

                {/* Features */}
                <div className="space-y-2">
                  <h4 className="font-medium">Included Features:</h4>
                  <div className="grid grid-cols-1 gap-1">
                    {plan.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Billing Information */}
          {!plan.isCustom && (
            <div className="space-y-4">
              <h4 className="font-medium">Billing Information</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Billing Cycle:</span>
                  <p className="font-medium">{isYearly ? "Yearly" : "Monthly"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Next Payment:</span>
                  <p className="font-medium">
                    {formatPrice(plan.price[isYearly ? "yearly" : "monthly"])} 
                    {isYearly ? " in 12 months" : " next month"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Trial Information */}
          {plan.cta.includes("trial") && (
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-5 h-5 text-blue-600" />
                <h4 className="font-medium text-blue-900 dark:text-blue-100">14-Day Free Trial</h4>
              </div>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Start your free trial today. No charges until your trial ends. 
                Cancel anytime during the trial period.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubscribe}
              disabled={isLoading}
              className={cn(
                "flex-1",
                plan.popular && "bg-primary hover:bg-primary/90"
              )}
            >
              {isLoading ? "Processing..." : plan.cta}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
