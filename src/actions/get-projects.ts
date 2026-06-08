"use server";

// Server action to list all projects belonging to the current user.
// Returns a lightweight summary (no messages or file data) for use in navigation.

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getProjects() {
  // Reject unauthenticated requests before touching the database
  const session = await getSession();

  if (!session) {
    throw new Error("Unauthorized");
  }

  // Fetch only the current user's projects, sorted newest-first so the most
  // recently edited project appears at the top of the list
  const projects = await prisma.project.findMany({
    where: {
      userId: session.userId,
    },
    orderBy: {
      updatedAt: "desc",
    },
    // Omit the heavy messages and data blobs — callers only need metadata here
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return projects;
}
