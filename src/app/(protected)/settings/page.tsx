"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Camera, Mail, Calendar, Moon, Monitor, Smartphone, Globe, Trash2, AlertTriangle, Pencil, Save, DollarSign, Download, Upload, Lock } from "lucide-react"
import { useTheme } from "next-themes"
import { useAuth } from "@/hooks/use-auth"
import { useCurrency } from "@/hooks/use-currency"
import { format } from "date-fns"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { changePassword, sendVerificationEmail } from "@/lib/auth-client"
import { toast } from "sonner"
import { Eye, EyeOff } from "lucide-react"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { apiClient } from "@/lib/api-client"
import { Alert, AlertDescription } from "@/components/ui/alert"


export default function SettingsPage() {
  const [isEditing, setIsEditing] = useState(false)
  const { theme, setTheme } = useTheme()
  const { user } = useAuth()
  const { baseCurrency, country, numberFormat } = useCurrency()
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [currencyState, setCurrencyState] = useState({
    baseCurrency: baseCurrency,
    country: country || "PK",
    numberFormat: numberFormat,
  })
  // legacy local password state removed in favor of react-hook-form
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [revokeSessionDialogOpen, setRevokeSessionDialogOpen] = useState(false)
  const [sessionToRevoke, setSessionToRevoke] = useState<any>(null)
  const [revokeAllDialogOpen, setRevokeAllDialogOpen] = useState(false)

  // Fetch user sessions
  const { data: sessions, isLoading: sessionsLoading, refetch: refetchSessions } = useQuery({
    queryKey: ['user-sessions'],
    queryFn: async () => {
      const response = await apiClient.get('/profile/sessions')
      return response.data
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Revoke session mutation
  const revokeSession = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await apiClient.delete(`/profile/sessions/${sessionId}`)
      return response.data
    },
    onSuccess: () => {
      toast.success("Session revoked successfully")
      refetchSessions()
      setRevokeSessionDialogOpen(false)
      setSessionToRevoke(null)
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to revoke session")
    }
  })

  // Revoke all other sessions mutation
  const revokeAllOtherSessions = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/profile/sessions/revoke-all')
      return response.data
    },
    onSuccess: (data) => {
      toast.success(`Successfully revoked ${data.data?.revokedCount || 0} other sessions`)
      refetchSessions()
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to revoke other sessions")
    }
  })

  // ---- Profile form (React Hook Form + Zod) ----
  const profileSchema = z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().optional(),
  })

  type ProfileValues = z.infer<typeof profileSchema>

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.name?.split(" ")[0] || "",
      lastName: user?.name?.split(" ").slice(1).join(" ") || "",
    },
  })

  useEffect(() => {
    form.reset({
      firstName: user?.name?.split(" ")[0] || "",
      lastName: user?.name?.split(" ").slice(1).join(" ") || "",
    })
  }, [user, form])

  const saveProfile = useMutation({
    mutationFn: async (values: ProfileValues) => {
      const response = await apiClient.patch('/profile', values)
      return response.data
    },
    onSuccess: (_data, values) => {
      toast.success("Profile updated")
      // Update local display state for avatar fallback
      setProfile(p => ({ ...p, firstName: values.firstName, lastName: values.lastName || "" }))
      setIsEditing(false)
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || error?.message || "Failed to update profile")
    }
  })
  
  const [profile, setProfile] = useState({
    firstName: user?.name?.split(' ')[0] || '',
    lastName: user?.name?.split(' ').slice(1).join(' ') || '',
    email: user?.email || '',
  })

  const handleSave = () => {
    if (!isEditing) {
      setIsEditing(true)
      return
    }
    form.handleSubmit((values) => {
      saveProfile.mutate(values)
    })()
  }

  // Change password form (react-hook-form + zod + tanstack)
  const passwordSchema = z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  })

  type PasswordValues = z.infer<typeof passwordSchema>

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  })

  const changePasswordMutation = useMutation({
    mutationFn: async (values: PasswordValues) => {
      return changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        revokeOtherSessions: true,
      })
    },
    onSuccess: () => {
      toast.success("Password updated")
      setPasswordOpen(false)
      passwordForm.reset()
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to change password")
    }
  })

  useEffect(()=>{
    const currentTheme = localStorage.getItem("theme")
    if(currentTheme){
      setTheme(currentTheme as "light" | "dark")
    }else{
      setTheme("dark")
    }
  },[])

  useEffect(() => {
    if (user) {
      setCurrencyState({
        baseCurrency: user.baseCurrency || "PKR",
        country: user.country || "PK",
        numberFormat: user.numberFormat ?? 2,
      })
    }
  }, [user])

  const saveCurrencySettings = useMutation({
    mutationFn: async (values: { baseCurrency: string; country: string; numberFormat: number }) => {
      const response = await apiClient.patch('/profile', values)
      return response.data
    },
    onSuccess: () => {
      toast.success("Currency settings updated")
      // Refresh user data to get updated currency
      window.location.reload()
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || error?.message || "Failed to update currency settings")
    }
  })

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
        {/* Left Column - Profile Card */}
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-4 sm:p-6 text-center">
              <div className="relative inline-block mb-4">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={user?.image || undefined} alt={user?.name} referrerPolicy="no-referrer" />
                  <AvatarFallback className="bg-blue-500 text-white text-2xl">
                    {profile.firstName[0]}{profile.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                {isEditing && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0"
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <h3 className="font-semibold text-lg">{user?.name}</h3>
              <Badge variant="secondary" className="mt-2">Pro User</Badge>
              
              <div className="mt-6 space-y-3 text-left">
                <div className="flex items-center space-x-3 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{user?.email}</span>
                </div>
                <div className="flex items-center space-x-3 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Joined {user?.createdAt ? format(new Date(user.createdAt), 'MMMM yyyy') : 'N/A'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Settings */}
        <div className="lg:col-span-3 space-y-4 sm:space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-xl sm:text-2xl font-semibold">Settings</h1>
          </div>

          <Tabs defaultValue="general" className="space-y-4">
            <TabsList className="w-full overflow-x-auto h-auto min-h-10 justify-start scrollbar-hide">
              <TabsTrigger value="general" className="flex-shrink-0 text-xs sm:text-sm">General</TabsTrigger>
              <TabsTrigger value="security" className="flex-shrink-0 text-xs sm:text-sm">Security</TabsTrigger>
              <TabsTrigger value="currency" className="flex-shrink-0 text-xs sm:text-sm">Currency</TabsTrigger>
              <TabsTrigger value="backup" className="flex-shrink-0 text-xs sm:text-sm">Backup & Restore</TabsTrigger>
              <TabsTrigger value="sessions" className="flex-shrink-0 text-xs sm:text-sm">Sessions</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4">
              {/* General Tab Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-4 mb-4">
                <Button
                  variant={isEditing ? "default" : "outline"}
                  onClick={isEditing ? handleSave : () => setIsEditing(true)}
                  disabled={isEditing ? saveProfile.isPending : false}
                  aria-busy={isEditing && saveProfile.isPending}
                  className="w-full sm:w-auto"
                >
                  {isEditing ? <Save className="h-4 w-4 mr-2" /> : <Pencil className="h-4 w-4 mr-2" />}
                  {isEditing ? (saveProfile.isPending ? "Saving..." : "Save Changes") : "Edit Profile"}
                </Button>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Form {...form}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl>
                              <Input placeholder="First name" {...field} disabled={!isEditing} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Last name" {...field} disabled={!isEditing} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </Form>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profile.email}
                      onChange={(e) => setProfile({...profile, email: e.target.value})}
                      disabled={true}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Appearance Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>Appearance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center space-x-2">
                      <Moon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div>
                        <Label>Dark Mode</Label>
                        <p className="text-sm text-muted-foreground">Toggle between light and dark themes</p>
                      </div>
                    </div>
                    <Switch
                      checked={theme === "dark"}
                      onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                      className="flex-shrink-0"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="h-5 w-5" />
                    Security
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>4-Digit Passcode</Label>
                      <p className="text-sm text-muted-foreground">
                        Enable passcode lock for additional security
                      </p>
                    </div>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Biometric Lock</Label>
                      <p className="text-sm text-muted-foreground">
                        Use fingerprint or face recognition (if available)
                      </p>
                    </div>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Enable push notifications for reminders and alerts
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Password & Security</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline">Change Password</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Change Password</DialogTitle>
                        </DialogHeader>
                        <Form {...passwordForm}>
                          <form onSubmit={passwordForm.handleSubmit((values) => changePasswordMutation.mutate(values))} className="space-y-3">
                            <FormField
                              control={passwordForm.control}
                              name="currentPassword"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Current password</FormLabel>
                                  <div className="relative">
                                    <FormControl>
                                      <Input type={showCurrent ? "text" : "password"} {...field} />
                                    </FormControl>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                      onClick={() => setShowCurrent(prev => !prev)}
                                    >
                                      {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                  </div>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={passwordForm.control}
                              name="newPassword"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>New password</FormLabel>
                                  <div className="relative">
                                    <FormControl>
                                      <Input type={showNew ? "text" : "password"} {...field} />
                                    </FormControl>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                      onClick={() => setShowNew(prev => !prev)}
                                    >
                                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                  </div>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={passwordForm.control}
                              name="confirmPassword"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Confirm password</FormLabel>
                                  <div className="relative">
                                    <FormControl>
                                      <Input type={showConfirm ? "text" : "password"} {...field} />
                                    </FormControl>
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
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <Button type="submit" disabled={changePasswordMutation.isPending}>
                              {changePasswordMutation.isPending ? "Updating..." : "Update password"}
                            </Button>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                    {!user?.emailVerified && (
                      <Button variant="ghost" onClick={async () => {
                        try {
                          await sendVerificationEmail({ email: user?.email || "" })
                          toast.success("Verification email sent")
                        } catch (e: any) {
                          toast.error(e?.message || "Failed to send verification email")
                        }
                      }}>Resend verification</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sessions" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                        Active Sessions
                        {sessions?.data && (
                          <Badge variant="secondary" className="ml-2 text-xs sm:text-sm">
                            {sessions.data.length} {sessions.data.length === 1 ? 'session' : 'sessions'}
                          </Badge>
                        )}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        Manage your active sessions across different devices and browsers
                      </p>
                    </div>
                    {sessions?.data && sessions.data.length > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setRevokeAllDialogOpen(true)
                        }}
                        className="text-destructive hover:text-destructive w-full sm:w-auto text-xs sm:text-sm"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Revoke All Other Sessions
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {sessionsLoading ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg animate-pulse">
                          <div className="h-10 w-10 bg-muted rounded-full"></div>
                          <div className="flex-1 space-y-2">
                            <div className="h-4 bg-muted rounded w-1/3"></div>
                            <div className="h-3 bg-muted rounded w-1/2"></div>
                          </div>
                          <div className="h-8 bg-muted rounded w-20"></div>
                        </div>
                      ))}
                    </div>
                  ) : sessions?.data && sessions.data.length > 0 ? (
                    <div className="space-y-3">
                      {sessions.data.map((session: any) => (
                        <div key={session.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border rounded-lg gap-4">
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center justify-center h-10 w-10 bg-muted rounded-full flex-shrink-0">
                              {session.deviceType === 'mobile' ? (
                                <Smartphone className="h-5 w-5 text-muted-foreground" />
                              ) : session.deviceType === 'desktop' ? (
                                <Monitor className="h-5 w-5 text-muted-foreground" />
                              ) : (
                                <Globe className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium">
                                {session.deviceType === 'mobile' ? 'Mobile Device' : 
                                 session.deviceType === 'desktop' ? 'Desktop Browser' : 'Unknown Device'}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {session.browser} on {session.os} • {session.ipAddress}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Last active: {session.lastActive ? format(new Date(session.lastActive), 'MMM d, yyyy HH:mm') : 'Unknown'}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 flex-shrink-0">
                            {session.isCurrent && (
                              <Badge variant="secondary">Current Session</Badge>
                            )}
                            {!session.isCurrent && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSessionToRevoke(session)
                                  setRevokeSessionDialogOpen(true)
                                }}
                                className="text-destructive hover:text-destructive w-full sm:w-auto"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Revoke
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                        <Monitor className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-medium mb-2">No active sessions</h3>
                      <p className="text-muted-foreground">
                        You don't have any active sessions at the moment.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Security Note:</strong> If you notice any suspicious sessions, revoke them immediately. 
                  Changing your password will also revoke all other sessions.
                </AlertDescription>
              </Alert>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Use the "Revoke All Other Sessions" button above to immediately log out all your other devices 
                    if you suspect unauthorized access. This is useful when traveling or after using public computers.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="currency" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Currency & Formatting
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Base Currency</Label>
                    <Select 
                      value={currencyState.baseCurrency} 
                      onValueChange={(value) => setCurrencyState({ ...currencyState, baseCurrency: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PKR">PKR - Pakistani Rupee</SelectItem>
                        <SelectItem value="USD">USD - US Dollar</SelectItem>
                        <SelectItem value="EUR">EUR - Euro</SelectItem>
                        <SelectItem value="GBP">GBP - British Pound</SelectItem>
                        <SelectItem value="INR">INR - Indian Rupee</SelectItem>
                        <SelectItem value="AED">AED - UAE Dirham</SelectItem>
                        <SelectItem value="SAR">SAR - Saudi Riyal</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      This currency will be used for reporting and insights
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Country</Label>
                    <Select 
                      value={currencyState.country} 
                      onValueChange={(value) => setCurrencyState({ ...currencyState, country: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PK">Pakistan</SelectItem>
                        <SelectItem value="US">United States</SelectItem>
                        <SelectItem value="GB">United Kingdom</SelectItem>
                        <SelectItem value="IN">India</SelectItem>
                        <SelectItem value="AE">United Arab Emirates</SelectItem>
                        <SelectItem value="SA">Saudi Arabia</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Number Format</Label>
                    <Select 
                      value={currencyState.numberFormat.toString()} 
                      onValueChange={(value) => setCurrencyState({ ...currencyState, numberFormat: parseInt(value) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0 decimal places</SelectItem>
                        <SelectItem value="2">2 decimal places</SelectItem>
                        <SelectItem value="3">3 decimal places</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      Number of decimal places to display for amounts
                    </p>
                  </div>
                  <Button 
                    onClick={() => saveCurrencySettings.mutate(currencyState)}
                    disabled={saveCurrencySettings.isPending}
                    className="w-full"
                  >
                    {saveCurrencySettings.isPending ? "Saving..." : "Save Currency Settings"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="backup" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Backup & Restore</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full">
                      <Download className="mr-2 h-4 w-4" />
                      Export & Share
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      Export all transactions and accounts to CSV or Excel
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full">
                      <Upload className="mr-2 h-4 w-4" />
                      Restore from Backup
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      Import previously exported data
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-destructive">Danger Zone</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Button variant="destructive" className="w-full">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Wipe All Data
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      Permanently delete all your transactions, accounts, and settings. This action cannot be undone.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Button variant="destructive" className="w-full">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Account
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      Permanently delete your account and all associated data
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Revoke Session Confirmation Dialog */}
      <Dialog open={revokeSessionDialogOpen} onOpenChange={setRevokeSessionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Session</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke this session? This will immediately log out the device 
              and it will need to authenticate again to access your account.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {sessionToRevoke && (
              <div className="p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center justify-center h-8 w-8 bg-muted rounded-full">
                    {sessionToRevoke.deviceType === 'mobile' ? (
                      <Smartphone className="h-4 w-4 text-muted-foreground" />
                    ) : sessionToRevoke.deviceType === 'desktop' ? (
                      <Monitor className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Globe className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium">
                      {sessionToRevoke.deviceType === 'mobile' ? 'Mobile Device' : 
                       sessionToRevoke.deviceType === 'desktop' ? 'Desktop Browser' : 'Unknown Device'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {sessionToRevoke.browser} on {sessionToRevoke.os} • {sessionToRevoke.ipAddress}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRevokeSessionDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (sessionToRevoke) {
                  revokeSession.mutate(sessionToRevoke.id)
                }
              }}
              disabled={revokeSession.isPending}
            >
              {revokeSession.isPending ? "Revoking..." : "Revoke Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke All Other Sessions Confirmation Dialog */}
      <Dialog open={revokeAllDialogOpen} onOpenChange={setRevokeAllDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke All Other Sessions</DialogTitle>
            <DialogDescription>
              This will immediately log out all your other devices and browsers. 
              Only your current session will remain active. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Warning:</strong> This will force all your other devices to re-authenticate. 
                Make sure you have access to your email and password before proceeding.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRevokeAllDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                revokeAllOtherSessions.mutate()
                setRevokeAllDialogOpen(false)
              }}
              disabled={revokeAllOtherSessions.isPending}
            >
              {revokeAllOtherSessions.isPending ? "Revoking..." : "Revoke All Other Sessions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}