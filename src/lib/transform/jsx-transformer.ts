// jsx-transformer.ts — compiles virtual file system files for browser execution.
// Runs entirely in the browser (no server involvement).
//
// Pipeline:
//   1. Each .jsx/.tsx file is transformed with @babel/standalone (React + optional TypeScript)
//   2. Local file imports are resolved to blob: URLs; third-party packages route to esm.sh
//   3. An ES module import map is built so the browser can resolve all imports
//   4. A full HTML document string is generated and written to the preview iframe's srcdoc

import * as Babel from "@babel/standalone";

export interface TransformResult {
  code: string;
  error?: string;
  missingImports?: Set<string>; // Import specifiers found in the source that need resolving
  cssImports?: Set<string>;     // CSS file paths referenced by import statements
}

// Create a stub React component module for imports that can't be resolved.
// This prevents a missing file from breaking the entire preview.
function createPlaceholderModule(componentName: string): string {
  return `
import React from 'react';
const ${componentName} = function() {
  return React.createElement('div', {}, null);
}
export default ${componentName};
export { ${componentName} };
`;
}

// Transform a single JSX/TSX file using Babel and collect its import specifiers.
// Returns the compiled JS code and any imports that need further resolution.
export function transformJSX(
  code: string,
  filename: string,
  existingFiles: Set<string>
): TransformResult {
  try {
    const isTypeScript = filename.endsWith(".ts") || filename.endsWith(".tsx");

    let processedCode = code;
    const imports = new Set<string>();
    const cssImports = new Set<string>();

    // Detect CSS imports separately — they can't be transformed by Babel
    const cssImportRegex = /import\s+['"]([^'"]+\.css)['"]/g;
    let cssMatch;
    while ((cssMatch = cssImportRegex.exec(code)) !== null) {
      cssImports.add(cssMatch[1]);
    }

    // Strip CSS imports from the code before Babel sees it (Babel can't handle them)
    processedCode = processedCode.replace(cssImportRegex, '');

    // Collect all non-CSS import specifiers so they can be added to the import map
    const importRegex =
      /import\s+(?:{[^}]+}|[^,\s]+)?\s*(?:,\s*{[^}]+})?\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(code)) !== null) {
      if (!match[1].endsWith('.css')) {
        imports.add(match[1]);
      }
    }

    // Compile JSX/TSX to plain JS using the React automatic runtime
    const result = Babel.transform(processedCode, {
      filename,
      presets: [
        ["react", { runtime: "automatic" }], // Injects the JSX runtime automatically
        ...(isTypeScript ? ["typescript"] : []),
      ],
      plugins: [],
    });

    return {
      code: result.code || "",
      missingImports: imports,
      cssImports: cssImports,
    };
  } catch (error) {
    return {
      code: "",
      error: error instanceof Error ? error.message : "Unknown transform error",
    };
  }
}

// Create a blob: URL for a string of JavaScript code so it can be used in an import map
export function createBlobURL(
  code: string,
  mimeType: string = "application/javascript"
): string {
  const blob = new Blob([code], { type: mimeType });
  return URL.createObjectURL(blob);
}

export interface ImportMapResult {
  importMap: string;                           // JSON string for the <script type="importmap"> tag
  styles: string;                              // Concatenated CSS from all .css files in the VFS
  errors: Array<{ path: string; error: string }>; // Babel errors for display in the preview
}

