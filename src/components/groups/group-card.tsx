import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Receipt, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface GroupCardProps {
  id: string
  name: string
  description?: string
  memberCount: number
  totalExpenses: number
  currency: string
}

export function GroupCard({
  id,
  name,
  description,
  memberCount,
  totalExpenses,
  currency,
}: GroupCardProps) {
  return (
    <Card className="hover:bg-accent/5 transition-colors">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="truncate">{name}</span>
          <span className="text-sm font-normal text-muted-foreground flex items-center gap-1">
            <Users className="h-3 w-3" />
            {memberCount}
          </span>
        </CardTitle>
        {description && (
          <CardDescription className="line-clamp-1">{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mt-2">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground uppercase font-medium">Total Expenses</span>
            <span className="text-xl font-bold">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(totalExpenses)}
            </span>
          </div>
          <Link href={`/groups/${id}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
