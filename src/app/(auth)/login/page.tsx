"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, Check, ArrowRight } from "lucide-react";
import ThemeToggle from "@/components/layout/ThemeToggle";

const FEATURES = [
  "Track every deal from lead to close",
  "Assign tasks across your whole team",
  "See revenue trends the moment they happen",
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="min-h-screen grid lg:grid-cols-2" style={{ background: "var(--bg)" }}>
      {/* ── Left — branded panel, colors deliberately INVERTED relative to
          the page so it reads as a strong brand block in both light and
          dark mode without needing separate hardcoded colors. ──────────── */}
      <div
        className="hidden lg:flex relative flex-col justify-between p-12 overflow-hidden"
        style={{ background: "var(--text)", color: "var(--bg)" }}
      >
        {/* Decorative dot grid */}
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        {/* Soft glow blob */}
        <div
          className="absolute rounded-full opacity-[0.12]"
          style={{
            width: 500, height: 500, top: -150, right: -150,
            background: "radial-gradient(circle, var(--bg) 0%, transparent 70%)",
          }}
        />

        <div className="relative z-10">
          <Link href="/" className="text-xl font-semibold" style={{ letterSpacing: "-0.02em" }}>CRM</Link>
        </div>

        <div className="relative z-10 max-w-md">
          <h1 className="text-4xl font-semibold leading-tight mb-4" style={{ letterSpacing: "-0.03em" }}>
            Run your entire sales pipeline in one place.
          </h1>
          <p className="text-sm mb-8 opacity-70">
            Contacts, deals, tasks, and reporting — one clean workspace for the whole team.
          </p>

          <div className="space-y-3">
            {FEATURES.map((f) => (
              <div key={f} className="flex items-center gap-3">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "var(--bg)", color: "var(--text)" }}
                >
                  <Check size={12} strokeWidth={3} />
                </div>
                <span className="text-sm opacity-90">{f}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-xs opacity-50">
          © {new Date().getFullYear()} CRM. Built for sales teams that move fast.
        </div>
      </div>

      {/* ── Right — the form ─────────────────────────────────────────────── */}
      <div className="flex flex-col">
        <div className="flex justify-end p-6">
          <ThemeToggle />
        </div>

        <div className="flex-1 flex items-center justify-center px-6 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="w-full max-w-sm"
          >
            {/* Mobile-only brand mark */}
            <Link href="/" className="lg:hidden block text-xl font-semibold mb-8" style={{ color: "var(--text)", letterSpacing: "-0.02em" }}>
              CRM
            </Link>

            <h2 className="text-2xl font-semibold mb-1" style={{ color: "var(--text)", letterSpacing: "-0.02em" }}>
              Welcome back
            </h2>
            <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>
              Sign in to your workspace to continue
            </p>

            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mb-4 px-3 py-2.5 rounded-lg text-xs overflow-hidden"
                style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--red)" }}
              >
                {error}
              </motion.div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>
                  Email
                </label>
                <div className="relative">
                  <Mail size={15} strokeWidth={1.8}
                    className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--text-muted)" }} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                    placeholder="you@company.com"
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm transition-colors"
                    style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text)", outline: "none" }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>
                  Password
                </label>
                <div className="relative">
                  <Lock size={15} strokeWidth={1.8}
                    className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--text-muted)" }} />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-9 py-2.5 rounded-lg text-sm"
                    style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text)", outline: "none" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--text-muted)" }}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={15} strokeWidth={1.8} /> : <Eye size={15} strokeWidth={1.8} />}
                  </button>
                </div>
              </div>

              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-opacity mt-1 group"
                style={{ background: "var(--text)", color: "var(--bg)", opacity: loading ? 0.5 : 1 }}
              >
                {loading ? "Signing in..." : (
                  <>
                    Sign in
                    <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </div>

            <div
              className="mt-6 px-3 py-2.5 rounded-lg text-xs"
              style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
            >
              Demo — <span style={{ color: "var(--text)" }}>admin@crm.com</span> · password123
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}