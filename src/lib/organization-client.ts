const baseURL = process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:3000";

export const organizationClient = {
  // List user's organizations
  list: async () => {
    try {
      const response = await fetch(`${baseURL}/api/organization`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      return { data: data.data, error: data.status >= 400 ? data.message : null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  // Create new organization
  create: async ({ name, slug, keepCurrentActiveOrganization = false }: {
    name: string;
    slug: string;
    keepCurrentActiveOrganization?: boolean;
  }) => {
    try {
      const response = await fetch(`${baseURL}/api/organization`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, slug, keepCurrentActiveOrganization }),
      });

      const data = await response.json();
      return { data: data.data, error: data.status >= 400 ? data.message : null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  // Update organization
  update: async ({ data, organizationId }: {
    data: { name?: string; slug?: string; logo?: string; metadata?: any };
    organizationId?: string;
  }) => {
    try {
      const response = await fetch(`${baseURL}/api/organization/update`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data, organizationId }),
      });

      const result = await response.json();
      return { data: result.data, error: result.status >= 400 ? result.message : null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  // Delete organization
  delete: async ({ organizationId }: { organizationId: string }) => {
    try {
      const response = await fetch(`${baseURL}/api/organization/delete`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ organizationId }),
      });

      const data = await response.json();
      return { data: data.data, error: data.status >= 400 ? data.message : null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  // Check slug availability
  checkSlug: async ({ slug }: { slug: string }) => {
    try {
      const response = await fetch(`${baseURL}/api/organization/check-slug`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ slug }),
      });

      const data = await response.json();
      return { data: data.data, error: data.status >= 400 ? data.message : null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },


};
