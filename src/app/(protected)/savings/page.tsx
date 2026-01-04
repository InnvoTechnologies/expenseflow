"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Target } from "lucide-react"
import { withProtection } from "@/lib/with-protection"
import Link from "next/link"
import { Progress } from "@/components/ui/progress"
import { useCurrency } from "@/hooks/use-currency"

function SavingsPage() {
  const { formatAmount } = useCurrency()
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Savings</h1>
          <p className="text-muted-foreground">Track your savings goals and progress</p>
        </div>
        <Button asChild>
          <Link href="/savings/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Goal
          </Link>
        </Button>
      </div>

      {/* Savings Goals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              New Laptop
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Progress</span>
                <span className="text-sm font-medium">{formatAmount(25000)} / {formatAmount(100000)}</span>
              </div>
              <Progress value={25} className="h-2" />
            </div>
            <div className="text-sm text-muted-foreground">
              Target Date: Dec 2025
            </div>
            <Button variant="outline" className="w-full">View Details</Button>
          </CardContent>
        </Card>
      </div>

      {/* Empty State */}
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Target className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No savings goals yet</h3>
          <p className="text-muted-foreground text-center mb-4">
            Create your first savings goal to start tracking your progress
          </p>
          <Button asChild>
            <Link href="/savings/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Goal
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default withProtection(SavingsPage)

