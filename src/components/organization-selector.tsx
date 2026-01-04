"use client";

import { useState, useEffect } from "react";
import { organizationClient } from "@/lib/organization-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronDown, Plus, Building2, User } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useOrganization } from "@/hooks/use-organization";
import { Organization } from "@/app/(protected)/organizations/page";

export function OrganizationSelector() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const {
    organizations,
    activeOrganization,
    isLoading,
    createOrganization: createOrgHook,
    setActiveOrganization: setActiveOrgHook
  } = useOrganization();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateOrganization = async () => {
    if (!newOrgName.trim() || !newOrgSlug.trim()) return;

    setIsCreating(true);
    try {
      const newOrg = await createOrgHook(newOrgName.trim(), newOrgSlug.trim());

      if (newOrg) {
        setIsCreateDialogOpen(false);
        setNewOrgName("");
        setNewOrgSlug("");
        toast.success("Organization created successfully");

        // Invalidate all agents queries to trigger refetch with new organization context
        queryClient.invalidateQueries({ queryKey: ['agents'] });
        queryClient.invalidateQueries({ queryKey: ['agents', 'playground'] });
      }
    } catch (error) {
      console.error("Error creating organization:", error);
      toast.error("Failed to create organization");
    } finally {
      setIsCreating(false);
    }
  };

  const handleSetActiveOrg = async (org: Organization | null) => {
    try {
      await setActiveOrgHook(org);
      if (org) {
        toast.success(`Switched to ${org.name}`);
      } else {
        toast.success("Switched to personal account");
      }

      // Invalidate all data queries to refresh with new organization context
      // Using exact: false to invalidate all queries that start with these keys
      queryClient.invalidateQueries({ queryKey: ['accounts'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['categories'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['payees'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['reminders'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['transactions'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['dashboard'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['insights'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['agents'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['api-keys'], exact: false });

    } catch (error) {
      console.error("Error setting active organization:", error);
      toast.error("Failed to switch organization");
    }
  };

  if (!user) return null;

  return (
    <div className="relative">
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <div className="flex items-center gap-2">
              {activeOrganization ? (
                <>
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={activeOrganization.logo} />
                    <AvatarFallback className="text-xs">
                      {activeOrganization.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">{activeOrganization.name}</span>
                </>
              ) : (
                <>
                  <User className="h-4 w-4" />
                  <span>Personal Account</span>
                </>
              )}
            </div>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DialogTrigger>

        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Switch Organization</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Personal Account */}
            <div
              className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50"
              onClick={() => handleSetActiveOrg(null)}
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-blue-100 text-blue-600">
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="font-medium">Personal Account</div>
                <div className="text-sm text-gray-500">{user.name}</div>
              </div>
            </div>

            {/* Organizations */}
            {organizations.map((org) => (
              <div
                key={org.id}
                className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50"
                onClick={() => handleSetActiveOrg(org)}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={org.logo} />
                  <AvatarFallback className="bg-gradient-to-br from-orange-400 to-blue-500 text-white">
                    {org.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="font-medium">{org.name}</div>
                  <div className="text-sm text-gray-500">@{org.slug}</div>
                </div>
              </div>
            ))}

            {/* Create New Organization */}
            <div className="pt-4 border-t">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setIsCreateDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New Organization
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
              <p className="text-sm text-gray-500 mt-1">
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
    </div>
  );
}
