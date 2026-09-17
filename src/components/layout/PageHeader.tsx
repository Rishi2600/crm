"use client";

// Lets a page put its own title and controls into the shared top bar.
//
// The top bar lives in the (app) layout, but its contents are page-specific
// and often live: "Leads · 30" changes as filters change, the Dashboard
// greets the user by name, the lead detail page shows a back button. So the
// layout renders two empty slot elements, and <PageHeader> portals the
// page's own JSX into them. That JSX stays part of the page's React tree, so
// it always reflects the page's current state; nothing is copied into
// context and nothing looks nodes up by id.

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface SlotContextValue {
  titleEl: HTMLElement | null;
  actionsEl: HTMLElement | null;
  setTitleEl: (el: HTMLElement | null) => void;
  setActionsEl: (el: HTMLElement | null) => void;
}

const SlotContext = createContext<SlotContextValue | null>(null);

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  // Elements arrive through callback refs once the top bar mounts. On the
  // server and the first client render they are null, so both render the
  // same (empty) markup and hydration matches; the page's header content
  // appears on the next render.
  const [titleEl, setTitleEl] = useState<HTMLElement | null>(null);
  const [actionsEl, setActionsEl] = useState<HTMLElement | null>(null);
  const value = useMemo(
    () => ({ titleEl, actionsEl, setTitleEl, setActionsEl }),
    [titleEl, actionsEl]
  );
  return <SlotContext.Provider value={value}>{children}</SlotContext.Provider>;
}

/** The two slot elements. Rendered once, inside the top bar. */
export function PageHeaderSlots() {
  const ctx = useContext(SlotContext);
  if (!ctx) return null;
  return (
    <>
      <div ref={ctx.setTitleEl} className="flex min-w-0 flex-1 items-center gap-2 text-sm" />
      <div ref={ctx.setActionsEl} className="flex shrink-0 items-center gap-3" />
    </>
  );
}

/** Rendered by a page: its title, plus optional controls for the right side. */
export function PageHeader({ title, children }: { title: ReactNode; children?: ReactNode }) {
  const ctx = useContext(SlotContext);
  if (!ctx) return null;
  return (
    <>
      {ctx.titleEl && createPortal(title, ctx.titleEl)}
      {ctx.actionsEl && children ? createPortal(children, ctx.actionsEl) : null}
    </>
  );
}
