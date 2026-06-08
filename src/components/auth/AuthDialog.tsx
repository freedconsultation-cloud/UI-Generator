"use client";

// AuthDialog — a modal that hosts either the sign-in or sign-up form.
// The caller controls which form is shown via the `defaultMode` prop,
// and the user can switch between forms using the link at the bottom.

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SignInForm } from "./SignInForm";
import { SignUpForm } from "./SignUpForm";

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Which form to show when the dialog first opens; defaults to "signin"
  defaultMode?: "signin" | "signup";
}

export function AuthDialog({
  open,
  onOpenChange,
  defaultMode = "signin",
}: AuthDialogProps) {
  // Track which form is currently active inside the dialog
  const [mode, setMode] = useState<"signin" | "signup">(defaultMode);

  // Sync the internal mode whenever the parent changes defaultMode
  // (e.g. when the user clicks "Sign In" vs "Sign Up" in the header)
  useEffect(() => {
    setMode(defaultMode);
  }, [defaultMode]);

  // Close the dialog after a successful auth action
  const handleSuccess = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        {/* Header text changes depending on which form is active */}
        <DialogHeader>
          <DialogTitle>
            {mode === "signin" ? "Welcome back" : "Create an account"}
          </DialogTitle>
          <DialogDescription>
            {mode === "signin"
              ? "Sign in to your account to continue"
              : "Sign up to start creating AI-powered React components"}
          </DialogDescription>
        </DialogHeader>

        {/* Swap the form component based on the current mode */}
        <div className="mt-4">
          {mode === "signin" ? (
            <SignInForm onSuccess={handleSuccess} />
          ) : (
            <SignUpForm onSuccess={handleSuccess} />
          )}
        </div>

        {/* Toggle link at the bottom lets the user switch between sign-in and sign-up */}
        <div className="mt-4 text-center text-sm">
          {mode === "signin" ? (
            <>
              Don&apos;t have an account?{" "}
              <Button
                variant="link"
                className="p-0 h-auto font-normal"
                onClick={() => setMode("signup")}
              >
                Sign up
              </Button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Button
                variant="link"
                className="p-0 h-auto font-normal"
                onClick={() => setMode("signin")}
              >
                Sign in
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
