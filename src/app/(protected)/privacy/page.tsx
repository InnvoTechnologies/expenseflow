"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Shield } from "lucide-react"
import { withProtection } from "@/lib/with-protection"

function PrivacyPage() {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">Privacy Policy</h1>
        <p className="text-muted-foreground">How we protect your data</p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-semibold">Your Privacy Matters</h2>
          </div>
          <div className="space-y-4 text-muted-foreground">
            <p>
              We are committed to protecting your personal and financial information. All data is encrypted and stored securely.
            </p>
            <div>
              <h3 className="font-semibold text-foreground mb-2">Data Collection</h3>
              <p>We only collect the information necessary to provide the expense management service.</p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2">Data Security</h3>
              <p>All financial data is encrypted both in transit and at rest. We use industry-standard security practices.</p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2">Data Sharing</h3>
              <p>We do not sell or share your personal or financial data with third parties.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default withProtection(PrivacyPage)

