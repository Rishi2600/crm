"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, Check, ArrowRight } from "lucide-react";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      {/* ── Left — branded panel, colors deliberately INVERTED relative to
          the page so it reads as a strong brand block in both light and
          dark mode without needing separate hardcoded colors. ──────────── */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-foreground p-12 text-background lg:flex">
        {/* Decorative dot grid */}
        <div
          className="absolute inset-0 bg-[radial-gradient(currentColor_1px,transparent_1px)] opacity-[0.08] [background-size:24px_24px]"
          aria-hidden
        />
        {/* Soft glow blob */}
        <div
          className="absolute -right-[150px] -top-[150px] size-[500px] rounded-full bg-[radial-gradient(circle,hsl(var(--background))_0%,transparent_70%)] opacity-[0.12]"
          aria-hidden
        />

        <div className="relative z-10">
          <Link href="/" className="text-xl font-semibold tracking-tight">CRM</Link>
        </div>

        <div className="relative z-10 max-w-md">
          <h1 className="mb-4 text-4xl font-semibold leading-tight tracking-tighter">
            Run your entire sales pipeline in one place.
          </h1>
          <p className="mb-8 text-sm opacity-70">
            Contacts, deals, tasks, and reporting — one clean workspace for the whole team.
          </p>

          <ul className="space-y-3">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-background text-foreground">
                  <Check className="size-3" strokeWidth={3} aria-hidden />
                </span>
                <span className="text-sm opacity-90">{f}</span>
              </li>
            ))}
          </ul>
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

        <div className="flex flex-1 items-center justify-center px-4 pb-16 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="w-full max-w-sm"
          >
            {/* Mobile-only brand mark */}
            <Link href="/" className="mb-8 block text-xl font-semibold tracking-tight text-foreground lg:hidden">
              CRM
            </Link>

            <Card>
              <CardHeader className="space-y-1 p-6">
                <CardTitle className="text-2xl font-semibold tracking-tight">Welcome back</CardTitle>
                <CardDescription>Sign in to your workspace to continue</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 p-6 pt-0">
                {error && (
                  <motion.div
                    role="alert"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="overflow-hidden rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs text-danger"
                  >
                    {error}
                  </motion.div>
                )}

                <div className="grid gap-1.5">
                  <Label htmlFor="login-email" className="text-xs text-muted-foreground">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <Input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                      placeholder="you@company.com"
                      className="h-10 pl-9"
                    />
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="login-password" className="text-xs text-muted-foreground">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <Input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                      placeholder="••••••••"
                      className="h-10 px-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                    </button>
                  </div>
                </div>

                <Button onClick={handleLogin} disabled={loading} className="group mt-1 h-10 w-full">
                  {loading ? "Signing in..." : (
                    <>
                      Sign in
                      <ArrowRight className="transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </>
                  )}
                </Button>

                <div className="rounded-lg border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
                  Demo — <span className="text-foreground">admin@crm.com</span> · password123
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
