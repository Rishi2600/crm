"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import Dialog from "@/components/ui/Dialog";

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

  function handleChoice(result: boolean) {
    setOpen(false);
    resolveRef.current?.(result);
    resolveRef.current = null;
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <Dialog
          open={open}
          onClose={() => handleChoice(false)}
          title={options.title}
          description={options.message}
          maxWidth="400px"
          footer={
            <>
              <button
                onClick={() => handleChoice(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium"
                style={{ color: "var(--text-muted)" }}
              >
                {options.cancelLabel ?? "Cancel"}
              </button>
              <button
                onClick={() => handleChoice(true)}
                className="px-4 py-2 rounded-lg text-xs font-medium"
                style={{
                  background: options.danger ? "var(--red)" : "var(--text)",
                  color: options.danger ? "#ffffff" : "var(--bg)",
                }}
              >
                {options.confirmLabel ?? "Confirm"}
              </button>
            </>
          }
        >
          {null}
        </Dialog>
      )}
    </ConfirmContext.Provider>
  );
}