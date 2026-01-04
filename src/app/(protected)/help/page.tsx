"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { HelpCircle } from "lucide-react"
import { withProtection } from "@/lib/with-protection"

function HelpPage() {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">Help</h1>
        <p className="text-muted-foreground">Get help and support</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Frequently Asked Questions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">How do I add a transaction?</h3>
            <p className="text-muted-foreground">
              Click on the "Add Transaction" button in the sidebar or use the "+" button. Select the transaction type (Expense, Income, Transfer, or Person) and fill in the details.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">How do I create a budget?</h3>
            <p className="text-muted-foreground">
              Go to the Money tab, then click on Budget. You can create monthly, weekly, or custom period budgets for specific categories or accounts.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Can I use multiple currencies?</h3>
            <p className="text-muted-foreground">
              Yes! Each account can have its own currency. The app will automatically convert amounts to your base currency for reporting.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default withProtection(HelpPage)

