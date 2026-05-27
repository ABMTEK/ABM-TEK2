"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

interface Option {
    name: string;
    [key: string]: any;
}

interface SearchableSelectProps {
    options: Option[];
    value: string;
    onValueChange: (value: string) => void;
    placeholder?: string;
    emptyText?: string;
    allowCustom?: boolean;
}

export function SearchableSelect({
    options,
    value,
    onValueChange,
    placeholder = "Select option...",
    emptyText = "No option found.",
    allowCustom = true,
}: SearchableSelectProps) {
    const [open, setOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState("");

    const filteredOptions = options.filter((option) =>
        option.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const isCustomValue = searchQuery && !options.some(opt => opt.name.toLowerCase() === searchQuery.toLowerCase());

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between font-normal"
                >
                    {value ? value : <span className="text-muted-foreground">{placeholder}</span>}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
                <div className="flex items-center border-b px-3">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <input
                        className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="max-h-[300px] overflow-y-auto overflow-x-hidden p-1">
                    {filteredOptions.length === 0 && !allowCustom && (
                        <div className="py-6 text-center text-sm">{emptyText}</div>
                    )}

                    {filteredOptions.map((option) => (
                        <div
                            key={option.name}
                            className={cn(
                                "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                                value === option.name && "bg-accent text-accent-foreground"
                            )}
                            onClick={() => {
                                onValueChange(option.name);
                                setOpen(false);
                                setSearchQuery("");
                            }}
                        >
                            <Check
                                className={cn(
                                    "mr-2 h-4 w-4",
                                    value === option.name ? "opacity-100" : "opacity-0"
                                )}
                            />
                            {option.name}
                        </div>
                    ))}

                    {allowCustom && isCustomValue && (
                        <div
                            className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground text-blue-600 font-medium border-t mt-1"
                            onClick={() => {
                                onValueChange(searchQuery);
                                setOpen(false);
                                setSearchQuery("");
                            }}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Use "{searchQuery}"
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
