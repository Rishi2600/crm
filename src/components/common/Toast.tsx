"use client";

// App-wide toast notifications, shown with Sonner. `useToast()` and
// `showToast(message, type)` are unchanged.

import { createContext, useCallback, useContext, useMemo } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Info } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "info";

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// The hook every page uses to fire a toast. Kept as a single function
// signature (message, type) rather than separate showSuccess/showError/
// showInfo helpers — one shape to remember, callers just pass the type.
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

const ICONS: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const ICON_CLASS: Record<ToastType, string> = {
  success: "text-success",
  error: "text-destructive",
  info: "text-muted-foreground",
};

// Auto-dismiss after 3.5s — long enough to read, short enough not to pile up.
const DURATION_MS = 3500;

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const showToast = useCallback((message: string, type: ToastType = "success") => {
    const Icon = ICONS[type];
    // Rendered as custom markup rather than Sonner's built-in toast. Sonner's
    // own toasts have no click handler, and clicking anywhere on a toast to
    // dismiss it is existing behaviour. Custom toasts also skip Sonner's
    // default styling, shadow included, so the design's borders apply.
    toast.custom(
      (id) => (
        <button
          type="button"
          onClick={() => toast.dismiss(id)}
          className="flex w-full items-center gap-2.5 rounded-xl border bg-card px-4 py-3 text-left text-sm text-foreground"
        >
          <Icon size={16} strokeWidth={2} className={cn("shrink-0", ICON_CLASS[type])} aria-hidden />
          <span>{message}</span>
        </button>
      ),
      { duration: DURATION_MS }
    );
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster position="bottom-right" />
    </ToastContext.Provider>
  );
}
