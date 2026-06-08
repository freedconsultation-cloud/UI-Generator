"use client";

// FileSystemContext — provides the VirtualFileSystem instance and mutating helpers
// to the entire component tree. Also interprets AI tool calls (str_replace_editor
// and file_manager) and applies them to the VFS so the preview updates in real time.

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { VirtualFileSystem, FileNode } from "@/lib/file-system";

// Shape of a tool call forwarded from the AI SDK's onToolCall callback
interface ToolCall {
  toolName: string;
  args: any;
}

interface FileSystemContextType {
  fileSystem: VirtualFileSystem;
  selectedFile: string | null;             // VFS path of the currently open file
  setSelectedFile: (path: string | null) => void;
  createFile: (path: string, content?: string) => void;
  updateFile: (path: string, content: string) => void;
  deleteFile: (path: string) => void;
  renameFile: (oldPath: string, newPath: string) => boolean;
  getFileContent: (path: string) => string | null;
  getAllFiles: () => Map<string, string>;
  refreshTrigger: number;                  // Incremented on every VFS mutation to trigger re-renders
  handleToolCall: (toolCall: ToolCall) => void;
  reset: () => void;
}

const FileSystemContext = createContext<FileSystemContextType | undefined>(
  undefined
);

export function FileSystemProvider({
  children,
  fileSystem: providedFileSystem,
  initialData,
}: {
  children: React.ReactNode;
  fileSystem?: VirtualFileSystem;          // Allow tests to inject a pre-configured instance
  initialData?: Record<string, any>;       // Serialized VFS nodes from a saved project
}) {
  // Create (or reuse) the VirtualFileSystem instance once on mount.
  // If initialData is provided, deserialize the saved file tree into it.
  const [fileSystem] = useState(() => {
    const fs = providedFileSystem || new VirtualFileSystem();
    if (initialData) {
      fs.deserializeFromNodes(initialData);
    }
    return fs;
  });

  // Which file is currently open in the code editor
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // A simple counter that components subscribe to for VFS change notifications.
  // React cannot deeply observe the VFS Map, so we use this as a proxy signal.
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Increment the trigger to notify all subscribers that the VFS changed
  const triggerRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  // Auto-select a file when the VFS is first populated.
  // Prefers /App.jsx; falls back to the first root-level file alphabetically.
  useEffect(() => {
    if (!selectedFile) {
      const files = fileSystem.getAllFiles();

      if (files.has("/App.jsx")) {
        setSelectedFile("/App.jsx");
      } else {
        // Find the first file at the root level (not inside any subdirectory)
        const rootFiles = Array.from(files.keys())
          .filter((path) => {
            const parts = path.split("/").filter(Boolean);
            return parts.length === 1;
          })
          .sort();

        if (rootFiles.length > 0) {
          setSelectedFile(rootFiles[0]);
        }
      }
    }
  }, [selectedFile, fileSystem, refreshTrigger]);

  // Create a new file and notify subscribers
  const createFile = useCallback(
    (path: string, content: string = "") => {
      fileSystem.createFile(path, content);
      triggerRefresh();
    },
    [fileSystem, triggerRefresh]
  );

  // Update an existing file's content and notify subscribers
  const updateFile = useCallback(
    (path: string, content: string) => {
      fileSystem.updateFile(path, content);
      triggerRefresh();
    },
    [fileSystem, triggerRefresh]
  );

  // Delete a file and clear the selection if the deleted file was open
  const deleteFile = useCallback(
    (path: string) => {
      fileSystem.deleteFile(path);
      if (selectedFile === path) {
        setSelectedFile(null);
      }
      triggerRefresh();
    },
    [fileSystem, selectedFile, triggerRefresh]
  );

  // Rename a file or directory, keeping the selected file path in sync
  const renameFile = useCallback(
    (oldPath: string, newPath: string): boolean => {
      const success = fileSystem.rename(oldPath, newPath);
      if (success) {
        if (selectedFile === oldPath) {
          // The selected file itself was renamed — update the selection
          setSelectedFile(newPath);
        } else if (selectedFile && selectedFile.startsWith(oldPath + "/")) {
          // The selected file is inside a renamed directory — update its path too
          const relativePath = selectedFile.substring(oldPath.length);
          setSelectedFile(newPath + relativePath);
        }
        triggerRefresh();
      }
      return success;
    },
    [fileSystem, selectedFile, triggerRefresh]
  );

  const getFileContent = useCallback(
    (path: string) => {
      return fileSystem.readFile(path);
    },
    [fileSystem]
  );

  const getAllFiles = useCallback(() => {
    return fileSystem.getAllFiles();
  }, [fileSystem]);

  // Clear all files and reset selection
  const reset = useCallback(() => {
    fileSystem.reset();
    setSelectedFile(null);
    triggerRefresh();
  }, [fileSystem, triggerRefresh]);

  // Translate AI SDK tool calls into VFS mutations.
  // This is called by ChatProvider's onToolCall handler during streaming.
  const handleToolCall = useCallback(
    (toolCall: ToolCall) => {
      const { toolName, args } = toolCall;

      // Handle the str_replace_editor tool (create / str_replace / insert commands)
      if (toolName === "str_replace_editor" && args) {
        const { command, path, file_text, old_str, new_str, insert_line } = args;

        switch (command) {
          case "create":
            // Create a new file, including any missing parent directories
            if (path && file_text !== undefined) {
              const result = fileSystem.createFileWithParents(path, file_text);
              if (!result.startsWith("Error:")) {
                createFile(path, file_text);
              }
            }
            break;

          case "str_replace":
            // Replace a specific string in an existing file
            if (path && old_str !== undefined && new_str !== undefined) {
              const result = fileSystem.replaceInFile(path, old_str, new_str);
              if (!result.startsWith("Error:")) {
                // Re-read the full content after replacement and push it to the editor
                const content = fileSystem.readFile(path);
                if (content !== null) {
                  updateFile(path, content);
                }
              }
            }
            break;

          case "insert":
            // Insert a new line at a specific line number
            if (path && new_str !== undefined && insert_line !== undefined) {
              const result = fileSystem.insertInFile(path, insert_line, new_str);
              if (!result.startsWith("Error:")) {
                const content = fileSystem.readFile(path);
                if (content !== null) {
                  updateFile(path, content);
                }
              }
            }
            break;
        }
      }

      // Handle the file_manager tool (rename / delete commands)
      if (toolName === "file_manager" && args) {
        const { command, path, new_path } = args;

        switch (command) {
          case "rename":
            if (path && new_path) {
              renameFile(path, new_path);
            }
            break;

          case "delete":
            if (path) {
              const success = fileSystem.deleteFile(path);
              if (success) {
                deleteFile(path);
              }
            }
            break;
        }
      }
    },
    [fileSystem, createFile, updateFile, deleteFile, renameFile]
  );

  return (
    <FileSystemContext.Provider
      value={{
        fileSystem,
        selectedFile,
        setSelectedFile,
        createFile,
        updateFile,
        deleteFile,
        renameFile,
        getFileContent,
        getAllFiles,
        refreshTrigger,
        handleToolCall,
        reset,
      }}
    >
      {children}
    </FileSystemContext.Provider>
  );
}

// Convenience hook — throws if used outside of FileSystemProvider
export function useFileSystem() {
  const context = useContext(FileSystemContext);
  if (!context) {
    throw new Error("useFileSystem must be used within a FileSystemProvider");
  }
  return context;
}
