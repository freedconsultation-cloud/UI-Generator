// VirtualFileSystem — an in-memory file system backed by a flat Map<path, FileNode>.
// All file operations happen in memory; nothing is ever written to disk.
// The AI tools (str_replace_editor, file_manager) interact with this class on the server,
// while the FileSystem context wraps it on the client for React state management.

export interface FileNode {
  type: "file" | "directory";
  name: string;   // Basename only (e.g. "App.jsx")
  path: string;   // Absolute path from root (e.g. "/components/App.jsx")
  content?: string;                 // Only present on file nodes
  children?: Map<string, FileNode>; // Only present on directory nodes
}

export class VirtualFileSystem {
  // Flat lookup table: absolute path → FileNode. O(1) access for any path.
  private files: Map<string, FileNode> = new Map();

  // The root directory node, also stored in `files` under the "/" key
  private root: FileNode;

  constructor() {
    this.root = {
      type: "directory",
      name: "/",
      path: "/",
      children: new Map(),
    };
    this.files.set("/", this.root);
  }

  // Ensure paths always start with "/" and never end with "/" (except the root itself)
  private normalizePath(path: string): string {
    if (!path.startsWith("/")) {
      path = "/" + path;
    }
    // Strip trailing slash
    if (path !== "/" && path.endsWith("/")) {
      path = path.slice(0, -1);
    }
    // Collapse consecutive slashes
    path = path.replace(/\/+/g, "/");
    return path;
  }

  // Return the path of a node's parent directory
  private getParentPath(path: string): string {
    const normalized = this.normalizePath(path);
    if (normalized === "/") return "/";
    const parts = normalized.split("/");
    parts.pop();
    // A path like "/foo" splits into ["", "foo"], so after pop we get [""] → "/"
    return parts.length === 1 ? "/" : parts.join("/");
  }

  // Return the basename of a path (last segment)
  private getFileName(path: string): string {
    const normalized = this.normalizePath(path);
    if (normalized === "/") return "/";
    const parts = normalized.split("/");
    return parts[parts.length - 1];
  }

  // Look up the parent directory node for a given path
  private getParentNode(path: string): FileNode | null {
    const parentPath = this.getParentPath(path);
    return this.files.get(parentPath) || null;
  }

  // Create a new file at the given path, optionally with initial content.
  // Automatically creates any missing ancestor directories.
  // Returns null if the file already exists or the parent is not a directory.
  createFile(path: string, content: string = ""): FileNode | null {
    const normalized = this.normalizePath(path);

    if (this.files.has(normalized)) {
      return null;
    }

    // Ensure all parent directories exist before creating the file
    const parts = normalized.split("/").filter(Boolean);
    let currentPath = "";

    for (let i = 0; i < parts.length - 1; i++) {
      currentPath += "/" + parts[i];
      if (!this.exists(currentPath)) {
        this.createDirectory(currentPath);
      }
    }

    const parent = this.getParentNode(normalized);
    if (!parent || parent.type !== "directory") {
      return null;
    }

    const fileName = this.getFileName(normalized);
    const file: FileNode = {
      type: "file",
      name: fileName,
      path: normalized,
      content,
    };

    // Register in the flat lookup table and in the parent's children map
    this.files.set(normalized, file);
    parent.children!.set(fileName, file);

    return file;
  }

  // Create a new empty directory. Returns null if it already exists.
  createDirectory(path: string): FileNode | null {
    const normalized = this.normalizePath(path);

    if (this.files.has(normalized)) {
      return null;
    }

    const parent = this.getParentNode(normalized);
    if (!parent || parent.type !== "directory") {
      return null;
    }

    const dirName = this.getFileName(normalized);
    const directory: FileNode = {
      type: "directory",
      name: dirName,
      path: normalized,
      children: new Map(),
    };

    this.files.set(normalized, directory);
    parent.children!.set(dirName, directory);

    return directory;
  }

  // Return the content of a file, or null if the path doesn't exist or is a directory
  readFile(path: string): string | null {
    const normalized = this.normalizePath(path);
    const file = this.files.get(normalized);

    if (!file || file.type !== "file") {
      return null;
    }

    return file.content || "";
  }

  // Overwrite a file's content. Returns false if the path doesn't exist or is a directory.
  updateFile(path: string, content: string): boolean {
    const normalized = this.normalizePath(path);
    const file = this.files.get(normalized);

    if (!file || file.type !== "file") {
      return false;
    }

    file.content = content;
    return true;
  }

  // Delete a file or directory. For directories, recursively deletes all children first.
  // Returns false if the path doesn't exist or is the root.
  deleteFile(path: string): boolean {
    const normalized = this.normalizePath(path);
    const file = this.files.get(normalized);

    if (!file || normalized === "/") {
      return false;
    }

    const parent = this.getParentNode(normalized);
    if (!parent || parent.type !== "directory") {
      return false;
    }

    // Recursively delete all descendants before removing the directory itself
    if (file.type === "directory" && file.children) {
      for (const [_, child] of file.children) {
        this.deleteFile(child.path);
      }
    }

    // Remove from the parent's children map and from the flat lookup table
    parent.children!.delete(file.name);
    this.files.delete(normalized);

    return true;
  }

