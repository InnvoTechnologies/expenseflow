"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Users, Mail } from "lucide-react"
import { withProtection } from "@/lib/with-protection"

function InvitePage() {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">Invite Friends & Family</h1>
        <p className="text-muted-foreground">Share your expense manager with loved ones</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Send Invitation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Email Address</Label>
            <div className="flex gap-2">
              <Input type="email" placeholder="friend@example.com" />
              <Button>
                <Mail className="mr-2 h-4 w-4" />
                Send
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Invite friends and family to join your expense manager. They'll be able to view and manage shared accounts.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default withProtection(InvitePage)

