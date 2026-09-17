// src/components/common/statusColors.ts
// Dot colours for every status the app shows, in one place so a stage looks
// the same on the Dashboard, the kanban board and the tables.
//
// The blue ramp carries deal-stage progress. The other maps keep the colours
// the pages used before this refactor: green and red for good and bad, amber
// for "needs attention", grey for neutral. Values are CSS colours, applied as
// inline styles because they come from a lookup.

const RAMP = {
  light: "hsl(var(--chart-3))",
  mid: "hsl(var(--chart-2))",
  strong: "hsl(var(--chart-1))",
};
// FLAG: amber has no theme token yet; it is the same value the pages used.
const AMBER = "#d97706";
const GOOD = "var(--green)";
const BAD = "var(--red)";
const QUIET = "var(--text-faint)";
const MUTED = "hsl(var(--muted-foreground))";

/** Deal stages, by display label. */
export const DEAL_STAGE_COLOR: Record<string, string> = {
  Qualification: RAMP.light,
  Proposal: RAMP.mid,
  Negotiation: RAMP.strong,
  "Closed Won": GOOD,
};

/** Deal status as the board shows it (derived from the stage). */
export const DEAL_STATUS_COLOR: Record<string, string> = {
  Won: GOOD,
  Open: MUTED,
};

/** Lead statuses (the `leadStage` column; see docs/PROJECT_CONTEXT.md §7). */
export const LEAD_STATUS_COLOR: Record<string, string> = {
  Fresh: RAMP.strong,
  Interested: AMBER,
  Converted: GOOD,
  Closed: BAD,
  Irrelevant: QUIET,
};

/** Follow-up display statuses. */
export const FOLLOW_UP_STATUS_COLOR: Record<string, string> = {
  Planned: MUTED,
  Pending: AMBER,
  Done: GOOD,
  Missed: BAD,
  Cancelled: QUIET,
};

/** Contact temperature (the `leadStatus` column). */
export const TEMPERATURE_COLOR: Record<string, string> = {
  Hot: BAD,
  Warm: AMBER,
  Cold: MUTED,
};

/** Task priorities. */
export const PRIORITY_COLOR: Record<string, string> = {
  High: BAD,
  Medium: AMBER,
  Low: MUTED,
};

export const FALLBACK_STATUS_COLOR = MUTED;
