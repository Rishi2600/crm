// src/lib/auth.ts

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { JWTPayload } from "@/types/dashboard";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "fallback-secret-change-in-production"
);

// ─── Sign Token ───────────────────────────────────────────────────────────────

export async function signToken(payload: Omit<JWTPayload, "iat" | "exp">): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_EXPIRES_IN ?? "7d")
    .sign(JWT_SECRET);
}

// ─── Verify Token ─────────────────────────────────────────────────────────────

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

// ─── Extract Token from Request ───────────────────────────────────────────────

export function extractToken(request: NextRequest): string | null {
  // 1. Check Authorization header: "Bearer <token>"
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  // 2. Check cookie (for browser navigation)
  const cookieToken = request.cookies.get("auth-token")?.value;
  if (cookieToken) return cookieToken;

  return null;
}

// ─── Get Current User from Cookie (Server Components) ────────────────────────

export async function getCurrentUser(): Promise<JWTPayload | null> {
  const cookieStore = cookies();
  const token = cookieStore.get("auth-token")?.value;
  if (!token) return null;
  return await verifyToken(token);
}
