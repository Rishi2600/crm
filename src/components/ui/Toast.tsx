"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle, Info } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

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

const ICON_COLOR: Record<ToastType, string> = {
  success: "var(--green)",
  error: "var(--red)",
  info: "var(--text-muted)",
};

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    // Auto-dismiss after 3.5s — long enough to read, short enough not to pile up
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const dismiss = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 items-end">
            <AnimatePresence>
              {toasts.map((t) => {
                const Icon = ICONS[t.type];
                return (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, y: 12, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.12 } }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    onClick={() => dismiss(t.id)}
                    className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm cursor-pointer max-w-sm"
                    style={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--border)",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                      color: "var(--text)",
                    }}
                  >
                    <Icon size={16} strokeWidth={2} style={{ color: ICON_COLOR[t.type], flexShrink: 0 }} />
                    <span>{t.message}</span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}