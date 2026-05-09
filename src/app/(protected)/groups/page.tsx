import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { CreateGroupDialog } from "@/components/groups/create-group-dialog"
import { GroupCard } from "@/components/groups/group-card"

export default function GroupsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Groups</h1>
          <p className="text-muted-foreground">
            Manage your shared expenses and split bills with friends.
          </p>
        </div>
        <CreateGroupDialog>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Group
          </Button>
        </CreateGroupDialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Mock Data for now */}
        <GroupCard
          id="1"
          name="Trip to Paris"
          description="Summer vacation 2024"
          memberCount={4}
          totalExpenses={1250.50}
          currency="EUR"
        />
        <GroupCard
          id="2"
          name="House Rent"
          description="Monthly apartment expenses"
          memberCount={3}
          totalExpenses={2400.00}
          currency="USD"
        />
         <GroupCard
          id="3"
          name="Friday Dinner"
          description="Weekly team dinner"
          memberCount={6}
          totalExpenses={340.20}
          currency="USD"
        />
      </div>
    </div>
  )
}
