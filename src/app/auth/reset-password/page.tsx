"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { Suspense, useState, useEffect } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { toast } from "sonner"
import { resetPassword } from "@/lib/auth-client"
import { Logo } from "@/components/logo"

function ResetPasswordInner() {
    const params = useSearchParams()
    const router = useRouter()
    const [token, setToken] = useState<string | null>(null)
    const [password, setPassword] = useState("")
    const [confirm, setConfirm] = useState("")
    const [loading, setLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)

    useEffect(() => {
        const t = params.get("token")
        setToken(t)
    }, [params])

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!token) return toast.error("Missing token")
        if (password.length < 8) return toast.error("Password must be at least 8 characters")
        if (password !== confirm) return toast.error("Passwords do not match")

        setLoading(true)
        try {
            await resetPassword({ newPassword: password, token })
            toast.success("Password updated. Please sign in.")
            router.push("/auth/login")
        } catch (err: any) {
            toast.error(err?.message || "Failed to reset password")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="flex items-center justify-center mb-4">
                        <Logo width={140} height={29} priority />
                    </div>
                    <CardTitle>Set a new password</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={onSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="password">New password</Label>
                            <div className="relative">
                              <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => setShowPassword(prev => !prev)}
                              >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirm">Confirm password</Label>
                            <div className="relative">
                              <Input id="confirm" type={showConfirm ? "text" : "password"} value={confirm} onChange={e => setConfirm(e.target.value)} required />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => setShowConfirm(prev => !prev)}
                              >
                                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            </div>
                        </div>
                        <Button type="submit" className="w-full" disabled={loading || !token}>
                            {loading ? "Updating..." : "Update password"}
                        </Button>
                        <div className="text-center">
                            <Link href="/auth/login" className="text-sm text-muted-foreground hover:text-foreground">Back to login</Link>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center p-4">Loading...</div>}>
      <ResetPasswordInner />
    </Suspense>
  )
}


