"use client"

import { useAuth } from "@/hooks/use-auth"
import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"

const CURRENCY_NAMES: Record<string, string> = {
  PKR: "Pakistani Rupee",
  USD: "US Dollar",
  EUR: "Euro",
  GBP: "British Pound",
  INR: "Indian Rupee",
  AED: "UAE Dirham",
  SAR: "Saudi Riyal",
}

export function useCurrency() {
  const { user } = useAuth()

  // Fetch currency settings from API
  const { data: settings } = useQuery({
    queryKey: ["currency-settings", user?.id],
    queryFn: async () => {
      if (!user?.id) return null
      const res = await apiClient.get("/profile")
      return res.data
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  const baseCurrency = settings?.baseCurrency || "USD"
  const country = settings?.country || "US"
  const numberFormat = settings?.numberFormat ?? 2

  const currencyName = useMemo(() => {
    return CURRENCY_NAMES[baseCurrency] || baseCurrency
  }, [baseCurrency])

  const formatAmount = useMemo(() => {
    return (amount: number | string, currencyCode?: string) => {
      const code = currencyCode || baseCurrency
      const numAmount = typeof amount === "string" ? parseFloat(amount) : amount
      if (isNaN(numAmount)) return `${code} 0.00`

      const formatted = numAmount.toLocaleString(undefined, {
        minimumFractionDigits: numberFormat,
        maximumFractionDigits: numberFormat,
      })

      return `${code} ${formatted}`
    }
  }, [baseCurrency, numberFormat])

  return {
    baseCurrency,
    currencyName,
    country,
    numberFormat,
    formatAmount,
  }
}





