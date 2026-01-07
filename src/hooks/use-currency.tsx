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

type Account = {
  id: string
  currency: string
  isDefault: boolean
}

export function useCurrency() {
  const { user } = useAuth()

  const { data: accounts } = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: async () => {
      const res = await apiClient.get("/accounts")
      return res.data
    },
    enabled: !!user, // Only fetch if user is logged in
  })

  const baseCurrency = useMemo(() => {
    if (!accounts || accounts.length === 0) return "USD"
    
    const defaultAccount = accounts.find((a) => a.isDefault)
    return defaultAccount?.currency || accounts[0]?.currency || "USD"
  }, [accounts])

  const country = user?.country || "Us"
  const numberFormat = user?.numberFormat ?? 2

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





