"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? "Login failed"); return; }
      localStorage.setItem("crm-token", data.token);
      localStorage.setItem("crm-user", JSON.stringify(data.user));
      router.push("/dashboard");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-xs">

        {/* Brand */}
        <div className="mb-8">
          <div className="text-xl font-semibold mb-1" style={{ color: "var(--text)", letterSpacing: "-0.02em" }}>
            CRM
          </div>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Sign in to continue</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 px-3 py-2.5 rounded-lg text-xs" style={{
            background: "var(--bg-subtle)",
            border: "1px solid var(--border)",
            color: "var(--red)",
          }}>
            {error}
          </div>
        )}

        {/* Form */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="you@company.com"
              className="w-full px-3 py-2.5 rounded-lg text-sm transition-colors"
              style={{
                background: "var(--bg-subtle)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                outline: "none",
              }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="••••••••"
              className="w-full px-3 py-2.5 rounded-lg text-sm"
              style={{
                background: "var(--bg-subtle)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                outline: "none",
              }}
            />
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-medium transition-opacity mt-1"
            style={{ background: "var(--text)", color: "var(--bg)", opacity: loading ? 0.5 : 1 }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </div>

        {/* Demo hint */}
        <p className="text-xs mt-6" style={{ color: "var(--text-faint)" }}>
          admin@crm.com · password123
        </p>
      </div>
    </div>
  );
}
