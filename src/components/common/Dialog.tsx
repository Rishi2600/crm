"use client";

// The app's modal. Built on the shadcn/Radix Dialog, with the same props as
// the hand-built version it replaced, so no call site changed.
//
// Radix provides what the old version did by hand: Escape and a click
// outside both close it, page scrolling is locked while it is open, and it
// renders in a portal that is safe to render on the server, so the old
// `mounted` guard is gone. It also traps keyboard focus inside the dialog,
// which the old one did not.

import {
  Dialog as DialogRoot,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string; // e.g. "560px"
}

export default function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = "480px",
}: DialogProps) {
  return (
    <DialogRoot open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        className="w-[calc(100%-2rem)] gap-0 overflow-hidden rounded-xl bg-card p-0 sm:rounded-xl"
        // maxWidth varies per call site, so it stays an inline style.
        style={{ maxWidth }}
        // Radix warns about a dialog with no description unless told
        // explicitly that there isn't one.
        {...(description ? {} : { "aria-describedby": undefined })}
      >
        <DialogHeader className="space-y-0.5 border-b px-5 py-4 pr-12 text-left">
          <DialogTitle className="text-sm font-medium leading-5">{title}</DialogTitle>
          {description && (
            <DialogDescription className="text-xs">{description}</DialogDescription>
          )}
        </DialogHeader>

        {children != null && children !== false && (
          <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        )}

        {footer && (
          <DialogFooter className="gap-2 border-t bg-muted/40 px-5 py-4 sm:space-x-0">
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </DialogRoot>
  );
}
