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
  { name: "Split Payments", href: "/groups", icon: Users },
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
    <div className="flex h-full flex-col dark:bg-[#09090B] border-r dark:border-white/5">
      {/* Header */}
      <div className="flex h-14 items-center border-b dark:border-white/5 px-4 lg:h-[60px] lg:px-6 shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold transition-opacity hover:opacity-80">
          <Logo width={200} priority />
        </Link>
      </div>

      {/* Navigation - Scrollable */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <nav className="flex flex-col gap-1 items-start px-3 py-3 text-sm font-medium">
          {/* Main Navigation */}
          <div className="space-y-0.5 w-full">
            <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Core</div>
            {navigationItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
              const isComingSoon = item.name === "Savings"
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-zinc-500 transition-all hover:text-zinc-900 dark:hover:text-zinc-200 dark:hover:bg-white/5",
                    isActive && "bg-zinc-100 text-zinc-900 dark:bg-white/5 dark:text-zinc-100"
                  )}
                >
                  <item.icon className="h-[18px] w-[18px] stroke-[1.5]" />
                  <span className="flex-1 font-medium text-[13px]">{item.name}</span>
                  {isComingSoon && (
                    <Badge variant="outline" className="text-[10px] uppercase font-semibold tracking-wider dark:border-white/10 dark:bg-transparent dark:text-zinc-500">
                      Soon
                    </Badge>
                  )}
                </Link>
              )
            })}
          </div>

          {/* Divider */}
          <div className="my-2 w-full border-t dark:border-white/5" />

          {/* Drawer Navigation */}
          <div className="space-y-0.5 w-full">
            <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Manage</div>
            {drawerNavigation.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
              const isComingSoon = item.name === "Investments" || item.name === "Savings" || item.name === "Split Payments"
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-zinc-500 transition-all hover:text-zinc-900 dark:hover:text-zinc-200 dark:hover:bg-white/5",
                    isActive && "bg-zinc-100 text-zinc-900 dark:bg-white/5 dark:text-zinc-100"
                  )}
                >
                  <item.icon className="h-[18px] w-[18px] stroke-[1.5]" />
                  <span className="flex-1 font-medium text-[13px]">{item.name}</span>
                  {isComingSoon && (
                    <Badge variant="outline" className="text-[10px] uppercase font-semibold tracking-wider dark:border-white/10 dark:bg-transparent dark:text-zinc-500">
                      Soon
                    </Badge>
                  )}
                </Link>
              )
            })}
          </div>
        </nav>
      </div>

      {/* Fixed Bottom Section */}
      <div className="sticky bottom-0 dark:bg-[#09090B] border-t dark:border-white/5 p-2 shrink-0">
        {/* <UsageWidget /> */}
        <UserProfile />
      </div>
    </div>
  )
}