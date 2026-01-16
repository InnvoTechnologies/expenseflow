"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  LayoutDashboard,
  Wallet,
  Receipt,
  TrendingUp,
  PiggyBank,
  Settings,
  Tag,
  Bell,
  BellRing,
  Briefcase,
  HelpCircle,
  Users,
  Info,
  Shield,
  Sparkles,
  CreditCard,
} from "lucide-react"
import UserProfile from "./user-profile"
import { Logo } from "./logo"
import { UsageWidget } from "./usage-widget"
import { useAuthContext } from "./auth-provider"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  // { name: "Money", href: "/accounts", icon: Wallet },
  { name: "Transactions", href: "/transactions", icon: Receipt },
  { name: "AI Assistant", href: "/ai-assistant", icon: Sparkles },
  { name: "Insights", href: "/insights", icon: TrendingUp },
  { name: "Savings", href: "/savings", icon: PiggyBank },
  // { name: "Settings", href: "/settings", icon: Settings },
]

const drawerNavigation = [
  { name: "Accounts", href: "/accounts", icon: Wallet },
  { name: "Categories", href: "/categories", icon: Tag },
  { name: "Tags", href: "/tags", icon: Tag },
  { name: "Payees", href: "/payees", icon: Users },
  { name: "Reminders", href: "/reminders", icon: BellRing },
  { name: "Subscriptions", href: "/subscriptions", icon: CreditCard },
  { name: "Notifications", href: "/notifications", icon: Bell },
  { name: "Investments", href: "/investment", icon: Briefcase },
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "About", href: "/about", icon: Info },
  // { name: "Help", href: "/help", icon: HelpCircle },
  // { name: "Invite Friends & Family", href: "/invite", icon: Users },
  // { name: "Privacy Policy", href: "/privacy", icon: Shield },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user } = useAuthContext()

  const navigationItems = [...navigation]

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6 shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
          <Logo width={200} priority />
        </Link>
      </div>

      {/* Navigation - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        <nav className="grid gap-1 items-start px-2 py-2 text-sm font-medium lg:px-4">
          {/* Main Navigation */}
          <div className="space-y-1">
            {navigationItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
              const isComingSoon = item.name === "Savings"
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2 py-2 text-muted-foreground transition-all hover:text-primary",
                    isActive && "bg-muted text-primary"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="flex-1">{item.name}</span>
                  {isComingSoon && (
                    <Badge variant="default" className="text-xs">
                      Coming Soon
                    </Badge>
                  )}
                </Link>
              )
            })}
          </div>

          {/* Divider */}
          <div className="my-2 border-t border-border" />

          {/* Drawer Navigation */}
          <div className="space-y-1">
            {drawerNavigation.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
              const isComingSoon = item.name === "Investments" || item.name === "Savings"
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2 py-2 text-muted-foreground transition-all hover:text-primary",
                    isActive && "bg-muted text-primary"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="flex-1">{item.name}</span>
                  {isComingSoon && (
                    <Badge variant="default" className="text-xs">
                      Coming Soon
                    </Badge>
                  )}
                </Link>
              )
            })}
          </div>
        </nav>
      </div>

      {/* Fixed Bottom Section */}
      <div className="sticky bottom-0 bg-background border-t p-2 shrink-0 space-y-4">
        {/* <UsageWidget /> */}
        <UserProfile />
      </div>
    </div>
  )
}