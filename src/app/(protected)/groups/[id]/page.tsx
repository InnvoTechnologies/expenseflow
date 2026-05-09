"use client"

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Settings, Users, Receipt, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { AddExpenseDialog } from "@/components/groups/add-expense-dialog"

export default function GroupDetailsPage() {
  const params = useParams()
  const id = params.id as string

  // Mock data based on ID
  const group = {
    id,
    name: "Trip to Paris",
    description: "Summer vacation 2024",
    currency: "EUR",
    members: [
      { id: "1", name: "Alice", avatar: "A" },
      { id: "2", name: "Bob", avatar: "B" },
      { id: "3", name: "Charlie", avatar: "C" },
      { id: "4", name: "David", avatar: "D" },
    ],
    expenses: [
      { id: "1", description: "Dinner at Le Petit", amount: 120.50, paidBy: "Alice", date: "2024-06-15" },
      { id: "2", description: "Museum Tickets", amount: 60.00, paidBy: "Bob", date: "2024-06-16" },
      { id: "3", description: "Airbnb", amount: 800.00, paidBy: "Charlie", date: "2024-06-14" },
    ]
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Link href="/groups">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{group.name}</h1>
          <p className="text-muted-foreground">{group.description}</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
          <AddExpenseDialog group={group}>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Expense
            </Button>
          </AddExpenseDialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: group.currency }).format(
                group.expenses.reduce((acc, curr) => acc + curr.amount, 0)
              )}
            </div>
          </CardContent>
        </Card>
         <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{group.members.length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="expenses" className="w-full">
        <TabsList>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="balances">Balances</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="expenses" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Expenses</CardTitle>
              <CardDescription>
                List of all expenses in this group.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {group.expenses.map((expense) => (
                  <div key={expense.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                    <div className="flex flex-col">
                      <span className="font-medium">{expense.description}</span>
                      <span className="text-sm text-muted-foreground">
                        Paid by {expense.paidBy} on {expense.date}
                      </span>
                    </div>
                    <span className="font-bold">
                       {new Intl.NumberFormat('en-US', { style: 'currency', currency: group.currency }).format(expense.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="balances">
          <Card>
            <CardHeader>
              <CardTitle>Balances</CardTitle>
              <CardDescription>
                Who owes whom.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                Balances visualization coming soon...
              </div>
            </CardContent>
          </Card>
        </TabsContent>
         <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Group Settings</CardTitle>
              <CardDescription>
                Manage group members and settings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                Settings coming soon...
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