// Build an ES module import map from the current VFS file set.
// Steps:
//   1. Transform every JS/JSX/TS/TSX file with Babel → blob URL
//   2. Map every import specifier to either a blob URL (local) or esm.sh URL (third-party)
//   3. Create placeholder stub modules for unresolvable local imports
//   4. Collect all CSS file content into a single style string
export function createImportMap(files: Map<string, string>): ImportMapResult {
  // Seed the import map with React 19 and its required sub-paths from esm.sh
  const imports: Record<string, string> = {
    react: "https://esm.sh/react@19",
    "react-dom": "https://esm.sh/react-dom@19",
    "react-dom/client": "https://esm.sh/react-dom@19/client",
    "react/jsx-runtime": "https://esm.sh/react@19/jsx-runtime",
    "react/jsx-dev-runtime": "https://esm.sh/react@19/jsx-dev-runtime",
  };

  const transformedFiles = new Map<string, string>(); // path → blob URL
  const existingFiles = new Set(files.keys());
  const allImports = new Set<string>();               // All import specifiers across all files
  const allCssImports = new Set<{ from: string; cssPath: string }>(); // CSS imports to process
  let collectedStyles = "";
  const errors: Array<{ path: string; error: string }> = [];

  // ── First pass: transform every JS/JSX/TS/TSX file ──────────────────────
  for (const [path, content] of files) {
    if (
      path.endsWith(".js") ||
      path.endsWith(".jsx") ||
      path.endsWith(".ts") ||
      path.endsWith(".tsx")
    ) {
      const { code, error, missingImports, cssImports } = transformJSX(
        content,
        path,
        existingFiles
      );

      if (error) {
        // Track the Babel error but skip this file — don't create a broken blob URL
        errors.push({ path, error });
        continue;
      }

      // Create a blob URL for the compiled code
      const blobUrl = createBlobURL(code);
      transformedFiles.set(path, blobUrl);

      // Classify each import: third-party packages go to esm.sh, local imports to allImports
      if (missingImports) {
        missingImports.forEach((imp) => {
          const isPackage = !imp.startsWith(".") &&
                            !imp.startsWith("/") &&
                            !imp.startsWith("@/");

          if (isPackage) {
            // Map the package name directly to its esm.sh CDN URL
            imports[imp] = `https://esm.sh/${imp}`;
          } else {
            // Queue local imports for resolution in the second pass
            allImports.add(imp);
          }
        });
      }

      // Queue CSS imports for processing after all JS files are done
      if (cssImports) {
        cssImports.forEach((cssImport) => {
          allCssImports.add({ from: path, cssPath: cssImport });
        });
      }

      // Register the file under its absolute path (e.g. "/App.jsx")
      imports[path] = blobUrl;

      // Also register without the leading slash for relative imports (e.g. "App.jsx")
      if (path.startsWith("/")) {
        imports[path.substring(1)] = blobUrl;
      }

      // Register @/ alias entries so "import Foo from '@/components/Foo'" resolves correctly
      if (path.startsWith("/")) {
        imports["@" + path] = blobUrl;
        imports["@/" + path.substring(1)] = blobUrl;
      }

      // Register path variants without file extensions (both absolute and @/ aliased)
      const pathWithoutExt = path.replace(/\.(jsx?|tsx?)$/, "");
      imports[pathWithoutExt] = blobUrl;

      if (path.startsWith("/")) {
        imports[pathWithoutExt.substring(1)] = blobUrl;
        imports["@" + pathWithoutExt] = blobUrl;
        imports["@/" + pathWithoutExt.substring(1)] = blobUrl;
      }
    } else if (path.endsWith(".css")) {
      // Collect CSS file content — it will be injected as a <style> block in the iframe
      collectedStyles += `/* ${path} */\n${content}\n\n`;
    }
  }

  // ── Process CSS imports referenced from JS files ─────────────────────────
  for (const { from, cssPath } of allCssImports) {
    let resolvedPath = cssPath;

    if (cssPath.startsWith("@/")) {
      // @/ alias maps to the VFS root
      resolvedPath = cssPath.replace("@/", "/");
    } else if (cssPath.startsWith("./") || cssPath.startsWith("../")) {
      // Resolve relative CSS path against the importing file's directory
      const fromDir = from.substring(0, from.lastIndexOf("/"));
      resolvedPath = resolveRelativePath(fromDir, cssPath);
    }

    // If the CSS file isn't in the VFS, note it (already collected if it was found above)
    if (!files.has(resolvedPath)) {
      collectedStyles += `/* ${cssPath} not found */\n`;
    }
  }

  // ── Second pass: resolve or stub unresolved local imports ────────────────
  for (const importPath of allImports) {
    // Skip imports that are already mapped (React, third-party packages added above, etc.)
    if (imports[importPath] || importPath.startsWith("react")) {
      continue;
    }

    const isPackage = !importPath.startsWith(".") &&
                      !importPath.startsWith("/") &&
                      !importPath.startsWith("@/");

    if (isPackage) {
      // Remaining third-party packages get mapped to esm.sh
      imports[importPath] = `https://esm.sh/${importPath}`;
      continue;
    }

    // Check whether the local file exists under any of its possible path variations
    let found = false;
    const variations = [
      importPath,
      importPath + ".jsx",
      importPath + ".tsx",
      importPath + ".js",
      importPath + ".ts",
      importPath.replace("@/", "/"),
      importPath.replace("@/", "/") + ".jsx",
      importPath.replace("@/", "/") + ".tsx",
    ];

    for (const variant of variations) {
      if (imports[variant] || files.has(variant)) {
        found = true;
        break;
      }
    }

    if (!found) {
      // Create a no-op placeholder module so a missing import doesn't break the preview
      const match = importPath.match(/\/([^\/]+)$/);
      const componentName = match
        ? match[1]
        : importPath.replace(/[^a-zA-Z0-9]/g, "");

      const placeholderCode = createPlaceholderModule(componentName);
      const placeholderUrl = createBlobURL(placeholderCode);

      // Register all alias variations of the import path to the same placeholder
      imports[importPath] = placeholderUrl;
      if (importPath.startsWith("@/")) {
        imports[importPath.replace("@/", "/")] = placeholderUrl;
        imports[importPath.replace("@/", "")] = placeholderUrl;
      }
    }
  }

  return {
    importMap: JSON.stringify({ imports }, null, 2),
    styles: collectedStyles,
    errors,
  };
}

// Resolve a relative path (e.g. "../utils") against a base directory (e.g. "/components")
function resolveRelativePath(fromDir: string, relativePath: string): string {
  const parts = fromDir.split("/").filter(Boolean);
  const relParts = relativePath.split("/");

  for (const part of relParts) {
    if (part === "..") {
      // Go up one directory
      parts.pop();
    } else if (part !== ".") {
      // Append non-trivial path segments
      parts.push(part);
    }
  }

  return "/" + parts.join("/");
}

