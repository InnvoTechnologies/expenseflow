"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import { Eye, EyeOff } from "lucide-react"
import Link from "next/link"
import { signUp, signIn } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Logo } from "@/components/logo"
import Script from "next/script"
import Head from "next/head"

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: ""
  })
  const [showPassword, setShowPassword] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""
  
  useEffect(() => {
    ;(window as any).onTurnstileSuccess = (token: string) => {
      setTurnstileToken(token)
    }
    ;(window as any).onTurnstileError = () => {
      setTurnstileToken(null)
      if ((window as any).turnstile) {
        (window as any).turnstile.reset()
      }
    }
    ;(window as any).onTurnstileExpired = () => {
      setTurnstileToken(null)
      if ((window as any).turnstile) {
        (window as any).turnstile.reset()
      }
    }
  }, [])

  const resetTurnstile = () => {
    setTurnstileToken(null)
    if ((window as any).turnstile) {
      (window as any).turnstile.reset()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!acceptTerms) {
      toast.error("Please accept the terms and conditions")
      return
    }

    setIsLoading(true)

    try {
      if (!turnstileToken) {
        toast.error("Turnstile verification required. Please complete the security check.")
        resetTurnstile()
        setIsLoading(false);
        return;
      }
      const result = await signUp.email({
        email: formData.email,
        password: formData.password,
        name: formData.name,
        fetchOptions: {
          headers: {
            "x-captcha-response": turnstileToken,
          },
        },
      })

      if (result.error) {
        resetTurnstile()
        toast.error(result.error.message || "Registration failed")
      } else {
        // With requireEmailVerification=true, user must verify before login
        toast.success("Account created. Please verify your email.")
        router.push(`/auth/verify-email?email=${encodeURIComponent(formData.email)}`)
      }
    } catch (error) {
      resetTurnstile()
      toast.error("An error occurred during registration")
      console.error("Registration error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Head>
        <link rel="preconnect" href="https://challenges.cloudflare.com" />
      </Head>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <Logo width={200} priority />
          </div>
          <CardTitle>Create your account</CardTitle>
          <p className="text-muted-foreground">Get started with your Expense Manager to track your expenses and manage your finances.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* <Button
            type="button"
            variant="outline"
            className="w-full flex items-center justify-center gap-2"
            onClick={async () => {
              setIsLoading(true);
              try {
                // Store the intended redirect location
                const redirectPath = sessionStorage.getItem('redirectAfterLogin') || '/dashboard';
                console.log('[Google Auth] Redirect path after signup will be:', redirectPath);

                // Use a direct approach without fancy redirects
                // Better Auth will handle the OAuth flow
                const result = await signIn.social({
                  provider: "google",
                  // Simple redirect to our callback handler with the intended final destination
                  callbackURL: `/api/auth/callback/google?redirect=${encodeURIComponent(redirectPath)}`,
                  errorCallbackURL: "/auth/register?error=google_auth_failed",
                });

                if (result.error) {
                  toast.error(result.error.message || "Google sign up failed");
                  setIsLoading(false);
                } else {
                  // The OAuth flow will continue in the background
                  toast.success("Google authentication successful! Redirecting...");

                  // Keep the loading state to prevent further interactions
                  // The redirect should happen automatically
                }
              } catch (error) {
                toast.error("An error occurred during Google sign up");
                console.error("Google sign up error:", error);
                setIsLoading(false);
              }
            }}
            disabled={isLoading}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 48 48" className="mr-1">
              <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
              <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
              <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
              <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
            </svg>
            Sign up with Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-muted"></span>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div> */}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  value={formData.password}
                  onChange={(e) => handleInputChange("password", e.target.value)}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="terms"
                checked={acceptTerms}
                onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
              />
              <Label htmlFor="terms" className="text-sm">
                I agree to the{" "}
                <Link href="/terms" className="text-primary hover:underline">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </Link>
              </Label>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating account..." : "Create account"}
            </Button>
          </form>

          <div className="mt-2">
            <div
              className="cf-turnstile"
              data-sitekey={siteKey}
              data-theme="auto"
              data-size="normal"
              data-retry="auto"
              data-refresh-expired="auto"
              data-retry-interval="1000"
              data-callback="onTurnstileSuccess"
              data-error-callback="onTurnstileError"
              data-expired-callback="onTurnstileExpired"
            ></div>
          </div>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/auth/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