  // Move or rename a file or directory. Creates missing parent directories at the destination.
  // For directories, recursively updates all descendant paths in the lookup table.
  rename(oldPath: string, newPath: string): boolean {
    const normalizedOld = this.normalizePath(oldPath);
    const normalizedNew = this.normalizePath(newPath);

    // Cannot rename the root directory
    if (normalizedOld === "/" || normalizedNew === "/") {
      return false;
    }

    const sourceNode = this.files.get(normalizedOld);
    if (!sourceNode) {
      return false;
    }

    // Destination must not already exist
    if (this.files.has(normalizedNew)) {
      return false;
    }

    const oldParent = this.getParentNode(normalizedOld);
    if (!oldParent || oldParent.type !== "directory") {
      return false;
    }

    // Create parent directories for the destination if they don't exist
    const newParentPath = this.getParentPath(normalizedNew);
    if (!this.exists(newParentPath)) {
      const parts = newParentPath.split("/").filter(Boolean);
      let currentPath = "";
      for (const part of parts) {
        currentPath += "/" + part;
        if (!this.exists(currentPath)) {
          this.createDirectory(currentPath);
        }
      }
    }

    const newParent = this.getParentNode(normalizedNew);
    if (!newParent || newParent.type !== "directory") {
      return false;
    }

    // Detach from the old parent
    oldParent.children!.delete(sourceNode.name);

    // Update the node's own name and path
    const newName = this.getFileName(normalizedNew);
    sourceNode.name = newName;
    sourceNode.path = normalizedNew;

    // Attach to the new parent
    newParent.children!.set(newName, sourceNode);

    // Update the flat lookup table
    this.files.delete(normalizedOld);
    this.files.set(normalizedNew, sourceNode);

    // For directories, recursively fix all descendant paths in the flat table
    if (sourceNode.type === "directory" && sourceNode.children) {
      this.updateChildrenPaths(sourceNode);
    }

    return true;
  }

  // Recursively update the path of every descendant after a directory rename
  private updateChildrenPaths(node: FileNode): void {
    if (node.type === "directory" && node.children) {
      for (const [_, child] of node.children) {
        const oldChildPath = child.path;

        // Recompute the child's path based on the parent's new path
        child.path = node.path + "/" + child.name;

        this.files.delete(oldChildPath);
        this.files.set(child.path, child);

        // Recurse into subdirectories
        if (child.type === "directory") {
          this.updateChildrenPaths(child);
        }
      }
    }
  }

  // Returns true if any node (file or directory) exists at the given path
  exists(path: string): boolean {
    const normalized = this.normalizePath(path);
    return this.files.has(normalized);
  }

  // Returns the FileNode at the given path, or null if it doesn't exist
  getNode(path: string): FileNode | null {
    const normalized = this.normalizePath(path);
    return this.files.get(normalized) || null;
  }

  // Returns the immediate children of a directory, or null if the path is not a directory
  listDirectory(path: string): FileNode[] | null {
    const normalized = this.normalizePath(path);
    const dir = this.files.get(normalized);

    if (!dir || dir.type !== "directory") {
      return null;
    }

    return Array.from(dir.children?.values() || []);
  }

  // Returns a flat Map of all file paths to their content (directories excluded)
  getAllFiles(): Map<string, string> {
    const fileMap = new Map<string, string>();

    for (const [path, node] of this.files) {
      if (node.type === "file") {
        fileMap.set(path, node.content || "");
      }
    }

    return fileMap;
  }

  // Serialize the entire VFS to a plain object for JSON storage.
  // Children Maps are omitted because they can be reconstructed from the path hierarchy.
  serialize(): Record<string, FileNode> {
    const result: Record<string, FileNode> = {};

    for (const [path, node] of this.files) {
      if (node.type === "directory") {
        // Strip the children Map so the output is JSON-serializable
        result[path] = {
          type: node.type,
          name: node.name,
          path: node.path,
        };
      } else {
        result[path] = {
          type: node.type,
          name: node.name,
          path: node.path,
          content: node.content,
        };
      }
    }

    return result;
  }

  // Restore the VFS from a legacy format where values are file content strings
  deserialize(data: Record<string, string>): void {
    // Reset to a clean slate before populating
    this.files.clear();
    this.root.children?.clear();
    this.files.set("/", this.root);

    // Sort paths so parent directories are always processed before their children
    const paths = Object.keys(data).sort();

    for (const path of paths) {
      // Create any missing ancestor directories
      const parts = path.split("/").filter(Boolean);
      let currentPath = "";
      for (let i = 0; i < parts.length - 1; i++) {
        currentPath += "/" + parts[i];
        if (!this.exists(currentPath)) {
          this.createDirectory(currentPath);
        }
      }
      this.createFile(path, data[path]);
    }
  }

