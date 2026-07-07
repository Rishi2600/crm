// src/app/api/auth/login/route.ts

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";
import { LoginRequest, LoginResponse, ApiError } from "@/types/dashboard";

export async function POST(request: NextRequest) {
  try {
    const body: LoginRequest = await request.json();
    const { email, password } = body;

    // ── Validate input ─────────────────────────────────────────────────────
    if (!email || !password) {
      return NextResponse.json<ApiError>(
        { error: "Bad Request", message: "Email and password are required" },
        { status: 400 }
      );
    }

    // ── Find user ──────────────────────────────────────────────────────────
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json<ApiError>(
        { error: "Unauthorized", message: "Invalid credentials" },
        { status: 401 }
      );
    }

    // ── Verify password ────────────────────────────────────────────────────
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return NextResponse.json<ApiError>(
        { error: "Unauthorized", message: "Invalid credentials" },
        { status: 401 }
      );
    }

    // ── Generate JWT ───────────────────────────────────────────────────────
    const token = await signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // ── Build response ─────────────────────────────────────────────────────
    const responseData: LoginResponse = {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };

    const response = NextResponse.json(responseData, { status: 200 });

    // Set HTTP-only cookie for browser navigation
    response.cookies.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[POST /api/auth/login]", error);
    return NextResponse.json<ApiError>(
      { error: "Internal Server Error", message: "Something went wrong" },
      { status: 500 }
    );
  }
}
