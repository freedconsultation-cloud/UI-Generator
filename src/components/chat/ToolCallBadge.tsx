"use client";

// ToolCallBadge — renders a single AI tool invocation as a human-readable badge.
// Shows a spinner while the tool is in flight and a green dot when it has finished.
// Translates raw tool names and arguments into plain-English labels so users
// can follow what the AI is doing without seeing internal API names.

import { Loader2 } from "lucide-react";

// Minimal shape of a tool invocation from the Vercel AI SDK
export interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  args: Record<string, any>;
  state: "call" | "partial-call" | "result";
  result?: any;
}

interface ToolCallBadgeProps {
  toolInvocation: ToolInvocation;
}

// Convert a tool name + args into a short, human-readable action label.
// Falls back to the raw tool name if the combination isn't recognised.
export function getToolLabel(toolName: string, args: Record<string, any>): string {
  // str_replace_editor: file creation and editing operations
  if (toolName === "str_replace_editor") {
    const { command, path } = args || {};
    const filename = path || "file";

    switch (command) {
      case "create":
        return `Creating ${filename}`;
      case "str_replace":
        return `Editing ${filename}`;
      case "insert":
        return `Editing ${filename}`;
      case "view":
        return `Reading ${filename}`;
      case "undo_edit":
        return `Reverting ${filename}`;
      default:
        // Unknown command — at least show the path if we have it
        return path ? `Editing ${filename}` : "Editing file";
    }
  }

  // file_manager: rename and delete operations
  if (toolName === "file_manager") {
    const { command, path, new_path } = args || {};

    switch (command) {
      case "rename":
        // Show both old and new path when available
        return new_path ? `Renaming ${path} → ${new_path}` : `Renaming ${path}`;
      case "delete":
        return `Deleting ${path}`;
      default:
        return path ? `Managing ${path}` : "Managing file";
    }
  }

  // Unknown tool — display the raw name rather than nothing
  return toolName;
}

export function ToolCallBadge({ toolInvocation }: ToolCallBadgeProps) {
  const { toolName, args, state, result } = toolInvocation;

  // Build the label once so it is consistent between the pending and done states
  const label = getToolLabel(toolName, args);

  // A tool is considered done when it has reached the "result" state and has a result value
  const isDone = state === "result" && result !== undefined;

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs border border-neutral-200">
      {isDone ? (
        // Green dot indicates the tool call completed successfully
        <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
      ) : (
        // Spinning loader indicates the tool is still running
        <Loader2 className="w-3 h-3 animate-spin text-blue-600 shrink-0" />
      )}
      <span className="text-neutral-700">{label}</span>
    </div>
  );
}
