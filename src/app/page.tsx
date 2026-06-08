// Home page — the entry point for the app.
// Authenticated users are redirected to their most recent project.
// Anonymous users see the main UI without a project context.

import { getUser } from "@/actions";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";
import { MainContent } from "./main-content";
import { redirect } from "next/navigation";

export default async function Home() {
  // Check if a valid session cookie exists and return the user object if so
  const user = await getUser();

  // Authenticated flow: send the user directly to their work
  if (user) {
    // Fetch the user's projects, sorted by most recently updated
    const projects = await getProjects();

    // If they already have projects, jump to the most recent one
    if (projects.length > 0) {
      redirect(`/${projects[0].id}`);
    }

    // First-time user with no projects — create a blank project and redirect into it
    const newProject = await createProject({
      name: `New Design #${~~(Math.random() * 100000)}`,
      messages: [],
      data: {},
    });

    redirect(`/${newProject.id}`);
  }

  // Anonymous flow: render the UI with no project attached.
  // Work done here is tracked in sessionStorage via anon-work-tracker.ts.
  return <MainContent user={user} />;
}
