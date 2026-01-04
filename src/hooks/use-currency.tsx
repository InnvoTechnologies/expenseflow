"use client"

import { useAuth } from "@/hooks/use-auth"
import { useMemo } from "react"

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

  const baseCurrency = user?.baseCurrency || "PKR"
  const country = user?.country || "PK"
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





