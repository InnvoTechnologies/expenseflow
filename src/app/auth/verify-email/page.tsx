"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { sendVerificationEmail } from "@/lib/auth-client"
import { Logo } from "@/components/logo"

function VerifyEmailInner() {
    const params = useSearchParams()
    const router = useRouter()
    const [email, setEmail] = useState("")
    const [sending, setSending] = useState(false)
    const token = params.get("token")

    useEffect(() => {
        const initialEmail = params.get("email")
        if (initialEmail) setEmail(initialEmail)
    }, [params])

    const resend = async (e: React.FormEvent) => {
        e.preventDefault()
        setSending(true)
        try {
            await sendVerificationEmail({ email, callbackURL: "/dashboard" })
            toast.success("Verification email sent")
        } catch (err: any) {
            toast.error(err?.message || "Failed to send email")
        } finally {
            setSending(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="flex items-center justify-center mb-4">
                        <Logo width={140} height={29} priority />
                    </div>
                    <CardTitle>Verify your email</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Check your inbox for a verification link. If you didn't receive it, you can resend below.
                    </p>
                    <form onSubmit={resend} className="space-y-3">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                        </div>
                        <Button type="submit" className="w-full" disabled={sending}>
                            {sending ? "Sending..." : "Resend verification email"}
                        </Button>
                        <Button type="button" variant="outline" className="w-full" onClick={() => router.push("/auth/login")}>Back to login</Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center p-4">Loading...</div>}>
      <VerifyEmailInner />
    </Suspense>
  )
}


