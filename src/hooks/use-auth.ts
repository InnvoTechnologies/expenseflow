import { signOut } from '@/lib/auth-client';
import { useAuthContext } from '@/components/auth-provider';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import posthog from 'posthog-js';

export function useAuth() {
  const { user, loading, refreshUser } = useAuthContext();
  const router = useRouter();

  const logout = useCallback(async () => {
    try {
      // Track logout event before resetting PostHog
      posthog.capture('user_logged_out');
      posthog.reset();

      // First sign out from the API
      await signOut();

      // Then clear local user state
      await refreshUser();
      
      // Force clear any cached data
      localStorage.removeItem('userData');
      localStorage.removeItem('authStatus');
      sessionStorage.clear();
      
      // Clear cookies on client side
      document.cookie.split(";").forEach((cookie) => {
        document.cookie = cookie
          .replace(/^ +/, "")
          .replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
      });
      
      // Set a flag to prevent auth check loops
      sessionStorage.setItem('justLoggedOut', 'true');
      
      // Redirect and force a full page reload to clear any cached state
      window.location.href = '/auth/login?logout=true';
    } catch (error) {
      console.error('Error during logout:', error);
      // Fallback - force redirect even if there was an error
      sessionStorage.setItem('justLoggedOut', 'true');
      window.location.href = '/auth/login?logout=true&error=true';
    }
  }, [refreshUser]);

  return {
    user,
    loading,
    logout,
    refreshUser,
    isAuthenticated: !!user,
  };
} 