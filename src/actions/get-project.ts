"use server";

// Server action to fetch a single project by ID.
// Enforces ownership: a user can only load their own projects.

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getProject(projectId: string) {
  // Ensure the caller is authenticated before touching the database
  const session = await getSession();

  if (!session) {
    throw new Error("Unauthorized");
  }

  // Scope the lookup by both projectId AND userId to prevent horizontal privilege escalation
  const project = await prisma.project.findUnique({
    where: {
      id: projectId,
      userId: session.userId,
    },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  // Parse the JSON blobs back into their native types before returning to the caller
  return {
    id: project.id,
    name: project.name,
    messages: JSON.parse(project.messages), // Array of AI chat messages
    data: JSON.parse(project.data),         // Serialized VirtualFileSystem nodes
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}
