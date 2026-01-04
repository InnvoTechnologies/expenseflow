"use client"

import { createContext, useContext, useEffect, useState } from 'react'
import { getCurrentUser } from '@/lib/auth-client'

interface AuthContextType {
  user: any | null
  loading: boolean
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = async () => {
    try {
      console.log('[AuthProvider] Refreshing user data')
      
      // First check if we have a special auth cookie set by OAuth callbacks
      const hasRefreshRequired = typeof document !== 'undefined' && 
                               document.cookie.includes('auth_refresh_required=true');
      
      // Force a new session check with no caching
      const currentUser = await getCurrentUser()
      console.log('[AuthProvider] Refreshed user data:', currentUser ? 'User found' : 'No user')
      
      // If we found a user, update state and clear any special auth cookies
      if (currentUser) {
        setUser(currentUser)
        
        // Clear the auth_refresh_required cookie if it exists
        if (hasRefreshRequired && typeof document !== 'undefined') {
          document.cookie = 'auth_refresh_required=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        }
      } else {
        setUser(null)
      }
      
      return currentUser
    } catch (error) {
      console.error('[AuthProvider] Error refreshing user:', error)
      setUser(null)
      return null
    }
  }

  useEffect(() => {
    const loadUser = async () => {
      try {
        console.log('[AuthProvider] Starting initial user load')
        
        // First try to load from cache for immediate UI update
        const cachedData = localStorage.getItem('userData');
        const token = localStorage.getItem('token');
        if (cachedData) {
          const { user: cachedUser, timestamp } = JSON.parse(cachedData);
          // Use cached data if it's less than 5 minutes old
          if (Date.now() - timestamp < 5 * 60 * 1000 && cachedUser) {
            console.log('[AuthProvider] Using cached user data')
            setUser({
              ...cachedUser,
              token
            });
            setLoading(false);
            // Still fetch fresh data but don't block the UI
            getCurrentUser().then(freshUser => {
              if (freshUser) {
                setUser({
                  ...freshUser,
                  token: localStorage.getItem('token')
                });
              }
            }).catch(err => console.error('Background user refresh failed:', err));
            return;
          }
        }
        
        // Fetch from server for latest data
        console.log('[AuthProvider] Fetching fresh user data')
        const currentUser = await getCurrentUser();
        const currentToken = localStorage.getItem('token');
        
        if (currentUser) {
          setUser({
            ...currentUser,
            token: currentToken
          });
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('[AuthProvider] Error loading user:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
    
    // Set up interval to periodically check authentication status (less frequently)
    const interval = setInterval(async () => {
      try {
        const currentUser = await getCurrentUser();
        const currentToken = localStorage.getItem('token');
        
        if (currentUser) {
          setUser((prevUser: any) => {
            // Only update if there's a meaningful change
            if (!prevUser || prevUser.id !== currentUser.id) {
              return {
                ...currentUser,
                token: currentToken
              };
            }
            return prevUser;
          });
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('[AuthProvider] Error refreshing user:', error);
      }
    }, 10 * 60 * 1000); // Check every 10 minutes instead of 5
    
    return () => clearInterval(interval);
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }
  return context
} 