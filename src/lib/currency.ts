// src/lib/currency.ts
// Money formatting for the whole app. Amounts are Indian Rupees.
//
// 🚩 This replaced FOUR copy-pasted `formatCurrency` helpers (Dashboard,
// Deals, Contacts, Analytics) plus two more inside the chart components. They
// had already drifted — one rendered "₹45k" where the others rendered "₹45K" —
// which is exactly the kind of thing that makes a product feel unfinished. One
// definition now, imported everywhere.
//
// Indian numbering, not Western: money is grouped and abbreviated in lakh
// (1,00,000) and crore (1,00,00,000), not thousand/million. A deal worth
// 4500000 reads as ₹45L to an Indian sales team and as a meaningless "₹4.5M"
// to nobody. `Intl` with the "en-IN" locale does the digit grouping for us —
// 1234567 becomes 12,34,567 rather than 1,234,567.
//
// Deal amounts are stored as Decimal(12,2) with NO currency column, so "INR"
// is an app-wide assumption rather than a property of each row. That's fine
// for a single-market product and is called out in docs/MODULES.md as the
// thing to revisit before selling into a second currency.

const CRORE = 10_000_000;
const LAKH = 100_000;
const THOUSAND = 1_000;

/** Trims a pointless ".0" so 45.0L reads as 45L. */
function trim(n: number): string {
  return n.toFixed(1).replace(/\.0$/, "");
}

/**
 * Compact money, for KPI tiles, chart axes and table cells where space is
 * tight: ₹2.4Cr · ₹45L · ₹12K · ₹850.
 */
export function formatINR(value: number): string {
  const n = Number(value) || 0;
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);

  if (abs >= CRORE) return `${sign}₹${trim(abs / CRORE)}Cr`;
  if (abs >= LAKH) return `${sign}₹${trim(abs / LAKH)}L`;
  if (abs >= THOUSAND) return `${sign}₹${trim(abs / THOUSAND)}K`;
  return `${sign}₹${Math.round(abs)}`;
}

/**
 * The exact amount with Indian digit grouping — ₹12,34,567 — for tooltips and
 * detail rows, where rounding a real figure to "₹12L" hides what someone
 * opened the tooltip to find out.
 */
export function formatINRExact(value: number): string {
  const n = Number(value) || 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}
