"use server";

// Server action for creating a new project.
// Only authenticated users may create projects — anonymous sessions cannot persist work here.

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface CreateProjectInput {
  name: string;
  messages: any[]; // AI chat message history to pre-populate the project
  data: Record<string, any>; // Serialized VirtualFileSystem state for the project
}

export async function createProject(input: CreateProjectInput) {
  // Verify the request comes from a signed-in user
  const session = await getSession();

  if (!session) {
    throw new Error("Unauthorized");
  }

  // Persist the project, serializing messages and file system data as JSON strings
  // because SQLite (used here) doesn't have a native JSON column type
  const project = await prisma.project.create({
    data: {
      name: input.name,
      userId: session.userId,
      messages: JSON.stringify(input.messages),
      data: JSON.stringify(input.data),
    },
  });

  return project;
}
