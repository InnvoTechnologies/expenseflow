"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { authClient } from "@/lib/auth-client";
import { organizationClient } from "@/lib/organization-client";
import { useAuth } from "./use-auth";
import { setOrganizationContext } from "@/lib/api-client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface Organization {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  role?: string;
}

interface OrganizationContextType {
  activeOrganization: Organization | null;
  organizations: Organization[];
  isLoading: boolean;
  setActiveOrganization: (org: Organization | null) => Promise<void>;
  createOrganization: (name: string, slug: string) => Promise<Organization | null>;
  refreshOrganizations: () => Promise<void>;
  isInitialized: boolean;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeOrganization, setActiveOrganizationState] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Fetch user's organizations and active organization
  useEffect(() => {
    if (user) {
      initializeOrganizationContext();
    } else {
      setOrganizations([]);
      setActiveOrganizationState(null);
      setIsInitialized(false);
      // Clear organization context when user logs out
      setOrganizationContext(null, 'personal');
    }
  }, [user]);

  const initializeOrganizationContext = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // First, get the user's organizations
      const { data, error } = await organizationClient.list();
      if (data && !error) {
        setOrganizations(data);
      }

      // Then, get the active organization from localStorage
      const storedActiveOrg = localStorage.getItem('activeOrganization');
      if (storedActiveOrg) {
        try {
          const parsedOrg = JSON.parse(storedActiveOrg);
          // Verify the user is still a member of this organization
          const isMember = data?.some((org: Organization) => org.id === parsedOrg.id);

          if (isMember) {
            setActiveOrganizationState(parsedOrg);
            setOrganizationContext(parsedOrg.id, 'organization');
          } else {
            // If not a member (or org deleted), clear active org
            setActiveOrganizationState(null);
            setOrganizationContext(null, 'personal');
            localStorage.removeItem('activeOrganization');
          }
        } catch (e) {
          console.error("Error parsing stored active organization:", e);
          setActiveOrganizationState(null);
          setOrganizationContext(null, 'personal');
          localStorage.removeItem('activeOrganization');
        }
      } else {
        setActiveOrganizationState(null);
        setOrganizationContext(null, 'personal');
      }

      setIsInitialized(true);
    } catch (error) {
      console.error("Error initializing organization context:", error);
      setIsInitialized(true);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshOrganizations = async () => {
    if (!user) return;

    try {
      const { data, error } = await organizationClient.list();
      if (data && !error) {
        setOrganizations(data);

        // If we have an active organization, make sure it's still valid
        if (activeOrganization) {
          const isMember = data.some((org: Organization) => org.id === activeOrganization.id);
          if (!isMember) {
            setActiveOrganization(null);
          } else {
            // Update the active organization with latest data
            const updatedOrg = data.find((org: Organization) => org.id === activeOrganization.id);
            if (updatedOrg) {
              setActiveOrganizationState(updatedOrg);
              localStorage.setItem('activeOrganization', JSON.stringify(updatedOrg));
            }
          }
        }
      } else {
        toast.error(error || "Failed to fetch organizations");
      }
    } catch (error) {
      console.error("Error fetching organizations:", error);
      toast.error("Failed to fetch organizations");
    }
  };

  const setActiveOrganization = async (org: Organization | null) => {
    try {
      if (org) {
        setActiveOrganizationState(org);
        // Sync with localStorage for API client
        setOrganizationContext(org.id, 'organization');
        // Store in localStorage for persistence
        localStorage.setItem('activeOrganization', JSON.stringify(org));
      } else {
        // Set to personal account
        setActiveOrganizationState(null);
        // Sync with localStorage for API client
        setOrganizationContext(null, 'personal');
        // Remove from localStorage
        localStorage.removeItem('activeOrganization');
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
      toast.error("Failed to set active organization");
    }
  };

  const createOrganization = async (name: string, slug: string): Promise<Organization | null> => {
    try {
      const { data, error } = await organizationClient.create({
        name: name.trim(),
        slug: slug.trim(),
        keepCurrentActiveOrganization: false,
      });

      if (data && !error) {
        // Add role information to the created organization
        const orgWithRole = { ...data, role: 'owner' };
        setOrganizations(prev => [...prev, orgWithRole]);
        setActiveOrganizationState(orgWithRole);
        // Sync with localStorage for API client
        setOrganizationContext(orgWithRole.id, 'organization');
        return orgWithRole;
      } else {
        toast.error(error || "Failed to create organization");
      }
      return null;
    } catch (error) {
      console.error("Error creating organization:", error);
      toast.error("Failed to create organization");
      return null;
    }
  };

  const value: OrganizationContextType = {
    activeOrganization,
    organizations,
    isLoading,
    setActiveOrganization,
    createOrganization,
    refreshOrganizations,
    isInitialized,
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error("useOrganization must be used within an OrganizationProvider");
  }
  return context;
}
