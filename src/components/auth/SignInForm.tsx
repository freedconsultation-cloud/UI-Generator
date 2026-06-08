"use client";

// SignInForm — email + password form for existing users.
// Delegates auth logic to the useAuth hook, which calls the server action
// and handles post-login navigation (including migrating anonymous work).

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SignInFormProps {
  // Called after a successful sign-in so the parent (AuthDialog) can close itself
  onSuccess?: () => void;
}

export function SignInForm({ onSuccess }: SignInFormProps) {
  const { signIn, isLoading } = useAuth();

  // Controlled form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Holds a human-readable error message returned by the server action
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    // Prevent the browser from doing a full-page form submit
    e.preventDefault();

    // Clear any previous error before retrying
    setError("");

    const result = await signIn(email, password);

    if (result.success) {
      // Navigation is handled inside the useAuth hook (redirect to project)
      onSuccess?.();
    } else {
      // Show the server-returned error message below the form
      setError(result.error || "Failed to sign in");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Email field */}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isLoading}
        />
      </div>

      {/* Password field */}
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isLoading}
        />
      </div>

      {/* Inline error banner — only rendered when there is an error to show */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
          {error}
        </div>
      )}

      {/* Submit button — disabled while the request is in flight */}
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Signing in..." : "Sign In"}
      </Button>
    </form>
  );
}
