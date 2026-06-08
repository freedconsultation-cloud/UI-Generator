// POST /api/chat — the core AI endpoint.
// Receives the chat message history and the current virtual file system state,
// streams back a response from Claude, and persists the result to the database
// for authenticated users.

import type { FileNode } from "@/lib/file-system";
import { VirtualFileSystem } from "@/lib/file-system";
import { streamText, appendResponseMessages } from "ai";
import { buildStrReplaceTool } from "@/lib/tools/str-replace";
import { buildFileManagerTool } from "@/lib/tools/file-manager";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getLanguageModel } from "@/lib/provider";
import { generationPrompt } from "@/lib/prompts/generation";

export async function POST(req: Request) {
  // Destructure the request body: message history, current VFS snapshot, and optional project ID
  const {
    messages,
    files,
    projectId,
  }: { messages: any[]; files: Record<string, FileNode>; projectId?: string } =
    await req.json();

  // Prepend the system prompt as the very first message so Claude knows its role.
  // The cacheControl hint tells Anthropic to cache this prompt across turns,
  // which reduces cost and latency for multi-turn conversations.
  messages.unshift({
    role: "system",
    content: generationPrompt,
    providerOptions: {
      anthropic: { cacheControl: { type: "ephemeral" } },
    },
  });

  // Reconstruct the in-memory VirtualFileSystem from the serialized nodes sent by the client
  const fileSystem = new VirtualFileSystem();
  fileSystem.deserializeFromNodes(files);

  // Resolve the language model — real Claude if ANTHROPIC_API_KEY is set, mock otherwise
  const model = getLanguageModel();

  // The mock provider generates canned multi-step responses; cap its steps to avoid infinite loops
  const isMockProvider = !process.env.ANTHROPIC_API_KEY;

  const result = streamText({
    model,
    messages,
    maxTokens: 10_000,
    // Allow up to 40 tool-call/response cycles for real Claude; fewer for the mock
    maxSteps: isMockProvider ? 4 : 40,
    onError: (err: any) => {
      console.error(err);
    },
    // Expose two tools to the model:
    // - str_replace_editor: create files and perform targeted string replacements
    // - file_manager: rename or delete files
    tools: {
      str_replace_editor: buildStrReplaceTool(fileSystem),
      file_manager: buildFileManagerTool(fileSystem),
    },
    // After the model finishes its full response, save the updated project to the database
    onFinish: async ({ response }) => {
      // Only persist if a projectId was provided by the client
      if (projectId) {
        try {
          // Require an authenticated session before writing to the database
          const session = await getSession();
          if (!session) {
            console.error("User not authenticated, cannot save project");
            return;
          }

          // Merge the original user messages with the model's response messages
          // into a single flat array that can be replayed on the next page load
          const responseMessages = response.messages || [];
          const allMessages = appendResponseMessages({
            messages: [...messages.filter((m) => m.role !== "system")],
            responseMessages,
          });

          // Write the full message history and the updated file system state back to the database.
          // The userId check prevents one user from overwriting another user's project.
          await prisma.project.update({
            where: {
              id: projectId,
              userId: session.userId,
            },
            data: {
              messages: JSON.stringify(allMessages),
              data: JSON.stringify(fileSystem.serialize()),
            },
          });
        } catch (error) {
          console.error("Failed to save project data:", error);
        }
      }
    },
  });

  // Stream the response back to the client using the Vercel AI SDK data stream format
  return result.toDataStreamResponse();
}

// Increase the serverless function timeout to 2 minutes to accommodate long AI responses
export const maxDuration = 120;
