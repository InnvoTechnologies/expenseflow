"use client"

import Link from "next/link"
import { useState } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Settings, LogOut, Building2, User, Plus, ChevronRight } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useOrganization } from "@/hooks/use-organization"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function UserProfile() {
  const { user, loading, logout } = useAuth()
  const { 
    organizations, 
    activeOrganization, 
    setActiveOrganization, 
    createOrganization,
    isInitialized
  } = useOrganization()
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newOrgName, setNewOrgName] = useState("")
  const [newOrgSlug, setNewOrgSlug] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  const handleCreateOrganization = async () => {
    if (!newOrgName.trim() || !newOrgSlug.trim()) return

    setIsCreating(true)
    try {
      const org = await createOrganization(newOrgName.trim(), newOrgSlug.trim())
      if (org) {
        setIsCreateDialogOpen(false)
        setNewOrgName("")
        setNewOrgSlug("")
      }
    } catch (error) {
      console.error("Error creating organization:", error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleSetActiveOrg = async (org: any) => {
    await setActiveOrganization(org)
  }

  if (loading || !isInitialized) {
    return (
      <div className="flex items-center gap-3 p-2">
        <div className="h-9 w-9 bg-muted rounded-full animate-pulse" />
        <div className="space-y-2">
          <div className="h-4 bg-muted rounded w-24 animate-pulse" />
          <div className="h-3 bg-muted rounded w-32 animate-pulse" />
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="w-full justify-start p-1.5 h-auto rounded-full hover:bg-zinc-200 dark:hover:bg-white/10">
            <div className="flex items-center gap-2 w-full">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage
                  src={user.image || undefined}
                  alt="User avatar"
                  referrerPolicy="no-referrer"
                  className="object-cover"
                />
                <AvatarFallback className="text-xs">{getInitials(user.name)}</AvatarFallback>
              </Avatar>

              <div className="text-left flex-1 overflow-hidden">
                <div className="flex items-center gap-1">
                  <p className="text-sm font-medium leading-none truncate">{user.name}</p>
                  {activeOrganization && (
                    <div className="h-1.5 w-1.5 rounded-full bg-orange-500 shrink-0" />
                  )}
                </div>
                <p className="text-[10px] text-zinc-500 leading-none mt-1.5 truncate">
                  {activeOrganization ? activeOrganization.name : "Personal Account"}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-zinc-500 shrink-0" />
            </div>
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent align="end" side="top" className="w-64 mb-2 p-2 rounded-[24px] dark:bg-[#121214] border-transparent dark:border-white/5 shadow-xl">
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">My Account</p>
          </div>
          
          <div className="space-y-1">
            {/* Personal Account */}
            <DropdownMenuItem 
              onClick={() => handleSetActiveOrg(null)}
              className={`rounded-[16px] py-2.5 px-3 cursor-pointer ${!activeOrganization ? "bg-zinc-100 dark:bg-white/5" : ""}`}
            >
              <div className="bg-blue-500/10 p-1.5 rounded-full mr-3">
                <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <span className="font-medium text-sm">Personal Account</span>
                <p className="text-[10px] text-muted-foreground mt-0.5">Just you</p>
              </div>
            </DropdownMenuItem>
            
            {/* Organizations */}
            {organizations.length > 0 && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="rounded-[16px] py-2.5 px-3 cursor-pointer">
                  <div className="bg-orange-500/10 p-1.5 rounded-full mr-3">
                    <Building2 className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  <span className="font-medium text-sm">Organizations</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-56 p-2 rounded-[24px] dark:bg-[#121214] border-transparent dark:border-white/5 shadow-xl">
                  <div className="space-y-1">
                    {organizations.map((org) => (
                      <DropdownMenuItem 
                        key={org.id}
                        onClick={() => handleSetActiveOrg(org)}
                        className={`rounded-[16px] py-2.5 px-3 cursor-pointer ${activeOrganization?.id === org.id ? "bg-zinc-100 dark:bg-white/5" : ""}`}
                      >
                        <div className="flex-1">
                          <span className="font-medium text-sm">{org.name}</span>
                          <p className="text-[10px] text-muted-foreground mt-0.5">@{org.slug}</p>
                        </div>
                      </DropdownMenuItem>
                    ))}
                    <div className="h-px bg-border/50 my-2 mx-1" />
                    <DropdownMenuItem onClick={() => setIsCreateDialogOpen(true)} className="rounded-[16px] py-2.5 px-3 cursor-pointer">
                      <Plus className="mr-3 h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">Create Organization</span>
                    </DropdownMenuItem>
                  </div>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
            
            {/* Create Organization (if no existing orgs) */}
            {organizations.length === 0 && (
              <DropdownMenuItem onClick={() => setIsCreateDialogOpen(true)} className="rounded-[16px] py-2.5 px-3 cursor-pointer">
                <div className="bg-zinc-500/10 p-1.5 rounded-full mr-3">
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="font-medium text-sm">Create Organization</span>
              </DropdownMenuItem>
            )}

            <div className="h-px bg-border/50 my-2 mx-1" />
            
            <DropdownMenuItem asChild className="rounded-[16px] py-2.5 px-3 cursor-pointer">
              <Link href="/organizations">
                <Building2 className="mr-3 h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">Manage Organizations</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="rounded-[16px] py-2.5 px-3 cursor-pointer">
              <Link href="/settings">
                <Settings className="mr-3 h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">Settings</span>
              </Link>
            </DropdownMenuItem>
            
            <div className="h-px bg-border/50 my-2 mx-1" />
            
            <DropdownMenuItem onClick={logout} className="rounded-[16px] py-2.5 px-3 cursor-pointer text-red-500 focus:bg-red-500/10 focus:text-red-500">
              <LogOut className="mr-3 h-4 w-4" />
              <span className="font-medium text-sm">Log out</span>
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create Organization Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Organization</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="Enter organization name"
              />
            </div>
            
            <div>
              <Label htmlFor="org-slug">Organization Slug</Label>
              <Input
                id="org-slug"
                value={newOrgSlug}
                onChange={(e) => setNewOrgSlug(e.target.value)}
                placeholder="enter-org-slug"
              />
              <p className="text-sm text-muted-foreground mt-1">
                This will be used in URLs and cannot be changed later.
              </p>
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateOrganization}
                disabled={!newOrgName.trim() || !newOrgSlug.trim() || isCreating}
                className="flex-1"
              >
                {isCreating ? "Creating..." : "Create Organization"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}