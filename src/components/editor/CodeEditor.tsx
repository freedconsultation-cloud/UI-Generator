"use client";

// CodeEditor — Monaco-based code editor for viewing and editing virtual file system files.
// Reads and writes file content through the FileSystem context so changes are
// immediately reflected in the live preview.

import { useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import { useFileSystem } from "@/lib/contexts/file-system-context";
import { Code2 } from "lucide-react";

export function CodeEditor() {
  // selectedFile is the VFS path of the file the user has clicked in the file tree
  const { selectedFile, getFileContent, updateFile } = useFileSystem();

  // Hold a reference to the Monaco editor instance for potential future imperative use
  const editorRef = useRef<any>(null);

  // Store the editor instance after it mounts so we can call its API if needed
  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
  };

  // Called on every keystroke — writes the new content back to the VFS,
  // which triggers a refreshTrigger increment and re-renders the preview
  const handleEditorChange = (value: string | undefined) => {
    if (selectedFile && value !== undefined) {
      updateFile(selectedFile, value);
    }
  };

  // Map file extensions to Monaco language identifiers for syntax highlighting
  const getLanguageFromPath = (path: string): string => {
    const extension = path.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'js':
      case 'jsx':
        return 'javascript';
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'json':
        return 'json';
      case 'css':
        return 'css';
      case 'html':
        return 'html';
      case 'md':
        return 'markdown';
      default:
        return 'plaintext';
    }
  };

  // Empty state — shown when no file is selected in the file tree
  if (!selectedFile) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <Code2 className="h-12 w-12 text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            Select a file to edit
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Choose a file from the file tree
          </p>
        </div>
      </div>
    );
  }

  // Read the current file content from the VFS and determine the language
  const content = getFileContent(selectedFile) || '';
  const language = getLanguageFromPath(selectedFile);

  return (
    <Editor
      height="100%"
      language={language}
      value={content}
      onChange={handleEditorChange}
      onMount={handleEditorDidMount}
      theme="vs-dark"
      options={{
        minimap: { enabled: false },    // Hide the minimap to save horizontal space
        fontSize: 14,
        lineNumbers: 'on',
        roundedSelection: false,
        scrollBeyondLastLine: false,    // Prevent extra blank space after the last line
        readOnly: false,
        automaticLayout: true,          // Resize the editor when its container changes size
        wordWrap: 'on',                 // Wrap long lines instead of scrolling horizontally
        padding: { top: 16, bottom: 16 },
      }}
    />
  );
}
