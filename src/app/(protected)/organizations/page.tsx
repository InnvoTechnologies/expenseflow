"use client";

import { useState, useMemo, useEffect } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as currencyCodes from "currency-codes";
import { getData as getCountries } from "country-list";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

const ALL_COUNTRIES = getCountries().sort((a, b) => a.name.localeCompare(b.name));

function getCurrencyList() {
  return currencyCodes
    .codes()
    .map((code: string) => {
      const currency = currencyCodes.code(code)
      return {
        code: code || "",
        name: currency?.currency || "",
      }
    })
    .filter((c) => c.code && c.name)
    .sort((a, b) => a.code.localeCompare(b.code))
}

function slugify(text: string) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/&/g, "-and-") // Replace & with 'and'
    .replace(/[^\w\-]+/g, "") // Remove all non-word characters
    .replace(/\-\-+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start of text
    .replace(/-+$/, ""); // Trim - from end of text
}

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
  const [isSlugTouched, setIsSlugTouched] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<"checking" | "available" | "unavailable" | null>(null);
  
  // Edit organization state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [editOrgName, setEditOrgName] = useState("");
  const [editOrgSlug, setEditOrgSlug] = useState("");
  const [editOrgCurrency, setEditOrgCurrency] = useState("USD");
  const [editOrgCountry, setEditOrgCountry] = useState("US");
  const [editOrgNumberFormat, setEditOrgNumberFormat] = useState(2);
  const [editCurrencyOpen, setEditCurrencyOpen] = useState(false);
  const [editCountryOpen, setEditCountryOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const currencyList = useMemo(() => getCurrencyList(), []);
  
  // Delete organization state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingOrg, setDeletingOrg] = useState<Organization | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const findAvailableSlug = async (baseSlug: string): Promise<string> => {
    let currentSlug = baseSlug;
    let counter = 0;
    
    while (true) {
      try {
        const { data, error } = await organizationClient.checkSlug({ slug: currentSlug });
        if (!error && data?.available) {
          return currentSlug;
        }
      } catch (e) {
        console.error("Error checking slug availability:", e);
        return currentSlug;
      }
      
      counter++;
      currentSlug = `${baseSlug}-${counter}`;
      if (counter > 10) {
        return currentSlug;
      }
    }
  };

  // Reset form states when dialog opens/closes
  useEffect(() => {
    if (!isCreateDialogOpen) {
      setNewOrgName("");
      setNewOrgSlug("");
      setIsSlugTouched(false);
      setSlugAvailable(null);
    }
  }, [isCreateDialogOpen]);

  // Debounced slug check effect
  useEffect(() => {
    if (!newOrgSlug.trim()) {
      setSlugAvailable(null);
      return;
    }

    setSlugAvailable("checking");
    const delayDebounce = setTimeout(async () => {
      try {
        const { data, error } = await organizationClient.checkSlug({ slug: newOrgSlug.trim() });
        if (!error) {
          if (data?.available) {
            setSlugAvailable("available");
          } else {
            setSlugAvailable("unavailable");
            const baseSlug = newOrgSlug.trim();
            const availableSlug = await findAvailableSlug(baseSlug);
            setNewOrgSlug(availableSlug);
            setSlugAvailable("available");
          }
        } else {
          setSlugAvailable(null);
        }
      } catch (err) {
        console.error(err);
        setSlugAvailable(null);
      }
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [newOrgSlug]);

  const handleCreateOrganization = async () => {
    const slugRegex = /^[a-z0-9-]+$/;
    if (!newOrgName.trim()) {
      toast.error("Organization name cannot be empty");
      return;
    }
    if (!newOrgSlug.trim()) {
      toast.error("Organization slug cannot be empty");
      return;
    }
    if (!slugRegex.test(newOrgSlug.trim())) {
      toast.error("Slug can only contain lowercase letters, numbers, and hyphens (e.g. 'my-org')");
      return;
    }
    if (slugAvailable === "checking") {
      toast.error("Please wait while we check slug availability");
      return;
    }
    if (slugAvailable === "unavailable") {
      toast.error("This slug is already taken. Please choose another one.");
      return;
    }

    setIsCreating(true);
    try {
      const org = await createOrganization(newOrgName.trim(), newOrgSlug.trim());
      if (org) {
        setIsCreateDialogOpen(false);
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
    setEditOrgCurrency((org as any).baseCurrency || "USD");
    setEditOrgCountry((org as any).country || "US");
    setEditOrgNumberFormat((org as any).numberFormat ?? 2);
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
          baseCurrency: editOrgCurrency,
          country: editOrgCountry,
          numberFormat: editOrgNumberFormat,
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
          <h1 className="text-3xl sm:text-4xl font-medium tracking-tight">Organizations</h1>
          <p className="text-muted-foreground">
            Manage your organizations and team access
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full">
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
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewOrgName(val);
                    if (!isSlugTouched) {
                      setNewOrgSlug(slugify(val));
                    }
                  }}
                  placeholder="e.g. Acme Corp"
                  className="rounded-full bg-zinc-100/50 dark:bg-white/5 border-transparent"
                />
              </div>
              
              <div>
                <Label htmlFor="org-slug">Organization Slug</Label>
                <Input
                  id="org-slug"
                  value={newOrgSlug}
                  onChange={(e) => {
                    setNewOrgSlug(slugify(e.target.value));
                    setIsSlugTouched(true);
                  }}
                  placeholder="e.g. acme-corp"
                  className="rounded-full bg-zinc-100/50 dark:bg-white/5 border-transparent"
                />
                {slugAvailable === "checking" && (
                  <p className="text-xs text-amber-500 mt-1 ml-1 animate-pulse">Checking slug availability...</p>
                )}
                {slugAvailable === "available" && (
                  <p className="text-xs text-green-500 mt-1 ml-1">✓ Slug is available</p>
                )}
                {slugAvailable === "unavailable" && (
                  <p className="text-xs text-red-500 mt-1 ml-1">✗ Slug is taken. Finding an alternative...</p>
                )}
                <p className="text-sm text-muted-foreground mt-1.5 ml-1">
                  This will be used in URLs and cannot be changed later.
                </p>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  className="flex-1 rounded-full"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateOrganization}
                  disabled={!newOrgName.trim() || !newOrgSlug.trim() || isCreating || slugAvailable === "checking" || slugAvailable === "unavailable"}
                  className="flex-1 rounded-full"
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
                className="rounded-full bg-zinc-100/50 dark:bg-white/5 border-transparent"
              />
            </div>
            
            <div>
              <Label htmlFor="edit-org-slug">Organization Slug</Label>
              <Input
                id="edit-org-slug"
                value={editOrgSlug}
                disabled
                className="rounded-full bg-zinc-100/50 dark:bg-white/5 border-transparent"
              />
              <p className="text-sm text-muted-foreground mt-1">
                This will be used in URLs and cannot be changed later.
              </p>
            </div>

            <div className="space-y-2 flex flex-col">
              <Label className="mb-1">Base Currency</Label>
              <Popover open={editCurrencyOpen} onOpenChange={setEditCurrencyOpen} modal={true}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={editCurrencyOpen}
                    className="w-full justify-between rounded-full bg-zinc-100/50 dark:bg-white/5 border border-transparent hover:border-zinc-200 dark:hover:border-white/10 h-10 px-4 font-normal text-left hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-900 dark:text-zinc-100"
                  >
                    <span className="truncate">
                      {editOrgCurrency
                        ? `${editOrgCurrency} - ${currencyList.find((c) => c.code === editOrgCurrency)?.name || ""}`
                        : "Select currency"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2 rounded-[24px] dark:bg-[#121214] border border-white/5 shadow-2xl" align="start">
                  <Command className="bg-transparent">
                    <CommandInput placeholder="Search currency..." className="rounded-full border-none focus-visible:ring-0 focus-visible:ring-offset-0 px-4 mb-2" />
                    <CommandList className="max-h-[200px]">
                      <CommandEmpty>No currency found.</CommandEmpty>
                      <CommandGroup>
                        {currencyList.map((c) => (
                          <CommandItem
                            key={c.code}
                            value={`${c.code} ${c.name}`}
                            onSelect={() => {
                              setEditOrgCurrency(c.code);
                              setEditCurrencyOpen(false);
                            }}
                            className="rounded-lg cursor-pointer"
                          >
                            <div className="flex items-center gap-2 w-full">
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  editOrgCurrency === c.code ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <span>{c.code} - {c.name}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="space-y-2 flex flex-col">
              <Label className="mb-1">Country</Label>
              <Popover open={editCountryOpen} onOpenChange={setEditCountryOpen} modal={true}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={editCountryOpen}
                    className="w-full justify-between rounded-full bg-zinc-100/50 dark:bg-white/5 border border-transparent hover:border-zinc-200 dark:hover:border-white/10 h-10 px-4 font-normal text-left hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-900 dark:text-zinc-100"
                  >
                    <span className="truncate">
                      {editOrgCountry
                        ? ALL_COUNTRIES.find((c) => c.code === editOrgCountry)?.name || editOrgCountry
                        : "Select country"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2 rounded-[24px] dark:bg-[#121214] border border-white/5 shadow-2xl" align="start">
                  <Command className="bg-transparent">
                    <CommandInput placeholder="Search country..." className="rounded-full border-none focus-visible:ring-0 focus-visible:ring-offset-0 px-4 mb-2" />
                    <CommandList className="max-h-[200px]">
                      <CommandEmpty>No country found.</CommandEmpty>
                      <CommandGroup>
                        {ALL_COUNTRIES.map((c) => (
                          <CommandItem
                            key={c.code}
                            value={c.name}
                            onSelect={() => {
                              setEditOrgCountry(c.code);
                              setEditCountryOpen(false);
                            }}
                            className="rounded-lg cursor-pointer"
                          >
                            <div className="flex items-center gap-2 w-full">
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  editOrgCountry === c.code ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <span>{c.name}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Number Format</Label>
              <Select 
                value={editOrgNumberFormat.toString()} 
                onValueChange={(value) => setEditOrgNumberFormat(parseInt(value))}
              >
                <SelectTrigger className="rounded-full bg-zinc-100/50 dark:bg-white/5 border-transparent h-10 px-4">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl dark:bg-[#121214] dark:border-white/10">
                  <SelectItem value="0">0 decimal places</SelectItem>
                  <SelectItem value="2">2 decimal places</SelectItem>
                  <SelectItem value="3">3 decimal places</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                disabled={isUpdating}
                className="rounded-full"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateOrganization}
                disabled={!editOrgName.trim() || isUpdating}
                className="rounded-full"
              >
                {isUpdating ? "Updating..." : "Update Organization"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Personal Account Card */}
      <Card className="border-none shadow-none dark:bg-[#121214] bg-zinc-50 rounded-[24px]">
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
          <Card key={org.id} className="border-none shadow-none dark:bg-[#121214] bg-zinc-50 rounded-[24px]">
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
                    className="flex-1 rounded-full"
                  >
                    {activeOrganization?.id === org.id ? "Active" : "Switch to"}
                  </Button>
                  {org.role === 'owner' && (
                    <div className="flex gap-1">
                      <Button 
                        variant="outline" 
                        className="rounded-full h-8 w-8 p-0"
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
                        className="rounded-full h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
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
        <Card className="border-none shadow-none dark:bg-[#121214] bg-zinc-50 rounded-[24px]">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No organizations yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first organization to start collaborating with your team.
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)} className="rounded-full">
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
                className="rounded-full"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="rounded-full"
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
