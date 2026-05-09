"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"

interface Member {
  id: string
  name: string
  avatar?: string
}

interface Group {
  id: string
  name: string
  currency: string
  members: Member[]
}

interface AddExpenseDialogProps {
  children: React.ReactNode
  group: Group
}

export function AddExpenseDialog({ children, group }: AddExpenseDialogProps) {
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [paidBy, setPaidBy] = useState<string>(group.members[0]?.id || "")
  const [splitType, setSplitType] = useState("equal")
  const [selectedMembers, setSelectedMembers] = useState<string[]>(group.members.map(m => m.id))
  
  // State for different split types
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>({})
  const [percentages, setPercentages] = useState<Record<string, string>>({})

  // Initialize splits when amount or members change
  useEffect(() => {
    if (open) {
      // Reset or init logic
    }
  }, [open])

  const handleMemberToggle = (memberId: string) => {
    setSelectedMembers(prev => 
      prev.includes(memberId) 
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Validate splits add up to total amount
    console.log("Adding expense:", { 
      description, 
      amount, 
      paidBy, 
      splitType, 
      selectedMembers,
      exactAmounts: splitType === 'exact' ? exactAmounts : null,
      percentages: splitType === 'percent' ? percentages : null
    })
    setOpen(false)
  }

  const numericAmount = parseFloat(amount) || 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Expense</DialogTitle>
          <DialogDescription>
            Add a new expense to {group.name}
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1 pr-4 -mr-4">
        <form id="add-expense-form" onSubmit={handleSubmit} className="grid gap-4 py-4 px-1">
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="e.g. Dinner"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="amount">Amount ({group.currency})</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="paidBy">Paid By</Label>
              <Select value={paidBy} onValueChange={setPaidBy}>
                <SelectTrigger id="paidBy">
                  <SelectValue placeholder="Select payer" />
                </SelectTrigger>
                <SelectContent>
                  {group.members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <Label>Split Options</Label>
            <Tabs value={splitType} onValueChange={setSplitType} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="equal">Equally</TabsTrigger>
                <TabsTrigger value="exact">Exact Amount</TabsTrigger>
                <TabsTrigger value="percent">Percentage</TabsTrigger>
              </TabsList>
              
              <div className="mt-4 border rounded-md p-4">
                <TabsContent value="equal" className="mt-0 space-y-4">
                  <div className="text-sm text-muted-foreground mb-4">
                    Selected members split the total equally: 
                    <span className="font-bold ml-1">
                      {selectedMembers.length > 0 
                        ? (numericAmount / selectedMembers.length).toFixed(2) 
                        : "0.00"} {group.currency}/person
                    </span>
                  </div>
                  {group.members.map((member) => (
                    <div key={member.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`member-${member.id}`} 
                        checked={selectedMembers.includes(member.id)}
                        onCheckedChange={() => handleMemberToggle(member.id)}
                      />
                      <Label htmlFor={`member-${member.id}`} className="flex-1 cursor-pointer">
                        {member.name}
                      </Label>
                    </div>
                  ))}
                </TabsContent>
                
                <TabsContent value="exact" className="mt-0 space-y-4">
                  <div className="text-sm text-muted-foreground mb-4">
                     Specify exact amount for each person. Remaining: 
                     <span className={`font-bold ml-1 ${(numericAmount - Object.values(exactAmounts).reduce((a, b) => a + (parseFloat(b) || 0), 0)) !== 0 ? "text-red-500" : "text-green-500"}`}>
                        {(numericAmount - Object.values(exactAmounts).reduce((a, b) => a + (parseFloat(b) || 0), 0)).toFixed(2)} {group.currency}
                     </span>
                  </div>
                   {group.members.map((member) => (
                    <div key={member.id} className="flex items-center space-x-2">
                       <Label className="w-1/3 truncate">{member.name}</Label>
                       <Input 
                          type="number" 
                          step="0.01" 
                          placeholder="0.00"
                          value={exactAmounts[member.id] || ""}
                          onChange={(e) => setExactAmounts({...exactAmounts, [member.id]: e.target.value})}
                       />
                    </div>
                  ))}
                </TabsContent>
                
                <TabsContent value="percent" className="mt-0 space-y-4">
                  <div className="text-sm text-muted-foreground mb-4">
                     Specify percentage for each person. Total: 
                     <span className={`font-bold ml-1 ${(Object.values(percentages).reduce((a, b) => a + (parseFloat(b) || 0), 0)) !== 100 ? "text-red-500" : "text-green-500"}`}>
                        {Object.values(percentages).reduce((a, b) => a + (parseFloat(b) || 0), 0).toFixed(0)}%
                     </span>
                  </div>
                   {group.members.map((member) => (
                    <div key={member.id} className="flex items-center space-x-2">
                       <Label className="w-1/3 truncate">{member.name}</Label>
                       <div className="relative flex-1">
                        <Input 
                            type="number" 
                            step="1" 
                            placeholder="0"
                            value={percentages[member.id] || ""}
                            onChange={(e) => setPercentages({...percentages, [member.id]: e.target.value})}
                        />
                        <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">%</span>
                       </div>
                       <div className="w-20 text-right text-sm text-muted-foreground">
                          {((parseFloat(percentages[member.id] || "0") / 100) * numericAmount).toFixed(2)}
                       </div>
                    </div>
                  ))}
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </form>
        </ScrollArea>
        
        <DialogFooter className="mt-4">
          <Button type="submit" form="add-expense-form">Add Expense</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
