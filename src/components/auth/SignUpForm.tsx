"use client";

// SignUpForm — registration form with email, password, and confirm-password fields.
// Client-side password-match validation runs before the server action is called.
// Delegates auth logic to the useAuth hook.

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SignUpFormProps {
  // Called after a successful sign-up so the parent (AuthDialog) can close itself
  onSuccess?: () => void;
}

export function SignUpForm({ onSuccess }: SignUpFormProps) {
  const { signUp, isLoading } = useAuth();

  // Controlled form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Holds either a client-side validation error or a server-returned error
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    // Prevent the browser from doing a full-page form submit
    e.preventDefault();

    // Clear any previous error before retrying
    setError("");

    // Client-side check before making a round-trip to the server
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    const result = await signUp(email, password);

    if (result.success) {
      // Navigation is handled inside the useAuth hook (redirect to project)
      onSuccess?.();
    } else {
      // Show the server-returned error (e.g. "Email already registered")
      setError(result.error || "Failed to sign up");
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

      {/* Password field — minLength enforced by the server action too, but
          the HTML attribute gives immediate browser-level feedback */}
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isLoading}
          minLength={8}
        />
        <p className="text-xs text-gray-500">
          Must be at least 8 characters long
        </p>
      </div>

      {/* Confirm password field — matched against the password field client-side */}
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm Password</Label>
        <Input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
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
        {isLoading ? "Creating account..." : "Sign Up"}
      </Button>
    </form>
  );
}
