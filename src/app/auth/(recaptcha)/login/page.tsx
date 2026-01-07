"use client"

import { useRef, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Eye, EyeOff, Sparkles } from "lucide-react"
import Link from "next/link"
import { signIn, sendVerificationEmail, emailOtp } from "@/lib/auth-client"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useAuthContext } from "@/components/auth-provider"
import { Logo } from "@/components/logo"
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp"
import Script from "next/script"
import Head from "next/head"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null)
  const router = useRouter()
  const { refreshUser } = useAuthContext()
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""
  
  // OTP specific states
  const [code, setCode] = useState("")
  const [isCodeSent, setIsCodeSent] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [activeTab, setActiveTab] = useState("password")
  
  // Check for tab query parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tabParam = params.get('tab')
    if (tabParam === 'otp') {
      setActiveTab('otp')
    }
  }, [])
  
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

  // Password login
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    try {
      if (!turnstileToken) {
        toast.error("Turnstile verification required. Please complete the security check.")
        resetTurnstile()
        setIsLoading(false)
        return
      }

      const result = await signIn.email({
        email,
        password,
        fetchOptions: { 
          headers: { 
              "x-captcha-response": turnstileToken,
          }, 
        },
      })
      
      if (result.error) {
        resetTurnstile()
        const message = result.error.message || "Login failed"
        if (message.toLowerCase().includes("verify") || message.toLowerCase().includes("email not verified")) {
          setVerifyMessage(message)
          setVerifyOpen(true)
        } else {
          toast.error(message)
        }
      } else {
        toast.success("Logged in successfully!")
        
        // Make sure we update the user context
        await refreshUser()
        
        // Clear the logout flag if it exists
        sessionStorage.removeItem('justLoggedOut')
        
        // Check if there's a redirect URL from session storage
        const redirectPath = sessionStorage.getItem('redirectAfterLogin')
        if (redirectPath) {
          sessionStorage.removeItem('redirectAfterLogin')
          router.push(redirectPath)
        } else {
          // Default redirect to dashboard
          router.push("/dashboard")
        }
      }
    } catch (error) {
      resetTurnstile()
      toast.error("An error occurred during login")
      console.error("Login error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // OTP Functions
  const handleSendCode = async () => {
    if (!email.trim()) {
      toast.error("Please enter your email address")
      return
    }

    setIsLoading(true)
    try {
      const result = await emailOtp.sendVerificationOtp({
        email: email.trim(),
        type: "sign-in",
      })

      if (result.error) {
        toast.error(result.error.message || "Failed to send verification code")
      } else {
        toast.success("Verification code sent to your email!")
        setIsCodeSent(true)
        setCountdown(60) // 60 second countdown
        
        // Start countdown
        const interval = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(interval)
              return 0
            }
            return prev - 1
          })
        }, 1000)
      }
    } catch (error) {
      toast.error("Failed to send verification code")
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyCode = async () => {
    if (!code.trim()) {
      toast.error("Please enter the verification code")
      return
    }

    if (!turnstileToken) {
      toast.error("Turnstile verification required. Please complete the security check.")
      resetTurnstile()
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const result = await signIn.emailOtp({
        email: email.trim(),
        otp: code.trim(),
        fetchOptions: { 
          headers: { 
              "x-captcha-response": turnstileToken,
          }, 
        },
      })

      if (result.error) {
        resetTurnstile()
        toast.error(result.error.message || "Invalid verification code")
      } else {
        handleSuccessfulLogin()
      }
    } catch (error) {
      resetTurnstile()
      toast.error("Failed to verify code. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSuccessfulLogin = async () => {
    toast.success("Login successful!")
    
    // Make sure we update the user context
    await refreshUser()
    
    // Clear the logout flag if it exists
    sessionStorage.removeItem('justLoggedOut')
    
    // Check if there's a redirect URL from session storage
    const redirectPath = sessionStorage.getItem('redirectAfterLogin')
    if (redirectPath) {
      sessionStorage.removeItem('redirectAfterLogin')
      router.push(redirectPath)
    } else {
      // Default redirect to dashboard
      router.push("/dashboard")
    }
  }

  const handleResendCode = async () => {
    if (countdown > 0) return
    await handleSendCode()
  }

  const handleResetOTP = () => {
    setIsCodeSent(false)
    setCode("")
    setCountdown(0)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Head>
        <link rel="preconnect" href="https://challenges.cloudflare.com" />
      </Head>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
      <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email not verified</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              We sent a verification link to your email. You must verify your email before logging in.
            </p>
            <Button
              className="w-full"
              onClick={() => router.push(`/auth/verify-email?email=${encodeURIComponent(email)}`)}
            >
              Open verification page
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setVerifyOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <Logo width={200} priority />
          </div>
          <CardTitle>Welcome back</CardTitle>
          <p className="text-muted-foreground">Sign in to your account</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* <Button 
            type="button" 
            variant="outline" 
            className="w-full flex items-center justify-center gap-2"
            onClick={async () => {
              setIsLoading(true)
              try {
                // Store the intended redirect location
                const redirectPath = sessionStorage.getItem('redirectAfterLogin') || '/dashboard'
                console.log('[Google Auth] Redirect path after login will be:', redirectPath)
                
                // Add a timestamp to prevent caching issues
                const ts = Date.now()
                
                // Use Better Auth's default handling with auth_success flag for detection
                const result = await signIn.social({
                  provider: "google",
                  callbackURL: `/dashboard?auth_success=true&ts=${ts}`,
                  errorCallbackURL: "/auth/login?error=google_auth_failed",
                })
                
                if (result.error) {
                  toast.error(result.error.message || "Google login failed")
                  setIsLoading(false)
                } else {
                  // The OAuth flow will continue in the background
                  toast.success("Google authentication successful! Redirecting...")
                  
                  // Keep the loading state to prevent further interactions
                  // The redirect should happen automatically
                }
              } catch (error) {
                toast.error("An error occurred during Google login")
                console.error("Google login error:", error)
                setIsLoading(false)
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
            Sign in with Google
          </Button>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-muted"></span>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div> */}

          <Tabs 
            defaultValue="password" 
            value={activeTab} 
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="password">Password</TabsTrigger>
              <TabsTrigger value="otp">Email OTP</TabsTrigger>
            </TabsList>
            
            {/* Password Tab */}
            <TabsContent value="password" className="space-y-4">
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
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
                <div className="flex items-center justify-between">
                  <Link href="/auth/forgot-password" className="text-sm text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
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
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Signing in..." : "Sign in"}
                </Button>
              </form>
            </TabsContent>
            
            {/* OTP Tab */}
            <TabsContent value="otp" className="space-y-4">
              {!isCodeSent ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-otp">Email Address</Label>
                    <Input
                      id="email-otp"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  
                  <Button
                    onClick={handleSendCode}
                    disabled={!email.trim() || isLoading}
                    className="w-full"
                  >
                    {isLoading ? "Sending..." : "Send Verification Code"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-center my-4">
                    <p className="text-sm text-muted-foreground">
                      We've sent a 6-digit code to {email}
                    </p>
                  </div>
                  
                  <div className="space-y-3 flex flex-col items-center">
                    <Label htmlFor="verification-code">Verification Code</Label>
                    <InputOTP
                      id="verification-code"
                      value={code}
                      maxLength={6}
                      onChange={(value) => setCode(value)}
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  
                  <Button
                    onClick={handleVerifyCode}
                    disabled={!code.trim() || isLoading}
                    className="w-full"
                  >
                    {isLoading ? "Verifying..." : "Sign In"}
                  </Button>

                  <div className="text-center space-y-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleResetOTP}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      Back
                    </Button>
                    
                    <div className="text-sm text-muted-foreground">
                      Didn't receive the code?{" "}
                      <Button
                        variant="link"
                        size="sm"
                        onClick={handleResendCode}
                        disabled={countdown > 0}
                        className="p-0 h-auto text-blue-600 hover:text-blue-700"
                      >
                        {countdown > 0 ? `Resend in ${countdown}s` : "Resend code"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
          
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link href="/auth/register" className="text-primary hover:underline">
                Sign up
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
