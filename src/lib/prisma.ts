// Prisma client singleton — prevents multiple PrismaClient instances from being
// created during Next.js hot reloads in development.
//
// In production, each serverless function invocation gets its own module scope,
// so the globalThis trick has no effect there and a fresh client is created normally.

import { PrismaClient } from "@/generated/prisma";

// Extend globalThis with a typed slot for the shared client instance
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Reuse the existing client if one is already attached to globalThis,
// otherwise create a new one
export const prisma = globalForPrisma.prisma ?? new PrismaClient();

// Stash the client on globalThis so the next hot-reload reuses it instead of
// opening a new database connection (development only)
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