// Build a complete HTML document that loads the generated components via ES modules.
// If there are Babel errors, shows a formatted error panel instead of trying to run the app.
export function createPreviewHTML(
  entryPoint: string,
  importMap: string,
  styles: string = "",
  errors: Array<{ path: string; error: string }> = []
): string {
  // Resolve the entry point specifier to its blob URL using the import map
  let entryPointUrl = entryPoint;
  try {
    const importMapObj = JSON.parse(importMap);
    if (importMapObj.imports && importMapObj.imports[entryPoint]) {
      entryPointUrl = importMapObj.imports[entryPoint];
    }
  } catch (e) {
    console.error("Failed to parse import map:", e);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  <!-- Tailwind CDN provides utility classes without a build step -->
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    #root {
      width: 100vw;
      height: 100vh;
    }
    .error-boundary {
      color: red;
      padding: 1rem;
      border: 2px solid red;
      margin: 1rem;
      border-radius: 4px;
      background: #fee;
    }
    /* Styles for the Babel syntax error panel */
    .syntax-errors {
      background: #fef5f5;
      border: 2px solid #ff6b6b;
      border-radius: 12px;
      padding: 32px;
      margin: 24px;
      font-family: 'SF Mono', Monaco, Consolas, 'Courier New', monospace;
      font-size: 14px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .syntax-errors h3 {
      color: #dc2626;
      margin: 0 0 20px 0;
      font-size: 18px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .syntax-errors .error-item {
      margin: 16px 0;
      padding: 16px;
      background: #fff;
      border-radius: 8px;
      border-left: 4px solid #ff6b6b;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }
    .syntax-errors .error-path {
      font-weight: 600;
      color: #991b1b;
      font-size: 15px;
      margin-bottom: 8px;
    }
    .syntax-errors .error-message {
      color: #7c2d12;
      margin-top: 8px;
      white-space: pre-wrap;
      line-height: 1.5;
      font-size: 13px;
    }
    .syntax-errors .error-location {
      display: inline-block;
      background: #fee0e0;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
      margin-left: 8px;
      color: #991b1b;
    }
  </style>
  <!-- Inject any CSS files collected from the VFS -->
  ${styles ? `<style>\n${styles}</style>` : ''}
  <!-- ES module import map: maps specifiers to blob URLs or esm.sh CDN URLs -->
  <script type="importmap">
    ${importMap}
  </script>
</head>
<body>
  <!-- Show a formatted error panel when Babel could not compile one or more files -->
  ${errors.length > 0 ? `
    <div class="syntax-errors">
      <h3>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style="flex-shrink: 0;">
          <path d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm1 15h-2v-2h2v2zm0-4h-2V5h2v6z" fill="#dc2626"/>
        </svg>
        Syntax Error${errors.length > 1 ? 's' : ''} (${errors.length})
      </h3>
      ${errors.map(e => {
        // Extract the "(line:col)" location marker from the Babel error message if present
        const locationMatch = e.error.match(/\((\d+:\d+)\)/);
        const location = locationMatch ? locationMatch[1] : '';
        const cleanError = e.error.replace(/\(\d+:\d+\)/, '').trim();

        return `
        <div class="error-item">
          <div class="error-path">
            ${e.path}
            ${location ? `<span class="error-location">${location}</span>` : ''}
          </div>
          <div class="error-message">${cleanError.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        </div>
      `;
      }).join('')}
    </div>
  ` : ''}

  <!-- React mounts into this div -->
  <div id="root"></div>

  <!-- Only load the app module when there are no compile errors -->
  ${errors.length === 0 ? `<script type="module">
    import React from 'react';
    import ReactDOM from 'react-dom/client';

    // React error boundary catches runtime errors and shows them instead of a blank screen
    class ErrorBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
      }

      static getDerivedStateFromError(error) {
        return { hasError: true, error };
      }

      componentDidCatch(error, errorInfo) {
        console.error('Error caught by boundary:', error, errorInfo);
      }

      render() {
        if (this.state.hasError) {
          return React.createElement('div', { className: 'error-boundary' },
            React.createElement('h2', null, 'Something went wrong'),
            React.createElement('pre', null, this.state.error?.toString())
          );
        }
        return this.props.children;
      }
    }

    // Dynamically import the entry point module (a blob URL) and mount it
    async function loadApp() {
      try {
        const module = await import('${entryPointUrl}');
        // Support both "export default App" and "export { App }" patterns
        const App = module.default || module.App;

        if (!App) {
          throw new Error('No default export or App export found in ${entryPoint}');
        }

        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(
          React.createElement(ErrorBoundary, null,
            React.createElement(App)
          )
        );
      } catch (error) {
        console.error('Failed to load app:', error);
        console.error('Import map:', ${JSON.stringify(importMap)});
        document.getElementById('root').innerHTML = '<div class="error-boundary"><h2>Failed to load app</h2><pre>' + error.toString() + '</pre></div>';
      }
    }

    loadApp();
  </script>` : ''}
</body>
</html>`;
}
