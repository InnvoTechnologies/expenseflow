"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { LoadingSpinner } from '@/components/loading-spinner'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, loading, refreshUser } = useAuth()
  
  useEffect(() => {
    // Don't do anything while auth is still loading
    if (loading) return
    
    // Handle special OAuth callback cases
    const handleOAuthCallback = async () => {
      const hasAuthSuccess = window.location.search.includes('auth_success=true')
      const hasRefreshRequired = document.cookie.includes('auth_refresh_required=true')
      
      if (hasAuthSuccess || hasRefreshRequired) {
        console.log('[ProtectedRoute] OAuth callback detected, refreshing user data')
        
        // Clear the auth_refresh_required cookie
        if (hasRefreshRequired) {
          document.cookie = 'auth_refresh_required=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;'
        }
        
        // Small delay to ensure cookies are properly set
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Refresh user data
        await refreshUser()
        
        // Clean up URL
        if (hasAuthSuccess) {
          const cleanUrl = new URL(window.location.href)
          cleanUrl.searchParams.delete('auth_success')
          cleanUrl.searchParams.delete('ts')
          window.history.replaceState({}, document.title, cleanUrl.toString())
        }
        
        return
      }
    }
    
    // If no user after auth has loaded, redirect to login
    if (!user) {
      console.log('[ProtectedRoute] User not authenticated, redirecting to login')
      const currentPath = window.location.pathname
      if (currentPath !== '/auth/login') {
        sessionStorage.setItem('redirectAfterLogin', currentPath)
      }
      router.replace('/auth/login')
      return
    }
    
    // Handle OAuth callbacks
    handleOAuthCallback()
  }, [user, loading, router, refreshUser])
  
  // Show loading while auth context is loading
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }
  
  // Show nothing while redirecting (user is null and loading is false)
  if (!user) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }
  
  // User is authenticated, render children
  return <>{children}</>
}
