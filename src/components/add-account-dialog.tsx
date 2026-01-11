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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Account</DialogTitle>
          <DialogDescription>
            Create a new account to track your finances
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Account Name</Label>
            <Input id="name" placeholder="e.g., My Wallet" />
          </div>
          <div className="space-y-2">
            <Label>Account Type</Label>
            <Select value={accountType} onValueChange={handleAccountTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select account type" />
              </SelectTrigger>
              <SelectContent>
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
            >
              <SelectTrigger>
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
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
            <Input id="openingBalance" type="number" placeholder="0.00" />
          </div>
          {isPersonAccount && (
            <>
              <div className="space-y-2">
                <Label>Direction</Label>
                <Select defaultValue="receivable">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receivable">Receivable (They owe me)</SelectItem>
                    <SelectItem value="payable">Payable (I owe them)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone (Optional)</Label>
                <Input id="phone" type="tel" placeholder="+92 300 1234567" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email (Optional)</Label>
                <Input id="email" type="email" placeholder="person@example.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="note">Note (Optional)</Label>
                <Input id="note" placeholder="Additional information" />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            Create Account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

