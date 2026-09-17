"use client";

// A table cell that shows one line at rest and slides its details open when
// the ROW is hovered or keyboard-focused. Used by the Leads, Follow-up,
// Contacts and Tasks tables.
//
// FLAG: One component rather than the same markup pasted into four pages. The
// Leads table got this behaviour first and the other three were left with the
// old always-expanded layout — exactly the kind of drift this app has already
// paid for twice (four copies of formatCurrency, four copies of the owner-scope
// rule). Change the animation here and every table follows.
//
// ── Contract ─────────────────────────────────────────────────────────────────
// The ROW element must carry the class `group/row`. The reveal is driven by
// the row, not by this cell, so pointing anywhere along the row opens it.
// A NAMED group (`group/row`, not plain `group`) keeps that contract explicit
// and means a child element with its own `group` hover effect can never
// accidentally trigger — or swallow — the reveal.
//
// ── How it animates ─────────────────────────────────────────────────────────
// grid-template-rows 0fr → 1fr, NOT max-height. max-height needs a number
// larger than the content, so the cell reaches full height partway through
// the transition and then sits still for the remainder — that stall reads as
// jank. `1fr` resolves to exactly the content height, so the easing curve
// spans the whole movement and no magic number is needed.
//
// The inner `overflow-hidden` is load-bearing: it clips the content AND drops
// the grid item's automatic minimum size to zero. Without it the cell refuses
// to collapse to 0fr at rest.
//
// ── Accessibility ───────────────────────────────────────────────────────────
// `group-focus-within/row` opens it for keyboard users tabbing through the
// row's buttons, who would otherwise never see the details. The details stay
// in the DOM while collapsed — clipped, not removed — so screen readers still
// reach them.

import { cn } from "@/lib/utils";

interface RevealOnHoverProps {
  /** Always visible. Plain text on purpose — every table has its own column
   *  for opening a record, so this is not a second clickable way in. */
  primary: React.ReactNode;
  /** Revealed on hover/focus. Omit, or pass nothing, and the cell is just the
   *  primary line with no empty animated wrapper underneath it. */
  children?: React.ReactNode;
}

export default function RevealOnHover({ primary, children }: RevealOnHoverProps) {
  return (
    <div className="min-w-0">
      <div className="truncate text-foreground">
        {primary}
      </div>

      {children && (
        <div
          className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none
                     group-hover/row:grid-rows-[1fr] group-focus-within/row:grid-rows-[1fr]"
        >
          <div
            className="overflow-hidden opacity-0 transition-opacity duration-200 ease-out motion-reduce:transition-none
                       group-hover/row:opacity-100 group-focus-within/row:opacity-100"
          >
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * One detail line inside a RevealOnHover. `tone` picks between the two text
 * colours every table already uses for secondary information.
 */
export function RevealLine({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "faint";
}) {
  return (
    <div
      className={cn(
        "truncate pt-1 text-xs",
        tone === "muted" ? "text-muted-foreground" : "text-faint"
      )}
    >
      {children}
    </div>
  );
}
