// POST /api/chat — the core AI endpoint.
// Receives the chat message history and the current virtual file system state,
// streams back a response from Claude, and persists the result to the database
// for authenticated users.

import type { FileNode } from "@/lib/file-system";
import { VirtualFileSystem } from "@/lib/file-system";
import { streamText, appendResponseMessages, experimental_createMCPClient } from "ai";
import { buildStrReplaceTool } from "@/lib/tools/str-replace";
import { buildFileManagerTool } from "@/lib/tools/file-manager";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getLanguageModel } from "@/lib/provider";
import { generationPrompt } from "@/lib/prompts/generation";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";

// Compact timestamp prefix for log lines, e.g. "14:23:01.456"
function ts() {
  return new Date().toISOString().slice(11, 23);
}

export async function POST(req: Request) {
  const requestStart = Date.now();

  // Destructure the request body: message history, current VFS snapshot, and optional project ID
  const {
    messages,
    files,
    projectId,
  }: { messages: any[]; files: Record<string, FileNode>; projectId?: string } =
    await req.json();

  const userTurn = messages.filter((m: any) => m.role === "user").length;
  console.log(`[chat] ${ts()} ▶ request — ${userTurn} user turn(s)${projectId ? ` project=${projectId}` : " (anon)"}`);

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

  // Spin up the MCP server subprocess and collect its tools.
  // Falls back to an empty toolset if the server fails to start (e.g. in test environments).
  let mcpClient: Awaited<ReturnType<typeof experimental_createMCPClient>> | null = null;
  let mcpTools: Record<string, any> = {};
  if (!isMockProvider) {
    try {
      const transport = new StdioClientTransport({
        command: "node",
        args: [path.join(process.cwd(), "src", "mcp-server.mjs")],
        // In development, inherit stderr so MCP tool logs appear in the Next.js console
        stderr: process.env.NODE_ENV === "development" ? "inherit" : "pipe",
      });
      mcpClient = await experimental_createMCPClient({ transport: transport as any });
      mcpTools = await mcpClient.tools();
      console.log(`[chat] ${ts()} MCP tools ready: ${Object.keys(mcpTools).join(", ")}`);
    } catch (err) {
      console.error("MCP server failed to start, continuing without MCP tools:", err);
    }
  }

  const result = streamText({
    model,
    messages,
    maxTokens: 10_000,
    // Allow up to 40 tool-call/response cycles for real Claude; fewer for the mock
    maxSteps: isMockProvider ? 4 : 40,
    onError: (err: any) => {
      console.error(`[chat] ${ts()} ✖ error:`, err);
    },
    onStepFinish: ({ toolCalls }) => {
      // Log each tool call the model made during this step
      for (const call of toolCalls ?? []) {
        const preview = JSON.stringify(call.args ?? {});
        const trimmed = preview.length > 120 ? preview.slice(0, 120) + "…" : preview;
        console.log(`[chat] ${ts()} ⚙ tool: ${call.toolName} ${trimmed}`);
      }
    },
    // Expose tools to the model:
    // - str_replace_editor: create files and perform targeted string replacements
    // - file_manager: rename or delete files
    // - mcpTools: fetch_url and search_npm from the MCP subprocess
    tools: {
      ...mcpTools,
      str_replace_editor: buildStrReplaceTool(fileSystem),
      file_manager: buildFileManagerTool(fileSystem),
    },
    // After the model finishes its full response, save the updated project to the database
    onFinish: async ({ response, usage }) => {
      const elapsed = Date.now() - requestStart;
      console.log(
        `[chat] ${ts()} ✔ done — ${elapsed}ms | tokens in=${usage?.promptTokens ?? "?"} out=${usage?.completionTokens ?? "?"}`
      );

      // Shut down the MCP subprocess now that all tool calls are complete
      if (mcpClient) {
        await mcpClient.close().catch((err: Error) =>
          console.error("Failed to close MCP client:", err)
        );
      }
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
