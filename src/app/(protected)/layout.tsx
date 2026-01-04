"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { ProtectedRoute } from "@/components/protected-route"
import { OrganizationProvider } from "@/hooks/use-organization"

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute>
      <OrganizationProvider>
      <DashboardLayout>{children}</DashboardLayout>
      </OrganizationProvider>
    </ProtectedRoute>
  )
}
