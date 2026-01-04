"use client";

import { useOrganization } from "./use-organization";
import { useAuth } from "./use-auth";

export interface OrganizationScope {
  organizationId: string | null;
  isPersonalAccount: boolean;
  scope: "personal" | "organization";
  canAccess: (resourceOrgId: string | null) => boolean;
  isInitialized: boolean;
}

/**
 * Hook that provides organization scoping context for data fetching and access control
 */
export function useOrganizationScope(): OrganizationScope {
  const { user } = useAuth();
  const { activeOrganization, isInitialized } = useOrganization();

  // If no user or not initialized, no access
  if (!user || !isInitialized) {
    return {
      organizationId: null,
      isPersonalAccount: true,
      scope: "personal",
      canAccess: () => false,
      isInitialized: false,
    };
  }

  // If no active organization, user is in personal account mode
  if (!activeOrganization) {
    return {
      organizationId: null,
      isPersonalAccount: true,
      scope: "personal",
      canAccess: (resourceOrgId: string | null) => {
        // Can access personal resources (null orgId) and resources from their personal org
        return resourceOrgId === null;
      },
      isInitialized: true,
    };
  }

  // User is in organization mode
  return {
    organizationId: activeOrganization.id,
    isPersonalAccount: false,
    scope: "organization",
    canAccess: (resourceOrgId: string | null) => {
      // Can access resources from the active organization
      return resourceOrgId === activeOrganization.id;
    },
    isInitialized: true,
  };
}

/**
 * Hook that provides organization-scoped query parameters
 * Use this for API calls that need to be scoped to the current organization context
 */
export function useOrganizationQueryParams() {
  const { organizationId, isPersonalAccount, isInitialized } = useOrganizationScope();

  if (!isInitialized) {
    return {
      organizationId: undefined,
      userId: undefined,
    };
  }

  return {
    // For personal account, don't filter by organization
    // For organization mode, filter by the active organization
    organizationId: isPersonalAccount ? undefined : organizationId,
    // Always include userId for personal access control
    userId: isPersonalAccount ? undefined : undefined,
  };
}

/**
 * Hook that provides organization context for forms and data creation
 */
export function useOrganizationFormContext() {
  const { organizationId, isPersonalAccount, isInitialized } = useOrganizationScope();

  if (!isInitialized) {
    return {
      organizationId: null,
      isPersonalAccount: true,
      defaultValues: {
        organizationId: null,
      },
    };
  }

  return {
    organizationId: organizationId || null,
    isPersonalAccount,
    // Default values for forms
    defaultValues: {
      organizationId: organizationId || null,
    },
  };
}
