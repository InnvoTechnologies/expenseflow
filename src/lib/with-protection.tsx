"use client"

import { ReactNode, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'

interface ProtectedLayoutProps {
  children: ReactNode
}

/**
 * A wrapper component that protects routes by checking authentication
 * Any page component that needs protection should be wrapped with this
 */
export function withProtection<P extends object>(Component: React.ComponentType<P>) {
  return function ProtectedComponent(props: P) {
    const { user, loading } = useAuth()
    const router = useRouter()

    useEffect(() => {
      // If not loading and no user, redirect to login
      if (!loading && !user) {
        router.replace('/auth/login')
      }
    }, [loading, user, router])

    // Show nothing while loading or if not authenticated
    if (loading || !user) {
      return null
    }

    return <Component {...props} />
  }
}
