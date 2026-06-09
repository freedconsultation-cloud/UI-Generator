"use client";

// PreviewFrame — renders the AI-generated React components inside a sandboxed iframe.
// On every VFS change, it re-compiles all files through the JSX transformer,
// builds an ES module import map with blob URLs, and writes the result to srcdoc.

import { useEffect, useRef, useState } from "react";
import { useFileSystem } from "@/lib/contexts/file-system-context";
import {
  createImportMap,
  createPreviewHTML,
} from "@/lib/transform/jsx-transformer";
import { AlertCircle } from "lucide-react";

export function PreviewFrame() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // getAllFiles returns a flat Map<path, content> of all files in the VFS.
  // refreshTrigger is incremented whenever any file is created, updated, or deleted.
  const { getAllFiles, refreshTrigger } = useFileSystem();

  // Human-readable error string, or the special "firstLoad" sentinel
  const [error, setError] = useState<string | null>(null);
  // Ref mirrors error state so the effect can read it without listing error as a dependency
  // (listing error caused a redundant re-run every time the effect cleared the error)
  const errorRef = useRef<string | null>(null);
  errorRef.current = error;

  // The file used as the root React component; defaults to /App.jsx
  const [entryPoint, setEntryPoint] = useState<string>("/App.jsx");

  // Tracks whether the user has not yet sent their first message
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  useEffect(() => {
    const updatePreview = () => {
      try {
        const files = getAllFiles();

        // Clear a stale error as soon as we have files to render
        if (files.size > 0 && errorRef.current) {
          setError(null);
        }

        // Discover the entry point by trying common file name conventions in order
        let foundEntryPoint = entryPoint;
        const possibleEntries = [
          "/App.jsx",
          "/App.tsx",
          "/index.jsx",
          "/index.tsx",
          "/src/App.jsx",
          "/src/App.tsx",
        ];

        if (!files.has(entryPoint)) {
          // Check known conventions first
          const found = possibleEntries.find((path) => files.has(path));
          if (found) {
            foundEntryPoint = found;
            setEntryPoint(found);
          } else if (files.size > 0) {
            // Fall back to the first .jsx/.tsx file found in the VFS
            const firstJSX = Array.from(files.keys()).find(
              (path) => path.endsWith(".jsx") || path.endsWith(".tsx")
            );
            if (firstJSX) {
              foundEntryPoint = firstJSX;
              setEntryPoint(firstJSX);
            }
          }
        }

        // No files yet — show the welcome screen on first load, generic error after
        if (files.size === 0) {
          if (isFirstLoad) {
            setError("firstLoad");
          } else {
            setError("No files to preview");
          }
          return;
        }

        // Once we have files, we're past the initial empty state
        if (isFirstLoad) {
          setIsFirstLoad(false);
        }

        // Can't preview without a valid entry point
        if (!foundEntryPoint || !files.has(foundEntryPoint)) {
          setError(
            "No React component found. Create an App.jsx or index.jsx file to get started."
          );
          return;
        }

        // Transform all VFS files through Babel and build the ES module import map
        const { importMap, styles, errors } = createImportMap(files);

        // Generate the full HTML document string for the iframe
        const previewHTML = createPreviewHTML(foundEntryPoint, importMap, styles, errors);

        if (iframeRef.current) {
          const iframe = iframeRef.current;

          // allow-same-origin is required for blob: URLs used in the import map to load correctly
          iframe.setAttribute(
            "sandbox",
            "allow-scripts allow-same-origin allow-forms"
          );

          // Writing to srcdoc replaces the entire iframe document without a network request
          iframe.srcdoc = previewHTML;

          setError(null);
        }
      } catch (err) {
        console.error("Preview error:", err);
        setError(err instanceof Error ? err.message : "Unknown preview error");
      }
    };

    updatePreview();
  }, [refreshTrigger, getAllFiles, entryPoint, isFirstLoad]);
  // Re-run whenever the VFS changes (refreshTrigger) or the entry point shifts
  // Note: error is intentionally excluded — the effect reads it via errorRef to avoid
  // a redundant re-run each time the effect clears the error itself

  // Welcome screen shown on first load before the AI has created any files
  if (error) {
    if (error === "firstLoad") {
      return (
        <div className="h-full flex items-center justify-center p-8 bg-gray-50">
          <div className="text-center max-w-md">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
              <svg
                className="h-8 w-8 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Welcome to UI Generator
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Start building React components with AI assistance
            </p>
            <p className="text-xs text-gray-500">
              Ask the AI to create your first component to see it live here
            </p>
          </div>
        </div>
      );
    }

    // Generic error state — shown when the VFS exists but has no renderable entry point
    return (
      <div className="h-full flex items-center justify-center p-8 bg-gray-50">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
            <AlertCircle className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No Preview Available
          </h3>
          <p className="text-sm text-gray-500">{error}</p>
          <p className="text-xs text-gray-400 mt-2">
            Start by creating a React component using the AI assistant
          </p>
        </div>
      </div>
    );
  }

  // The iframe — srcdoc is updated imperatively inside the useEffect above
  return (
    <iframe
      ref={iframeRef}
      className="w-full h-full border-0 bg-white"
      title="Preview"
    />
  );
}
