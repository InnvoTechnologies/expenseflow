"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { LoadingSpinner } from '@/components/loading-spinner'

export default function Home() {
  const router = useRouter()
  const { user, loading } = useAuth()
  
  useEffect(() => {
    // Wait for auth context to load before making any decisions
    if (loading) return
    
    if (user) {
      // If authenticated, redirect to dashboard
      router.replace('/dashboard')
    } else {
      // If not authenticated, redirect to login
      router.replace('/auth/login')
    }
  }, [user, loading, router])

  return (
    <div className="flex h-screen w-full items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  )
}