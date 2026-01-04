import { createAuthClient } from "better-auth/client";
import { emailOTPClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:3000",
  plugins: [
    emailOTPClient()
  ],
  fetchOptions: {
    credentials: 'include',
    cache: 'no-store',
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  }
});

// Export all auth client methods
export const { 
  signIn, 
  signUp, 
  signOut, 
  getSession, 
  linkSocial,
  changePassword,
  requestPasswordReset,
  resetPassword,
  sendVerificationEmail,
  emailOtp,
} = authClient;

// Import our custom organization client
import { organizationClient } from './organization-client';
export { organizationClient as organization };

// Helper function to get current user with improved error handling and caching
export const getCurrentUser = async () => {
  try {
    console.log('[Auth Client] Getting current user');
    
    // Force a fresh session check with even stronger no-cache options
    const session = await getSession({
      query: {
        disableCookieCache: true,
        disableRefresh: false,
      },
      fetchOptions: {
        cache: 'no-store',
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      }
    });
    
    const userData = (session as any)?.data?.user || null;
    console.log('[Auth Client] Current user:', userData ? 'User found' : 'No user');
    
    if (userData) {
      console.log('[Auth Client] User data retrieved:', userData.name || userData.email);
      
      // Cache the user data in localStorage for quick access
      localStorage.setItem('userData', JSON.stringify({
        user: userData,
        timestamp: Date.now()
      }));

      localStorage.setItem("token",(session as any)?.data?.session?.token)
      
      // Also remove the logged out flag if it exists
      sessionStorage.removeItem('justLoggedOut');
    } else {
      localStorage.removeItem('userData');
      localStorage.removeItem("token")
    }
    
    return userData;
  } catch (error) {
    console.error("[Auth Client] Error getting current user:", error);
    localStorage.removeItem('userData');
    return null;
  }
};

// Helper function to check if user is authenticated with improved caching and social login awareness
export const isAuthenticated = async () => {
  try {
    console.log('[Auth Client] Running isAuthenticated check');
    
    // Check for logout flag
    if (typeof window !== 'undefined') {
      if (sessionStorage.getItem('justLoggedOut') === 'true') {
        console.log('[Auth Client] Just logged out flag found, returning false');
        return false;
      }
      
      // Check for social login success markers
      const searchParams = new URLSearchParams(window.location.search);
      const authSuccess = searchParams.get('auth_success') === 'true';
      const hasRefreshCookie = document.cookie.includes('auth_refresh_required=true');
      
      if (authSuccess || hasRefreshCookie) {
        console.log('[Auth Client] Social login detected, forcing validation with no cache');
        
        // First try with a short delay to allow cookies to be properly set
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Extra force for social login case - completely bypass all caches
        const freshSession = await getSession({
          query: {
            disableCookieCache: true,
            disableRefresh: false,
          },
          fetchOptions: {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0',
              'X-Force-Auth-Check': 'true',
              'X-Timestamp': Date.now().toString(),
            },
            credentials: 'include' // Ensure cookies are sent
          }
        });
        
        const isAuth = !!((freshSession as any)?.data?.user);
        console.log('[Auth Client] Social login auth check result:', isAuth ? 'Authenticated' : 'Not authenticated');
        
        if (isAuth) {
          // Update auth state in storage
          localStorage.setItem('userData', JSON.stringify({
            user: (freshSession as any)?.data?.user,
            timestamp: Date.now()
          }));
          localStorage.setItem('authStatus', JSON.stringify({
            authenticated: true,
            timestamp: Date.now()
          }));
          localStorage.setItem("token",(freshSession as any)?.data?.session?.token)
          
          // Clean up the auth_success parameter
          if (typeof window !== 'undefined' && authSuccess) {
            const cleanUrl = new URL(window.location.href);
            cleanUrl.searchParams.delete('auth_success');
            cleanUrl.searchParams.delete('ts');
            window.history.replaceState({}, document.title, cleanUrl.toString());
          }
          
          // Clear the refresh cookie
          if (hasRefreshCookie) {
            document.cookie = 'auth_refresh_required=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
          }
        }
        
        return isAuth;
      }
    }
    
    // Force a fresh check with the server for auth status
    console.log('[Auth Client] Checking authentication with server');
    const session = await getSession({
      query: {
        disableCookieCache: true,
      },
      fetchOptions: {
        headers: {
          'Cache-Control': 'no-cache',
          'X-Timestamp': Date.now().toString(), // Add timestamp to prevent caching
        }
      }
    });
    console.log('[Auth Client] Session response:', session ? 'Session found' : 'No session');
    
    const isAuth = !!((session as any)?.data?.user);
    
    // Update auth status cache
    if (typeof window !== 'undefined') {
      if (isAuth) {
        console.log('[Auth Client] Server says user is authenticated, caching result');
        localStorage.setItem('userData', JSON.stringify({
          user: (session as any)?.data?.user,
          timestamp: Date.now()
        }));
        localStorage.setItem('authStatus', JSON.stringify({
          authenticated: true,
          timestamp: Date.now()
        }));
        localStorage.setItem("token",(session as any)?.data?.session?.token)
      } else {
        console.log('[Auth Client] Server says user is not authenticated');
        localStorage.removeItem('userData');
        localStorage.setItem('authStatus', JSON.stringify({
          authenticated: false,
          timestamp: Date.now()
        }));
        localStorage.removeItem("token")
      }
    }
    
    return isAuth;
  } catch (error) {
    console.error('[Auth Client] Authentication check failed:', error);
    return false;
  }
}; 