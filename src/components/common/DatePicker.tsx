"use client";

// The app's date field: a button that opens a calendar in a popover. Built
// on the shadcn Popover and Calendar, with the same props as the hand-built
// version it replaced, so no call site changed.

import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  /** "YYYY-MM-DD", or "" for no date. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Put on the trigger button, so a <Label htmlFor> can name the field. */
  id?: string;
}

// The value is a plain calendar date with no time zone. Parsing it as local
// midnight, and formatting it back from local fields, keeps the picked day
// from shifting by one for anyone outside UTC. `new Date("2026-09-12")` would
// parse as UTC midnight and show 11 September west of Greenwich.
function parseValue(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function toValue(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

function formatDisplay(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function DatePicker({
  value,
  onChange,
  placeholder = "Select date",
  className,
  id,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = parseValue(value);

  return (
    <div className={cn("relative", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn(
              "w-full justify-between bg-transparent px-3 font-normal",
              !selected && "text-muted-foreground"
            )}
          >
            <span className="truncate">{selected ? formatDisplay(selected) : placeholder}</span>
            <CalendarIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          {/* `required` stops a second click on the chosen day from clearing
              it; picking any day, including the current one, confirms and
              closes, as the old picker did. Clearing has its own button. */}
          <Calendar
            mode="single"
            required
            selected={selected}
            defaultMonth={selected}
            onSelect={(date) => {
              onChange(toValue(date));
              setOpen(false);
            }}
          />
          {value && (
            <div className="border-t p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                Clear date
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
