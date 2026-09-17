"use client";

// The app's dropdown, built on the shadcn/Radix Select. Its props are the
// same as the hand-built version it replaced, so no call site changed.
//
// Radix renders the list in a portal, positions it against the trigger and
// keeps it on screen, so the old manual position tracking, outside-click
// handling and `mounted` guard are gone.

import {
  Select as SelectRoot,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  /** Applied to the wrapper; call sites use it to set the width. */
  className?: string;
  align?: "left" | "right";
  /** Put on the trigger, so a <Label htmlFor> can name the field. */
  id?: string;
}

// FLAG: Radix reserves "" to mean "nothing selected" and shows the
// placeholder for it, so an option whose value is "" could never appear as
// the chosen one. Four call sites use "" for an "All ..." option ("All
// agents" and so on), so "" is swapped for this sentinel going in and
// swapped back coming out.
const EMPTY_OPTION = "__empty_option__";

const toRadix = (value: string) => (value === "" ? EMPTY_OPTION : value);
const fromRadix = (value: string) => (value === EMPTY_OPTION ? "" : value);

export default function Select({
  value,
  onChange,
  options,
  placeholder = "Select...",
  className,
  align = "left",
  id,
}: SelectProps) {
  // A value that matches no option shows the placeholder, as it always did.
  // Callers rely on that: the Follow-up "Mark as" menu keeps its value at ""
  // with no "" option, so it always reads "Mark as" and every pick counts as
  // a change.
  const matches = options.some((o) => o.value === value);

  return (
    <div className={cn("relative", className)}>
      <SelectRoot
        value={matches ? toRadix(value) : ""}
        onValueChange={(next) => onChange(fromRadix(next))}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent align={align === "right" ? "end" : "start"}>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={toRadix(opt.value)}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </SelectRoot>
    </div>
  );
}
