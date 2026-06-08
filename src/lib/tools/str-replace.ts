// str-replace tool — gives the AI model a text-editor-like interface for
// reading and writing files in the VirtualFileSystem. The tool is instantiated
// per-request so each streaming session gets its own isolated VFS instance.

import { z } from "zod";
import { VirtualFileSystem } from "@/lib/file-system";

// Zod schema that validates the arguments the AI passes to the tool
const TextEditorParameters = z.object({
  command: z.enum(["view", "create", "str_replace", "insert", "undo_edit"]),
  path: z.string(),
  file_text: z.string().optional(),       // Content for the "create" command
  insert_line: z.number().optional(),     // 0-based line number for "insert"
  new_str: z.string().optional(),         // Replacement / insertion text
  old_str: z.string().optional(),         // String to find for "str_replace"
  view_range: z.array(z.number()).optional(), // [startLine, endLine] for "view"
});

export const buildStrReplaceTool = (fileSystem: VirtualFileSystem) => {
  return {
    id: "str_replace_editor" as const,
    args: {},
    parameters: TextEditorParameters,
    execute: async ({
      command,
      path,
      file_text,
      insert_line,
      new_str,
      old_str,
      view_range,
    }: z.infer<typeof TextEditorParameters>) => {
      switch (command) {
        // View file content (or directory listing) with optional line range
        case "view":
          return fileSystem.viewFile(
            path,
            view_range as [number, number] | undefined
          );

        // Create a new file, auto-creating parent directories
        case "create":
          return fileSystem.createFileWithParents(path, file_text || "");

        // Replace all occurrences of old_str with new_str in the file
        case "str_replace":
          return fileSystem.replaceInFile(path, old_str || "", new_str || "");

        // Insert new_str at the given 0-based line number
        case "insert":
          return fileSystem.insertInFile(path, insert_line || 0, new_str || "");

        // undo_edit is not implemented — the AI should use str_replace to revert changes
        case "undo_edit":
          return `Error: undo_edit command is not supported in this version. Use str_replace to revert changes.`;
      }
    },
  };
};
