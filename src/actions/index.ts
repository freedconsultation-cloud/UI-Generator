"use server";

// Server actions for authentication. All functions run server-side only.
// They read/write the database directly and manage JWT sessions via cookies.

import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { createSession, deleteSession, getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// Shared return type for sign-in and sign-up actions
export interface AuthResult {
  success: boolean;
  error?: string;
}

// Creates a new user account, hashes the password, and starts a session
export async function signUp(
  email: string,
  password: string
): Promise<AuthResult> {
  try {
    // Reject empty fields before hitting the database
    if (!email || !password) {
      return { success: false, error: "Email and password are required" };
    }

    // Enforce minimum password length before hashing
    if (password.length < 8) {
      return {
        success: false,
        error: "Password must be at least 8 characters",
      };
    }

    // Check for duplicate email before attempting to create the user
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return { success: false, error: "Email already registered" };
    }

    // bcrypt with 10 rounds — strong enough for web use without being too slow
    const hashedPassword = await bcrypt.hash(password, 10);

    // Persist the new user to the database
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
      },
    });

    // Write the auth cookie so the user is immediately logged in
    await createSession(user.id, user.email);

    // Invalidate any cached data on the home route so the UI reflects the new session
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Sign up error:", error);
    return { success: false, error: "An error occurred during sign up" };
  }
}

// Validates credentials against the stored bcrypt hash and creates a session
export async function signIn(
  email: string,
  password: string
): Promise<AuthResult> {
  try {
    // Reject empty fields before hitting the database
    if (!email || !password) {
      return { success: false, error: "Email and password are required" };
    }

    // Look up the user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Return a generic error so we don't reveal whether the email exists
    if (!user) {
      return { success: false, error: "Invalid credentials" };
    }

    // Compare the plaintext password against the stored bcrypt hash
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return { success: false, error: "Invalid credentials" };
    }

    // Write the auth cookie to start the session
    await createSession(user.id, user.email);

    // Bust the Next.js cache for the root path so the page re-renders with session state
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Sign in error:", error);
    return { success: false, error: "An error occurred during sign in" };
  }
}

// Clears the auth cookie and redirects to the home page
export async function signOut() {
  await deleteSession();
  revalidatePath("/");
  redirect("/");
}

// Returns the currently authenticated user's public fields, or null if not signed in
export async function getUser() {
  // Read the JWT from the cookie and verify it
  const session = await getSession();

  if (!session) {
    return null;
  }

  try {
    // Fetch fresh user data from the database using the userId embedded in the session
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      // Only return public fields — never expose the hashed password
      select: {
        id: true,
        email: true,
        createdAt: true,
      },
    });

    return user;
  } catch (error) {
    console.error("Get user error:", error);
    return null;
  }
}
