// auth.ts — server-only JWT session utilities.
// Sessions are stored as signed JWTs in an httpOnly cookie.
// This file must never be imported by client components.

import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

// Encode the secret as a Uint8Array for use with the jose library.
// Falls back to a hardcoded dev string when JWT_SECRET is not set.
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "development-secret-key"
);

// Name of the cookie that stores the JWT token
const COOKIE_NAME = "auth-token";

// Shape of the data encoded inside the JWT payload
export interface SessionPayload {
  userId: string;
  email: string;
  expiresAt: Date;
}

// Signs a new JWT and writes it to an httpOnly cookie.
// Called after a successful sign-in or sign-up.
export async function createSession(userId: string, email: string) {
  // Sessions expire after 7 days
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const session: SessionPayload = { userId, email, expiresAt };

  // Sign the payload with HS256 and embed an expiration claim
  const token = await new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(JWT_SECRET);

  // Write the token as an httpOnly cookie so JavaScript cannot read it
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    // Only send the cookie over HTTPS in production
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

// Reads and verifies the auth cookie from the current request.
// Returns the decoded payload, or null if the token is missing or invalid.
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  // No cookie present — user is not signed in
  if (!token) {
    return null;
  }

  try {
    // jwtVerify checks the signature and expiration claim
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionPayload;
  } catch (error) {
    // Token is expired or tampered — treat as unauthenticated
    return null;
  }
}

// Deletes the auth cookie, effectively signing the user out
export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// Variant of getSession that reads from a NextRequest object (for use in middleware).
// Middleware runs before the cookies() helper is available, so we read directly from the request.
export async function verifySession(
  request: NextRequest
): Promise<SessionPayload | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionPayload;
  } catch (error) {
    return null;
  }
}