  // Restore the VFS from the newer FileNode format (used by serialize())
  deserializeFromNodes(data: Record<string, FileNode>): void {
    // Reset to a clean slate before populating
    this.files.clear();
    this.root.children?.clear();
    this.files.set("/", this.root);

    // Sort paths so parent directories are always processed before their children
    const paths = Object.keys(data).sort();

    for (const path of paths) {
      if (path === "/") continue; // Root is already initialized above

      const node = data[path];
      const parts = path.split("/").filter(Boolean);
      let currentPath = "";

      // Ensure all ancestor directories exist
      for (let i = 0; i < parts.length - 1; i++) {
        currentPath += "/" + parts[i];
        if (!this.exists(currentPath)) {
          this.createDirectory(currentPath);
        }
      }

      // Create the leaf node as a file or directory
      if (node.type === "file") {
        this.createFile(path, node.content || "");
      } else if (node.type === "directory") {
        this.createDirectory(path);
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Text editor command implementations (used by the str_replace_editor tool)
  // ──────────────────────────────────────────────────────────────────────────

  // Return a directory listing or file content, with optional line-number range.
  // Returns a human-readable string intended to be sent back to the AI as a tool result.
  viewFile(path: string, viewRange?: [number, number]): string {
    const file = this.getNode(path);
    if (!file) {
      return `File not found: ${path}`;
    }

    // For directories, return a sorted listing of children
    if (file.type === "directory") {
      const children = this.listDirectory(path);
      if (!children || children.length === 0) {
        return "(empty directory)";
      }

      return children
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((child) => {
          const prefix = child.type === "directory" ? "[DIR]" : "[FILE]";
          return `${prefix} ${child.name}`;
        })
        .join("\n");
    }

    // For files, return content with 1-based line numbers
    const content = file.content || "";

    if (viewRange && viewRange.length === 2) {
      // Return only the requested line range
      const lines = content.split("\n");
      const [start, end] = viewRange;
      const startLine = Math.max(1, start);
      const endLine = end === -1 ? lines.length : Math.min(lines.length, end);

      const viewedLines = lines.slice(startLine - 1, endLine);
      return viewedLines
        .map((line, index) => `${startLine + index}\t${line}`)
        .join("\n");
    }

    // Return the full file content with line numbers
    const lines = content.split("\n");
    return (
      lines.map((line, index) => `${index + 1}\t${line}`).join("\n") ||
      "(empty file)"
    );
  }

  // Create a file at the given path, creating intermediate directories as needed.
  // Returns a human-readable result string for the AI tool response.
  createFileWithParents(path: string, content: string = ""): string {
    if (this.exists(path)) {
      return `Error: File already exists: ${path}`;
    }

    // Create all missing ancestor directories
    const parts = path.split("/").filter(Boolean);
    let currentPath = "";
    for (let i = 0; i < parts.length - 1; i++) {
      currentPath += "/" + parts[i];
      if (!this.exists(currentPath)) {
        this.createDirectory(currentPath);
      }
    }

    this.createFile(path, content);
    return `File created: ${path}`;
  }

  // Replace all occurrences of oldStr with newStr in a file.
  // Returns a human-readable result string for the AI tool response.
  replaceInFile(path: string, oldStr: string, newStr: string): string {
    const file = this.getNode(path);
    if (!file) {
      return `Error: File not found: ${path}`;
    }

    if (file.type !== "file") {
      return `Error: Cannot edit a directory: ${path}`;
    }

    const content = this.readFile(path) || "";

    // Fail early if the target string isn't present
    if (!oldStr || !content.includes(oldStr)) {
      return `Error: String not found in file: "${oldStr}"`;
    }

    // Count occurrences so the result message is informative
    const occurrences = (
      content.match(
        new RegExp(oldStr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")
      ) || []
    ).length;

    // Replace every occurrence (split/join avoids regex special-character issues)
    const updatedContent = content.split(oldStr).join(newStr || "");
    this.updateFile(path, updatedContent);

    return `Replaced ${occurrences} occurrence(s) of the string in ${path}`;
  }

  // Insert a line of text at the given 0-based line number.
  // Returns a human-readable result string for the AI tool response.
  insertInFile(path: string, insertLine: number, text: string): string {
    const file = this.getNode(path);
    if (!file) {
      return `Error: File not found: ${path}`;
    }

    if (file.type !== "file") {
      return `Error: Cannot edit a directory: ${path}`;
    }

    const content = this.readFile(path) || "";
    const lines = content.split("\n");

    // Validate that the requested line number is within bounds
    if (
      insertLine === undefined ||
      insertLine < 0 ||
      insertLine > lines.length
    ) {
      return `Error: Invalid line number: ${insertLine}. File has ${lines.length} lines.`;
    }

    // splice mutates lines in place — insert the new text at the requested position
    lines.splice(insertLine, 0, text || "");
    const updatedContent = lines.join("\n");
    this.updateFile(path, updatedContent);

    return `Text inserted at line ${insertLine} in ${path}`;
  }

  // Reset the VFS back to its initial empty state (only the root directory remains)
  reset(): void {
    this.files.clear();
    this.root = {
      type: "directory",
      name: "/",
      path: "/",
      children: new Map(),
    };
    this.files.set("/", this.root);
  }
}

// Singleton instance used by the server-side API route when no projectId is provided
export const fileSystem = new VirtualFileSystem();
