"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"

export interface Tag {
    id: string
    name: string
    color: string
}

interface TagInputProps {
    value: string[]
    onChange: (value: string[]) => void
    options: Tag[]
    onCreate?: (name: string) => Promise<void>
    disabled?: boolean
}

export function TagInput({ value = [], onChange, options = [], onCreate, disabled }: TagInputProps) {
    const [open, setOpen] = React.useState(false)
    const [inputValue, setInputValue] = React.useState("")

    const selectedTags = value.map(id => options.find(opt => opt.id === id)).filter(Boolean) as Tag[]

    const toggleTag = (id: string) => {
        const newValue = value.includes(id)
            ? value.filter(v => v !== id)
            : [...value, id]
        onChange(newValue)
    }

    const handleCreate = async () => {
        if (onCreate && inputValue) {
            await onCreate(inputValue)
            setInputValue("")
        }
    }

    // Filter options based on input or just let Command handle it?
    // Command handles filtering.

    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2 mb-1">
                {selectedTags.map(tag => (
                    <Badge key={tag.id} variant="secondary" className="pr-1 gap-1" style={{ borderColor: tag.color, borderWidth: 1 }}>
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                        {tag.name}
                        <button
                            type="button"
                            className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            onMouseDown={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                            }}
                            onClick={() => toggleTag(tag.id)}
                        >
                            <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                        </button>
                    </Badge>
                ))}
            </div>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between"
                        disabled={disabled}
                    >
                        {selectedTags.length > 0
                            ? `${selectedTags.length} selected`
                            : "Select tags..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                    <Command>
                        <CommandInput
                            placeholder="Search tags..."
                            value={inputValue}
                            onValueChange={setInputValue}
                        />
                        <CommandList>
                            <CommandEmpty>
                                {onCreate && inputValue && (
                                    <div className="p-2">
                                        <Button variant="ghost" className="w-full justify-start text-sm" onClick={handleCreate}>
                                            <Plus className="mr-2 h-4 w-4" />
                                            Create "{inputValue}"
                                        </Button>
                                    </div>
                                )}
                                {!inputValue && "No tags found."}
                            </CommandEmpty>
                            <CommandGroup>
                                {options.map((option) => (
                                    <CommandItem
                                        key={option.id}
                                        value={option.name} // Command uses this for filtering
                                        onSelect={() => {
                                            toggleTag(option.id)
                                        }}
                                    >
                                        <div className="flex items-center gap-2 w-full">
                                            <Check
                                                className={cn(
                                                    "mr-2 h-4 w-4",
                                                    value.includes(option.id) ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: option.color }} />
                                            <span>{option.name}</span>
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    )
}
