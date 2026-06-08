"use client";

// HeaderActions — renders the top-right controls of the app.
// Shows Sign In / Sign Up buttons for anonymous users.
// Shows a project switcher, "New Design" button, and sign-out icon for authenticated users.

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, LogOut, FolderOpen, ChevronDown } from "lucide-react";
import { AuthDialog } from "@/components/auth/AuthDialog";
import { signOut } from "@/actions";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface HeaderActionsProps {
  // Null when the user is anonymous
  user?: {
    id: string;
    email: string;
  } | null;
  // The currently open project, used to highlight the active entry in the switcher
  projectId?: string;
}

interface Project {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export function HeaderActions({ user, projectId }: HeaderActionsProps) {
  const router = useRouter();

  // Controls which auth form (sign-in vs sign-up) the dialog opens to
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");

  // Controls the project switcher popover visibility
  const [projectsOpen, setProjectsOpen] = useState(false);

  // Full list of the user's projects, loaded from the server
  const [projects, setProjects] = useState<Project[]>([]);

  // Prevents a flash of the project switcher before the initial data loads
  const [initialLoading, setInitialLoading] = useState(true);

  // Controls the search filter inside the project switcher
  const [searchQuery, setSearchQuery] = useState("");

  // Load the project list once on mount so the switcher is ready before the user opens it
  useEffect(() => {
    if (user && projectId) {
      getProjects()
        .then(setProjects)
        .catch(console.error)
        .finally(() => setInitialLoading(false));
    }
  }, [user, projectId]);

  // Refresh the project list whenever the popover opens to pick up newly created projects
  useEffect(() => {
    if (user && projectsOpen) {
      getProjects().then(setProjects).catch(console.error);
    }
  }, [projectsOpen, user]);

  // Filter the project list based on the search query typed in the command palette
  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Find the active project so its name can be shown on the trigger button
  const currentProject = projects.find((p) => p.id === projectId);

  // Open the dialog pre-set to sign-in mode
  const handleSignInClick = () => {
    setAuthMode("signin");
    setAuthDialogOpen(true);
  };

  // Open the dialog pre-set to sign-up mode
  const handleSignUpClick = () => {
    setAuthMode("signup");
    setAuthDialogOpen(true);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  // Create a blank project and navigate into it
  const handleNewDesign = async () => {
    const project = await createProject({
      name: `Design #${~~(Math.random() * 100000)}`,
      messages: [],
      data: {},
    });
    router.push(`/${project.id}`);
  };

  // Anonymous users only see auth buttons
  if (!user) {
    return (
      <>
        <div className="flex gap-2">
          <Button variant="outline" className="h-8" onClick={handleSignInClick}>
            Sign In
          </Button>
          <Button className="h-8" onClick={handleSignUpClick}>
            Sign Up
          </Button>
        </div>
        {/* AuthDialog handles both sign-in and sign-up forms in a single modal */}
        <AuthDialog
          open={authDialogOpen}
          onOpenChange={setAuthDialogOpen}
          defaultMode={authMode}
        />
      </>
    );
  }

  // Authenticated users see the project switcher, new design button, and sign-out
  return (
    <div className="flex items-center gap-2">
      {/* Only render the project switcher after the initial project list has loaded */}
      {!initialLoading && (
        <Popover open={projectsOpen} onOpenChange={setProjectsOpen}>
          {/* Trigger button shows the active project name */}
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-8 gap-2" role="combobox">
              <FolderOpen className="h-4 w-4" />
              {currentProject ? currentProject.name : "Select Project"}
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </PopoverTrigger>

          {/* Command palette with search + list of projects */}
          <PopoverContent className="w-[300px] p-0" align="end">
            <Command>
              <CommandInput
                placeholder="Search projects..."
                value={searchQuery}
                onValueChange={setSearchQuery}
              />
              <CommandList>
                <CommandEmpty>No projects found.</CommandEmpty>
                <CommandGroup>
                  {filteredProjects.map((project) => (
                    <CommandItem
                      key={project.id}
                      value={project.name}
                      onSelect={() => {
                        // Navigate to the selected project and close the popover
                        router.push(`/${project.id}`);
                        setProjectsOpen(false);
                        setSearchQuery("");
                      }}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{project.name}</span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}

      {/* Create a fresh blank project */}
      <Button className="flex items-center gap-2 h-8" onClick={handleNewDesign}>
        <Plus className="h-4 w-4" />
        New Design
      </Button>

      {/* Sign-out icon button — clears the session cookie and redirects to home */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={handleSignOut}
        title="Sign out"
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}
