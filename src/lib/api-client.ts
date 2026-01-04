import axios from 'axios';

export const apiClient = axios.create({
    baseURL: '/api',
    headers: {
        'Content-Type': 'application/json',
    },
    // This is important for sending cookies with requests
    withCredentials: true,
});

// Add a request interceptor to handle authentication and organization scoping
apiClient.interceptors.request.use(
    (config) => {
        // Ensure cookies are sent with every request
        config.withCredentials = true;
        
        // Add organization context to request headers if available
        if (typeof window !== 'undefined') {
            const orgContext = localStorage.getItem('organizationContext');
            if (orgContext) {
                try {
                    const { organizationId, scope } = JSON.parse(orgContext);
                    if (organizationId && scope === 'organization') {
                        config.headers['X-Organization-Id'] = organizationId;
                    }
                } catch (e) {
                    // Ignore parsing errors
                }
            }
        }
        
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Add a response interceptor to handle errors
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        // Handle common errors here
        if (error.response?.status === 401) {
            // Handle unauthorized access
            window.location.href = '/auth/login';
        } else if (error.response?.status === 403) {
            // Handle forbidden access (organization access denied)
            console.error('Access denied: You may not have permission to access this resource in the current organization context');
        } else if (error.response?.status === 404) {
            // Handle not found
            console.error('Resource not found');
        }
        return Promise.reject(error);
    }
);

/**
 * Helper function to create organization-scoped API calls
 */
export function createOrganizationScopedClient() {
    return {
        get: (url: string, config?: any) => {
            return apiClient.get(url, config);
        },
        post: (url: string, data?: any, config?: any) => {
            return apiClient.post(url, data, config);
        },
        put: (url: string, data?: any, config?: any) => {
            return apiClient.put(url, data, config);
        },
        delete: (url: string, config?: any) => {
            return apiClient.delete(url, config);
        },
        patch: (url: string, data?: any, config?: any) => {
            return apiClient.patch(url, data, config);
        },
    };
}

/**
 * Helper function to add organization context to localStorage
 */
export function setOrganizationContext(organizationId: string | null, scope: 'personal' | 'organization') {
    if (typeof window !== 'undefined') {
        localStorage.setItem('organizationContext', JSON.stringify({
            organizationId,
            scope,
            timestamp: Date.now()
        }));
    }
}

/**
 * Helper function to get organization context from localStorage
 */
export function getOrganizationContext() {
    if (typeof window !== 'undefined') {
        const orgContext = localStorage.getItem('organizationContext');
        if (orgContext) {
            try {
                return JSON.parse(orgContext);
            } catch (e) {
                return null;
            }
        }
    }
    return null;
} 