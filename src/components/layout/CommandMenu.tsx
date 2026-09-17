"use client";

// A navigation-only command palette: type a page name, press Enter, go
// there. Opened with Cmd/Ctrl+K, the top bar's search button, or the
// sidebar's search entry. It searches page names only; there is no data
// search behind it.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { NAV_ITEMS } from "@/components/layout/nav";

interface CommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CommandMenu({ open, onOpenChange }: CommandMenuProps) {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        // Some browsers bind Ctrl+K to their own search bar.
        event.preventDefault();
        onOpenChange(!open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Go to a page..." />
      <CommandList>
        <CommandEmpty>No matching page.</CommandEmpty>
        <CommandGroup heading="Pages">
          {NAV_ITEMS.map((item) => (
            <CommandItem
              key={item.href}
              value={item.label}
              onSelect={() => {
                onOpenChange(false);
                router.push(item.href);
              }}
            >
              <item.icon className="text-muted-foreground" aria-hidden />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
