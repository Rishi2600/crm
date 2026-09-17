"use client";

interface SpinnerProps {
  size?: number;
  className?: string;
}

// A single rotating ring — monochrome, matches --text/--border tokens so it
// looks correct in both themes with zero extra props needed.
export function Spinner({ size = 18, className = "" }: SpinnerProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={{ animation: "crm-spin 0.7s linear infinite" }}
    >
      <circle cx="12" cy="12" r="10" stroke="var(--border)" strokeWidth="2.5" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="var(--text)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface LoadingStateProps {
  label?: string;
  size?: number;
  /** "block" for a full-section centered state, "inline" for a compact
   *  row (e.g. inside a table body or a small card). */
  variant?: "block" | "inline";
}

// The thing actually used across pages — a centered spinner with an
// optional label underneath. Using ONE component everywhere means every
// loading state in the app looks and feels identical, regardless of
// whether that particular fetch resolves in 50ms or 2s — no more pages
// where a plain "Loading..." string abruptly swaps to "No data found",
// which is what made moderate-latency loads feel broken rather than slow.
export default function LoadingState({ label, size = 22, variant = "block" }: LoadingStateProps) {
  if (variant === "inline") {
    return (
      <div className="flex items-center justify-center gap-2 py-6">
        <Spinner size={14} />
        {label && <span className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <Spinner size={size} />
      {label && <span className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</span>}
    </div>
  );
}