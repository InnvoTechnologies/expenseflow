"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, TestTube } from "lucide-react"

const availableEvents = [
  { id: "call.started", name: "Call Started", description: "Triggered when a call begins" },
  { id: "call.ended", name: "Call Ended", description: "Triggered when a call ends" },
  { id: "agent.response", name: "Agent Response", description: "Triggered when agent responds" },
  { id: "user.message", name: "User Message", description: "Triggered when user sends message" },
  { id: "tool.called", name: "Tool Called", description: "Triggered when a tool is executed" },
  { id: "error.occurred", name: "Error Occurred", description: "Triggered when an error happens" },
]

interface CreateWebhookDialogProps {
  children: React.ReactNode
}

export function CreateWebhookDialog({ children }: CreateWebhookDialogProps) {
  const [open, setOpen] = useState(false)
  const [webhookName, setWebhookName] = useState("")
  const [webhookUrl, setWebhookUrl] = useState("")
  const [description, setDescription] = useState("")
  const [selectedEvents, setSelectedEvents] = useState<string[]>([])
  const [headers, setHeaders] = useState("")

  const handleEventToggle = (eventId: string) => {
    setSelectedEvents(prev => 
      prev.includes(eventId) 
        ? prev.filter(id => id !== eventId)
        : [...prev, eventId]
    )
  }

  const handleCreate = () => {
    // Handle webhook creation logic here
    console.log({
      name: webhookName,
      url: webhookUrl,
      description,
      events: selectedEvents,
      headers
    })
    setOpen(false)
    // Reset form
    setWebhookName("")
    setWebhookUrl("")
    setDescription("")
    setSelectedEvents([])
    setHeaders("")
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="w-[95vw] max-w-2xl rounded-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Webhook</DialogTitle>
          <DialogDescription>
            Configure HTTP endpoint for real-time events
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="details" className="space-y-4">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="webhook-name">Webhook Name</Label>
                <Input
                  id="webhook-name"
                  placeholder="Enter webhook name"
                  value={webhookName}
                  onChange={(e) => setWebhookName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="webhook-url">Endpoint URL</Label>
                <Input
                  id="webhook-url"
                  placeholder="https://your-api.com/webhook"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe what this webhook does"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-24"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="events" className="space-y-4">
            <div>
              <h4 className="font-medium mb-3">Select Events</h4>
              <div className="space-y-3">
                {availableEvents.map((event) => (
                  <div key={event.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                    <Checkbox
                      id={event.id}
                      checked={selectedEvents.includes(event.id)}
                      onCheckedChange={() => handleEventToggle(event.id)}
                    />
                    <div className="flex-1">
                      <Label htmlFor={event.id} className="font-medium cursor-pointer">
                        {event.name}
                      </Label>
                      <p className="text-sm text-muted-foreground">{event.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              {selectedEvents.length > 0 && (
                <div className="mt-4">
                  <h5 className="font-medium mb-2">Selected Events:</h5>
                  <div className="flex flex-wrap gap-2">
                    {selectedEvents.map((eventId) => {
                      const event = availableEvents.find(e => e.id === eventId)
                      return (
                        <Badge key={eventId} variant="secondary">
                          {event?.name}
                        </Badge>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="headers">Custom Headers (JSON)</Label>
                <Textarea
                  id="headers"
                  placeholder='{"Authorization": "Bearer token", "Content-Type": "application/json"}'
                  value={headers}
                  onChange={(e) => setHeaders(e.target.value)}
                  className="min-h-32 font-mono text-sm"
                />
              </div>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Webhook Format</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm space-y-2">
                    <p className="font-medium">Request Method:</p>
                    <p className="text-muted-foreground">POST</p>
                    
                    <p className="font-medium">Content-Type:</p>
                    <p className="text-muted-foreground">application/json</p>
                    
                    <p className="font-medium">Payload Structure:</p>
                    <pre className="text-xs bg-muted p-2 rounded mt-2">
{`{
  "event": "call.started",
  "timestamp": "2025-01-09T...",
  "data": { ... }
}`}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:space-x-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="outline">
            <TestTube className="mr-2 h-4 w-4" />
            Test
          </Button>
          <Button 
            onClick={handleCreate}
            disabled={!webhookName || !webhookUrl || selectedEvents.length === 0}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Webhook
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}