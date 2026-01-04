"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MoreHorizontal, Copy, Plus, Filter, Search } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CreateWebhookDialog } from "@/components/create-webhook-dialog"

const webhooks = [
  {
    id: "wh_1234567890",
    name: "Call Started",
    url: "https://api.example.com/webhooks/call-started",
    events: ["call.started", "call.ended"],
    status: "Active",
    lastTriggered: "2 hours ago"
  },
  {
    id: "wh_0987654321",
    name: "Agent Response",
    url: "https://api.example.com/webhooks/agent-response",
    events: ["agent.response"],
    status: "Active",
    lastTriggered: "5 minutes ago"
  },
  {
    id: "wh_1122334455",
    name: "Error Handler",
    url: "https://api.example.com/webhooks/errors",
    events: ["error.occurred"],
    status: "Inactive",
    lastTriggered: "Never"
  }
]

export default function WebhooksPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [pageSize, setPageSize] = useState("20")

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Webhooks</h1>
          <p className="text-muted-foreground">
            Configure HTTP endpoints to receive real-time events
          </p>
        </div>
        <CreateWebhookDialog>
          <Button data-create-webhook>
            <Plus className="mr-2 h-4 w-4" />
            New Webhook
          </Button>
        </CreateWebhookDialog>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <Button variant="outline">
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>
        </div>
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search webhooks"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 w-full sm:w-64"
          />
        </div>
      </div>

      {/* Table for larger screens */}
      <div className="hidden md:block border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>NAME</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>EVENTS</TableHead>
              <TableHead>STATUS</TableHead>
              <TableHead>LAST TRIGGERED</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {webhooks.map((webhook) => (
              <TableRow key={webhook.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell className="font-medium">{webhook.name}</TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <code className="text-xs bg-muted px-2 py-1 rounded max-w-xs truncate">
                      {webhook.url}
                    </code>
                    <Button variant="ghost" size="sm">
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {webhook.events.map((event, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {event}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={webhook.status === "Active" ? "default" : "secondary"}>
                    {webhook.status}
                  </Badge>
                </TableCell>
                <TableCell>{webhook.lastTriggered}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>Edit</DropdownMenuItem>
                      <DropdownMenuItem>Test</DropdownMenuItem>
                      <DropdownMenuItem>View Logs</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Cards for mobile screens */}
      <div className="md:hidden space-y-4">
        {webhooks.map((webhook) => (
          <Card key={webhook.id}>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-base">{webhook.name}</CardTitle>
                <Badge variant={webhook.status === "Active" ? "default" : "secondary"} className="mt-1">
                  {webhook.status}
                </Badge>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="-mt-2 -mr-2">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>Edit</DropdownMenuItem>
                  <DropdownMenuItem>Test</DropdownMenuItem>
                  <DropdownMenuItem>View Logs</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">URL</h4>
                <div className="flex items-center space-x-2 mt-1">
                  <code className="text-xs bg-muted px-2 py-1 rounded w-full truncate">
                    {webhook.url}
                  </code>
                  <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0">
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Events</h4>
                <div className="flex flex-wrap gap-1 mt-1">
                  {webhook.events.map((event, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {event}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Last Triggered</h4>
                <p className="text-sm mt-1">{webhook.lastTriggered}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">Showing</span>
          <Select value={pageSize} onValueChange={setPageSize}>
            <SelectTrigger className="w-16">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">per page</span>
        </div>
        <div className="text-sm text-muted-foreground">
          1 – 3 of 3
        </div>
      </div>
    </div>
  )
}