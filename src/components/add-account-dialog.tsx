"use client"

import { useState, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useCurrency } from "@/hooks/use-currency"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Wallet, CreditCard, Building2, Users, PiggyBank, Briefcase } from "lucide-react"
import * as currencyCodes from "currency-codes"

interface AddAccountDialogProps {
  children: React.ReactNode
}

const accountTypes = [
  { value: "cash", label: "Cash", icon: Wallet },
  { value: "bank", label: "Bank", icon: Building2 },
  { value: "wallet", label: "Wallet", icon: Wallet },
  { value: "card", label: "Card", icon: CreditCard },
  { value: "savings", label: "Savings", icon: PiggyBank },
  { value: "investment", label: "Investment", icon: Briefcase },
  { value: "person", label: "Person", icon: Users },
]

export function AddAccountDialog({ children }: AddAccountDialogProps) {
  const [open, setOpen] = useState(false)
  const [accountType, setAccountType] = useState("")
  const [isPersonAccount, setIsPersonAccount] = useState(false)
  const [selectedCurrency, setSelectedCurrency] = useState<string>("")
  const { baseCurrency } = useCurrency()

  // Get all currencies and sort them
  const currencyList = useMemo(() => {
    return currencyCodes
      .codes()
      .map((code: string) => {
        const currency = currencyCodes.code(code)
        return {
          code: code || "",
          name: currency?.currency || "",
        }
      })
      .filter((c) => c.code && c.name) // Filter out invalid entries
      .sort((a, b) => a.code.localeCompare(b.code))
  }, [])

  // Reset currency when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedCurrency(baseCurrency)
    }
  }, [open, baseCurrency])

  const handleAccountTypeChange = (value: string) => {
    setAccountType(value)
    setIsPersonAccount(value === "person")
  }

  const handleSubmit = () => {
    // TODO: Implement account creation
    console.log("Creating account...")
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto sm:rounded-[24px] dark:bg-[#09090B] dark:border-white/5 shadow-2xl p-6 sm:p-8">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold tracking-tight">Add Account</DialogTitle>
          <DialogDescription className="text-zinc-500 dark:text-zinc-400">
            Create a new account to track your finances
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Account Name</Label>
            <Input id="name" placeholder="e.g., My Wallet" className="rounded-full bg-zinc-100/50 dark:bg-white/5 border-transparent h-10 px-4" />
          </div>
          <div className="space-y-2">
            <Label>Account Type</Label>
            <Select value={accountType} onValueChange={handleAccountTypeChange}>
              <SelectTrigger className="rounded-full bg-zinc-100/50 dark:bg-white/5 border-transparent h-10 px-4">
                <SelectValue placeholder="Select account type" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl dark:bg-[#121214] dark:border-white/10">
                {accountTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      <type.icon className="h-4 w-4" />
                      <span>{type.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Currency</Label>
            <Select 
              value={selectedCurrency || baseCurrency} 
              onValueChange={setSelectedCurrency}
              disabled
            >
              <SelectTrigger className="rounded-full bg-zinc-100/50 dark:bg-white/5 border-transparent h-10 px-4">
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px] rounded-2xl dark:bg-[#121214] dark:border-white/10">
                {currencyList.map((currency) => (
                  <SelectItem key={currency.code} value={currency.code}>
                    {currency.code} - {currency.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="openingBalance">Opening Balance</Label>
            <Input id="openingBalance" type="number" placeholder="0.00" className="rounded-full bg-zinc-100/50 dark:bg-white/5 border-transparent h-10 px-4" />
          </div>
          {isPersonAccount && (
            <>
              <div className="space-y-2">
                <Label>Direction</Label>
                <Select defaultValue="receivable">
                  <SelectTrigger className="rounded-full bg-zinc-100/50 dark:bg-white/5 border-transparent h-10 px-4">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl dark:bg-[#121214] dark:border-white/10">
                    <SelectItem value="receivable">Receivable (They owe me)</SelectItem>
                    <SelectItem value="payable">Payable (I owe them)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone (Optional)</Label>
                <Input id="phone" type="tel" placeholder="+92 300 1234567" className="rounded-full bg-zinc-100/50 dark:bg-white/5 border-transparent h-10 px-4" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email (Optional)</Label>
                <Input id="email" type="email" placeholder="person@example.com" className="rounded-full bg-zinc-100/50 dark:bg-white/5 border-transparent h-10 px-4" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="note">Note (Optional)</Label>
                <Input id="note" placeholder="Additional information" className="rounded-full bg-zinc-100/50 dark:bg-white/5 border-transparent h-10 px-4" />
              </div>
            </>
          )}
        </div>
        <DialogFooter className="pt-4 mt-2">
          <Button variant="ghost" onClick={() => setOpen(false)} className="rounded-full hover:dark:bg-white/5">
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="rounded-full dark:bg-white dark:text-black dark:hover:bg-white/90">
            Create Account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

