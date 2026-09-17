"use client";

// Promise-based confirmation, built on the shadcn/Radix AlertDialog. The
// `useConfirm()` API is unchanged.
//
// FLAG: AlertDialog deliberately does not close when the backdrop is
// clicked; Escape and Cancel still close it and resolve `false`. That is
// the standard accessible behaviour for a destructive confirmation, and the
// owner accepted the difference from the old modal.

import { createContext, useCallback, useContext, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button red — use for destructive actions (delete, etc.) */
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

// Mirrors window.confirm's ergonomics on purpose — one function call,
// `await` it, get a boolean back. That simplicity is the entire reason
// window.confirm gets reached for in the first place; this keeps that
// while giving us full control over how it actually looks.
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within <ConfirmProvider>");
  return ctx;
}

export default function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  // Kept after closing so the dialog's content doesn't vanish mid-animation.
  const [options, setOptions] = useState<ConfirmOptions | null>(null);

  // Holds the Promise's resolve function between when confirm() is called
  // and when the user actually clicks Confirm/Cancel — a ref survives
  // across renders without triggering one itself.
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  // Clicking Confirm runs its onClick (resolving true) and then Radix closes
  // the dialog, which calls onOpenChange and so this again with false. The
  // resolver is cleared after the first call, so the second is a no-op and
  // each confirm() settles exactly once.
  function settle(result: boolean) {
    setOpen(false);
    resolveRef.current?.(result);
    resolveRef.current = null;
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={open} onOpenChange={(next) => { if (!next) settle(false); }}>
        {options && (
          <AlertDialogContent className="max-w-[400px] rounded-xl bg-card sm:rounded-xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-sm font-medium">{options.title}</AlertDialogTitle>
              <AlertDialogDescription className="text-xs">{options.message}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2 sm:space-x-0">
              <AlertDialogCancel className="mt-0">{options.cancelLabel ?? "Cancel"}</AlertDialogCancel>
              <AlertDialogAction
                className={cn(options.danger && buttonVariants({ variant: "destructive" }))}
                onClick={() => settle(true)}
              >
                {options.confirmLabel ?? "Confirm"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}
