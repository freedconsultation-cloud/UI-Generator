// Dynamic project page — loads a specific saved project for authenticated users.
// Unauthenticated users are redirected to the home page.

import { getUser } from "@/actions";
import { getProject } from "@/actions/get-project";
import { MainContent } from "@/app/main-content";
import { redirect } from "next/navigation";

interface PageProps {
  // params is a Promise in Next.js 15 App Router — must be awaited before use
  params: Promise<{ projectId: string }>;
}

export default async function ProjectPage({ params }: PageProps) {
  // Unwrap the route params from the promise
  const { projectId } = await params;

  // Verify the user is signed in before attempting to load project data
  const user = await getUser();

  if (!user) {
    redirect("/");
  }

  // Load the project, enforcing ownership inside getProject
  let project;
  try {
    project = await getProject(projectId);
  } catch (error) {
    // If the project doesn't exist or belongs to a different user, fall back to home
    redirect("/");
  }

  // Render the full editor UI pre-populated with the project's messages and file data
  return <MainContent user={user} project={project} />;
}
