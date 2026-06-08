"use client";

// FileTree — renders the virtual file system as a navigable tree.
// Directories are collapsible; clicking a file selects it in the code editor.

import { useState } from "react";
import { FileNode } from "@/lib/file-system";
import { useFileSystem } from "@/lib/contexts/file-system-context";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileCode,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FileTreeNodeProps {
  node: FileNode;
  level: number; // Indentation depth — drives the paddingLeft style
}

// Recursive component that renders a single node and its children
function FileTreeNode({ node, level }: FileTreeNodeProps) {
  const { selectedFile, setSelectedFile } = useFileSystem();

  // Track whether a directory is expanded or collapsed; starts open by default
  const [isExpanded, setIsExpanded] = useState(true);

  const handleClick = () => {
    if (node.type === "directory") {
      // Toggle the expanded state for directories
      setIsExpanded(!isExpanded);
    } else {
      // Select the file so the code editor loads its content
      setSelectedFile(node.path);
    }
  };

  // Sort children: directories first, then files, both alphabetically
  const children =
    node.type === "directory" && node.children
      ? Array.from(node.children.values()).sort((a, b) => {
          if (a.type !== b.type) {
            return a.type === "directory" ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        })
      : [];

  return (
    <div>
      {/* Row for this node — highlight when it is the selected file */}
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 cursor-pointer text-sm transition-colors",
          selectedFile === node.path && "bg-blue-50 text-blue-600"
        )}
        // Indent each level by 12px so the tree hierarchy is visually clear
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleClick}
      >
        {node.type === "directory" ? (
          <>
            {/* Chevron indicates expanded/collapsed state */}
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-500" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-500" />
            )}
            {/* Open/closed folder icon mirrors the expanded state */}
            {isExpanded ? (
              <FolderOpen className="h-4 w-4 shrink-0 text-blue-500" />
            ) : (
              <Folder className="h-4 w-4 shrink-0 text-blue-500" />
            )}
          </>
        ) : (
          <>
            {/* Spacer to align file icons with directory icons */}
            <div className="w-3.5" />
            <FileCode className="h-4 w-4 shrink-0 text-gray-400" />
          </>
        )}
        <span className="truncate text-gray-700">{node.name}</span>
      </div>

      {/* Recursively render children when the directory is expanded */}
      {node.type === "directory" && isExpanded && children.length > 0 && (
        <div>
          {children.map((child) => (
            <FileTreeNode key={child.path} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// Root FileTree component — reads the VFS root node and renders its top-level children
export function FileTree() {
  // refreshTrigger is incremented by the context whenever the VFS changes,
  // causing this component to re-render with the latest file structure
  const { fileSystem, refreshTrigger } = useFileSystem();
  const rootNode = fileSystem.getNode("/");

  // Empty state — shown when the AI has not yet created any files
  if (!rootNode || !rootNode.children || rootNode.children.size === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <Folder className="h-12 w-12 text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">No files yet</p>
        <p className="text-xs text-gray-400 mt-1">Files will appear here</p>
      </div>
    );
  }

  // Sort root-level entries: directories first, then files, alphabetically
  const rootChildren = Array.from(rootNode.children.values()).sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "directory" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <ScrollArea className="h-full">
      {/* key=refreshTrigger forces a full re-render when the VFS changes,
          ensuring newly added files immediately appear in the tree */}
      <div className="py-2" key={refreshTrigger}>
        {rootChildren.map((child) => (
          <FileTreeNode key={child.path} node={child} level={0} />
        ))}
      </div>
    </ScrollArea>
  );
}
