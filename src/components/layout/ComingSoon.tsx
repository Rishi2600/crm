"use client";

import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";

interface ComingSoonProps {
  module: string;
  description: string;
}

export default function ComingSoon({ module, description }: ComingSoonProps) {
  const router = useRouter();

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg)" }}>
      <Sidebar />
      <main className="flex-1 ml-52 min-h-screen">
        {/* Top bar */}
        <div className="h-14 flex items-center px-8" style={{ borderBottom: "1px solid var(--border)" }}>
          <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{module}</span>
        </div>

        {/* Content */}
        <div className="flex flex-col items-center justify-center h-[calc(100vh-56px)]">
          <div className="text-center max-w-sm">
            <div
              className="inline-flex items-center justify-center w-10 h-10 rounded-xl mb-6"
              style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"
                style={{ color: "var(--text-muted)" }}>
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>

            <h2 className="text-sm font-medium mb-2" style={{ color: "var(--text)" }}>
              {module} coming soon
            </h2>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {description}
            </p>

            <div className="flex items-center justify-center gap-3 mt-6">
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs"
                style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
              >
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--text-muted)" }} />
                In development
              </div>

              <button
                onClick={() => router.push("/dashboard")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-opacity hover:opacity-70"
                style={{ background: "var(--text)", color: "var(--bg)" }}
              >
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}