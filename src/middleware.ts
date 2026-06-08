// Next.js middleware — runs on every matched request before it reaches a route handler.
// Currently protects a small set of API routes that require authentication,
// rejecting unauthenticated requests with a 401 before they touch any database logic.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  // Verify the JWT cookie using the request object (cookies() helper is not available in middleware)
  const session = await verifySession(request);

  // List of route prefixes that require a valid session
  const protectedPaths = ["/api/projects", "/api/filesystem"];
  const isProtectedPath = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  // Reject unauthenticated requests to protected routes
  if (isProtectedPath && !session) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  // Allow all other requests to proceed normally
  return NextResponse.next();
}

export const config = {
  // Run middleware on all routes except static assets and Next.js internals
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
