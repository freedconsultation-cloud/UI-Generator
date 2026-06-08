"use client";

// useAuth — client-side hook that wraps the sign-in and sign-up server actions.
// After a successful auth, it migrates any anonymous work from sessionStorage
// into a new project and redirects the user into it.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

export function useAuth() {
  const router = useRouter();

  // Shared loading state used by both signIn and signUp to disable form buttons
  const [isLoading, setIsLoading] = useState(false);

  // Runs after every successful authentication (sign-in or sign-up).
  // Decides where to send the user based on whether they have prior anonymous work.
  const handlePostSignIn = async () => {
    // Check if the user created any components while anonymous
    const anonWork = getAnonWorkData();

    if (anonWork && anonWork.messages.length > 0) {
      // Persist the anonymous session's work as a named project so it isn't lost
      const project = await createProject({
        name: `Design from ${new Date().toLocaleTimeString()}`,
        messages: anonWork.messages,
        data: anonWork.fileSystemData,
      });

      // Clear the sessionStorage snapshot now that it has been saved to the database
      clearAnonWork();

      // Navigate directly into the newly created project
      router.push(`/${project.id}`);
      return;
    }

    // No anonymous work — find the user's most recently updated project
    const projects = await getProjects();

    if (projects.length > 0) {
      // Send the user to their most recent project
      router.push(`/${projects[0].id}`);
      return;
    }

    // Brand-new user with no existing projects — create a blank one and open it
    const newProject = await createProject({
      name: `New Design #${~~(Math.random() * 100000)}`,
      messages: [],
      data: {},
    });

    router.push(`/${newProject.id}`);
  };

  // Calls the signIn server action and handles post-login navigation
  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const result = await signInAction(email, password);

      if (result.success) {
        // Navigate to the appropriate project after a successful sign-in
        await handlePostSignIn();
      }

      return result;
    } finally {
      // Always clear the loading flag, even if an error is thrown
      setIsLoading(false);
    }
  };

  // Calls the signUp server action and handles post-registration navigation
  const signUp = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const result = await signUpAction(email, password);

      if (result.success) {
        // Navigate to the appropriate project after a successful sign-up
        await handlePostSignIn();
      }

      return result;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    signIn,
    signUp,
    isLoading,
  };
}
