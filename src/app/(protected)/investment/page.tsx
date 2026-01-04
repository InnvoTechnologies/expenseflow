"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Briefcase } from "lucide-react"
import { withProtection } from "@/lib/with-protection"

function InvestmentPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Investment</h1>
          <p className="text-muted-foreground">Track your investment positions</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Position
        </Button>
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Briefcase className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No investments yet</h3>
          <p className="text-muted-foreground text-center mb-4">
            Start tracking your investment portfolio
          </p>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Position
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default withProtection(InvestmentPage)

