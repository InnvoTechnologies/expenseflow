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
          <Button variant="ghost" className="w-full justify-start p-2 h-auto">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                <AvatarImage
                  src={user.image || undefined}
                  alt="User avatar"
                  referrerPolicy="no-referrer"
                  className="object-cover"
                />
                <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
              </Avatar>

              <div className="text-left flex-1">
                <p className="text-sm font-medium leading-none">{user.name}</p>
                <p className="text-xs text-muted-foreground leading-none mt-1">{user.email}</p>
                {activeOrganization && (
                  <div className="flex items-center gap-1 mt-1">
                    <Building2 className="h-3 w-3 text-orange-500" />
                    <span className="text-xs text-orange-600 dark:text-orange-400">
                      {activeOrganization.name}
                    </span>
                  </div>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent align="end" side="top" className="w-64 mb-2">
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {/* Personal Account */}
          <DropdownMenuItem 
            onClick={() => handleSetActiveOrg(null)}
            className={!activeOrganization ? "bg-accent" : ""}
          >
            <User className="mr-2 h-4 w-4 text-blue-600" />
            <div className="flex-1">
              <span>Personal Account</span>
              <p className="text-xs text-muted-foreground">Just you</p>
            </div>
          </DropdownMenuItem>
          
          {/* Organizations */}
          {organizations.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Building2 className="mr-2 h-4 w-4 text-orange-600" />
                  <span>Organizations</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-56">
                  {organizations.map((org) => (
                    <DropdownMenuItem 
                      key={org.id}
                      onClick={() => handleSetActiveOrg(org)}
                      className={activeOrganization?.id === org.id ? "bg-accent" : ""}
                    >
                      <div className="flex-1">
                        <span className="font-medium">{org.name}</span>
                        <p className="text-xs text-muted-foreground">@{org.slug}</p>
                      </div>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    <span>Create Organization</span>
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </>
          )}
          
          {/* Create Organization (if no existing orgs) */}
          {organizations.length === 0 && (
            <DropdownMenuItem onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              <span>Create Organization</span>
            </DropdownMenuItem>
          )}
          
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/organizations">
              <Building2 className="mr-2 h-4 w-4" />
              <span>Manage Organizations</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log out</span>
          </DropdownMenuItem>
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