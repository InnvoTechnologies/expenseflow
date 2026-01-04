"use client"

import * as React from "react"
import Image from "next/image"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"

interface LogoProps {
  className?: string
  width?: number
  height?: number
  priority?: boolean
}

export function Logo({ className, width = 120, height = 25, priority = false }: LogoProps) {
  const { theme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Show light logo as fallback during hydration
  if (!mounted) {
    return (
      <Image
        src="/logo-light.svg"
        alt="ExpenseFlow"
        width={width}
        height={height}
        priority={priority}
        className={cn("h-auto", className)}
      />
    )
  }

  const isDark = resolvedTheme === "dark"

  return (
    <Image
      src={isDark ? "/logo-light.svg" : "/logo-dark.svg"}
      alt="ExpenseFlow"
      width={width}
      height={height}
      priority={priority}
      className={cn("h-auto", className)}
    />
  )
}