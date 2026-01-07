"use client";

import { useState } from "react";
import { useOrganization } from "@/hooks/use-organization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Plus, Building2, Users, Calendar, Settings, Edit, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { organizationClient } from "@/lib/organization-client";
import { toast } from "sonner";
import posthog from "posthog-js";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  role?: string;
};

export default function OrganizationsPage() {
  const { user } = useAuth();
  const { 
    organizations, 
    activeOrganization, 
    isLoading, 
    createOrganization,
    setActiveOrganization,
    refreshOrganizations
  } = useOrganization();
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  
  // Edit organization state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [editOrgName, setEditOrgName] = useState("");
  const [editOrgSlug, setEditOrgSlug] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Delete organization state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingOrg, setDeletingOrg] = useState<Organization | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCreateOrganization = async () => {
    if (!newOrgName.trim() || !newOrgSlug.trim()) return;

    setIsCreating(true);
    try {
      const org = await createOrganization(newOrgName.trim(), newOrgSlug.trim());
      if (org) {
        setIsCreateDialogOpen(false);
        setNewOrgName("");
        setNewOrgSlug("");
        toast.success("Organization created successfully");

        // Track organization creation
        posthog.capture('organization_created', {
          organization_name: newOrgName.trim(),
          organization_slug: newOrgSlug.trim(),
        });
      }
    } catch (error) {
      console.error("Error creating organization:", error);
      toast.error("Failed to create organization");

      // Track organization creation error
      posthog.captureException(error as Error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSetActive = async (org: any) => {
    try {
      await setActiveOrganization(org);
      if (org) {
        toast.success(`Switched to ${org.name}`);

        // Track organization switch
        posthog.capture('organization_switched', {
          organization_name: org.name,
          organization_id: org.id,
          switch_type: 'to_organization',
        });
      } else {
        toast.success("Switched to personal account");

        // Track switch to personal account
        posthog.capture('organization_switched', {
          switch_type: 'to_personal',
        });
      }
    } catch (error) {
      console.error("Error setting active organization:", error);
      toast.error("Failed to switch organization");

      // Track organization switch error
      posthog.captureException(error as Error);
    }
  };

  const handleEditOrganization = (org: Organization) => {
    setEditingOrg(org);
    setEditOrgName(org.name);
    setEditOrgSlug(org.slug);
    setIsEditDialogOpen(true);
  };

  const handleUpdateOrganization = async () => {
    if (!editingOrg || !editOrgName.trim() || !editOrgSlug.trim()) return;

    setIsUpdating(true);
    try {
      const { data, error } = await organizationClient.update({
        data: {
          name: editOrgName.trim(),
          slug: editOrgSlug.trim(),
        },
        organizationId: editingOrg.id,
      });

      if (data && !error) {
        // Refresh organizations to get updated data
        await refreshOrganizations();
        setIsEditDialogOpen(false);
        setEditingOrg(null);
        setEditOrgName("");
        setEditOrgSlug("");
        toast.success("Organization updated successfully");
      } else {
        toast.error(error || "Failed to update organization");
      }
    } catch (error) {
      console.error("Error updating organization:", error);
      toast.error("Failed to update organization");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteOrganization = (org: Organization) => {
    setDeletingOrg(org);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingOrg) return;

    setIsDeleting(true);
    try {
      const { data, error } = await organizationClient.delete({
        organizationId: deletingOrg.id,
      });

      if (data && !error) {
        // Refresh organizations to get updated data
        await refreshOrganizations();
        setIsDeleteDialogOpen(false);
        setDeletingOrg(null);
        toast.success("Organization deleted successfully");
      } else {
        toast.error(error || "Failed to delete organization");
      }
    } catch (error) {
      console.error("Error deleting organization:", error);
      toast.error("Failed to delete organization");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Organizations</h1>
          <p className="text-muted-foreground">
            Manage your organizations and team access
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Organization
            </Button>
          </DialogTrigger>
          
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
      </div>

      {/* Edit Organization Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-org-name">Organization Name</Label>
              <Input
                id="edit-org-name"
                value={editOrgName}
                onChange={(e) => setEditOrgName(e.target.value)}
                placeholder="Enter organization name"
              />
            </div>
            
            <div>
              <Label htmlFor="edit-org-slug">Organization Slug</Label>
              <Input
                id="edit-org-slug"
                value={editOrgSlug}
                disabled
                placeholder="enter-org-slug"
              />
              <p className="text-sm text-muted-foreground mt-1">
                This will be used in URLs and cannot be changed later.
              </p>
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                disabled={isUpdating}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateOrganization}
                disabled={!editOrgName.trim() || isUpdating}
              >
                {isUpdating ? "Updating..." : "Update Organization"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Personal Account Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-blue-100 text-blue-600">
                {user.name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            Personal Account
          </CardTitle>
          <CardDescription>
            Your personal workspace for individual projects
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>Just you</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Created {new Date(user.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
            <Button
              variant={!activeOrganization ? "default" : "outline"}
              onClick={() => handleSetActive(null)}
            >
              {!activeOrganization ? "Active" : "Switch to Personal"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Organizations */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {organizations.map((org) => (
          <Card key={org.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={org.logo} />
                  <AvatarFallback className="bg-gradient-to-br from-orange-400 to-blue-500 text-white">
                    {org.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {org.name}
              </CardTitle>
              <CardDescription>@{org.slug}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>Team members</span>
                  </div>
                  <Badge variant="secondary">{org.role || 'Member'}</Badge>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Created {new Date(org.createdAt).toLocaleDateString()}</span>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant={activeOrganization?.id === org.id ? "default" : "outline"}
                    onClick={() => handleSetActive(org)}
                    className="flex-1"
                  >
                    {activeOrganization?.id === org.id ? "Active" : "Switch to"}
                  </Button>
                  {org.role === 'owner' && (
                    <div className="flex gap-1">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleEditOrganization(org)}
                        title="Edit organization"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDeleteOrganization(org)}
                        title="Delete organization"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {organizations.length === 0 && !isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No organizations yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first organization to start collaborating with your team.
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Organization
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Delete Organization Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Organization</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Are you sure you want to delete <strong>{deletingOrg?.name}</strong>? 
              This action cannot be undone and will permanently remove the organization 
              and all associated data.
            </p>
            
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setIsDeleteDialogOpen(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete Organization"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
