"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Info } from "lucide-react"
import { withProtection } from "@/lib/with-protection"

function AboutPage() {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">About</h1>
        <p className="text-muted-foreground">Learn more about this expense manager</p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Info className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-semibold">Expense Manager</h2>
          </div>
          <p className="text-muted-foreground">
            A comprehensive personal finance and expense management application designed to help you track your spending, manage budgets, and achieve your financial goals.
          </p>
          <div className="space-y-2">
            <h3 className="font-semibold">Features</h3>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Multi-currency support</li>
              <li>Multiple account types</li>
              <li>Smart categorization</li>
              <li>Budget tracking</li>
              <li>Savings goals</li>
              <li>AI-powered insights</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default withProtection(AboutPage)

