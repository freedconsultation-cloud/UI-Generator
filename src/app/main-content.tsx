"use client";

// MainContent — the primary UI shell shared by both the home page (anonymous)
// and the project page (authenticated). It wraps the entire editor layout
// inside the FileSystem and Chat context providers.

import { useState } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { FileSystemProvider } from "@/lib/contexts/file-system-context";
import { ChatProvider } from "@/lib/contexts/chat-context";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { FileTree } from "@/components/editor/FileTree";
import { CodeEditor } from "@/components/editor/CodeEditor";
import { PreviewFrame } from "@/components/preview/PreviewFrame";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HeaderActions } from "@/components/HeaderActions";

interface MainContentProps {
  // Null when the user is anonymous
  user?: {
    id: string;
    email: string;
  } | null;
  // Undefined when rendering the home page without a saved project
  project?: {
    id: string;
    name: string;
    messages: any[];
    data: any;
    createdAt: Date;
    updatedAt: Date;
  };
}

export function MainContent({ user, project }: MainContentProps) {
  // Toggle between the live preview iframe and the code editor panel
  const [activeView, setActiveView] = useState<"preview" | "code">("preview");

  return (
    // FileSystemProvider initializes the VirtualFileSystem, optionally pre-populated
    // with saved project data so the editor state is restored on page load
    <FileSystemProvider initialData={project?.data}>
      {/* ChatProvider wires up the Vercel AI SDK useChat hook and connects it
          to the file system so tool calls mutate the VFS in real time */}
      <ChatProvider projectId={project?.id} initialMessages={project?.messages}>
        <div className="h-screen w-screen overflow-hidden bg-neutral-50">
          {/* Two-column resizable layout: chat on the left, editor/preview on the right */}
          <ResizablePanelGroup id="main" direction="horizontal" className="h-full">

            {/* Left panel — chat interface */}
            <ResizablePanel defaultSize={35} minSize={25} maxSize={50}>
              <div className="h-full flex flex-col bg-white">
                {/* Chat header bar */}
                <div className="h-14 flex items-center px-6 border-b border-neutral-200/60">
                  <h1 className="text-lg font-semibold text-neutral-900 tracking-tight">React Component Generator</h1>
                </div>

                {/* Scrollable chat message list + input */}
                <div className="flex-1 overflow-hidden">
                  <ChatInterface />
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle className="w-[1px] bg-neutral-200 hover:bg-neutral-300 transition-colors" />

            {/* Right panel — preview and code editor */}
            <ResizablePanel defaultSize={65}>
              <div className="h-full flex flex-col bg-white">

                {/* Top bar with Preview/Code tabs and user actions */}
                {/* onPointerDown: if the preview iframe holds focus, blur it before the tab click
                    is processed so Radix's pointerdown preventDefault doesn't swallow the event */}
                <div
                  className="h-14 border-b border-neutral-200/60 px-6 flex items-center justify-between bg-neutral-50/50"
                  onPointerDown={() => {
                    const active = document.activeElement;
                    if (active instanceof HTMLIFrameElement) active.blur();
                  }}
                >
                  {/* Tab switcher between the live preview iframe and the code view */}
                  <Tabs
                    value={activeView}
                    onValueChange={(v) =>
                      setActiveView(v as "preview" | "code")
                    }
                  >
                    <TabsList className="bg-white/60 border border-neutral-200/60 p-0.5 h-9 shadow-sm">
                      <TabsTrigger value="preview" className="data-[state=active]:bg-white data-[state=active]:text-neutral-900 data-[state=active]:shadow-sm text-neutral-600 px-4 py-1.5 text-sm font-medium transition-all">Preview</TabsTrigger>
                      <TabsTrigger value="code" className="data-[state=active]:bg-white data-[state=active]:text-neutral-900 data-[state=active]:shadow-sm text-neutral-600 px-4 py-1.5 text-sm font-medium transition-all">Code</TabsTrigger>
                    </TabsList>
                  </Tabs>

                  {/* Auth buttons (anonymous) or project switcher + sign-out (authenticated) */}
                  <HeaderActions user={user} projectId={project?.id} />
                </div>

                {/* Content area — switches between preview iframe and code editor */}
                <div className="flex-1 overflow-hidden bg-neutral-50">
                  {activeView === "preview" ? (
                    // Live preview: Babel-compiled components running inside a sandboxed iframe
                    <div className="h-full bg-white">
                      <PreviewFrame />
                    </div>
                  ) : (
                    // Code view: file tree on the left, Monaco editor on the right
                    <ResizablePanelGroup
                      id="code-editor"
                      direction="horizontal"
                      className="h-full"
                    >
                      {/* File tree panel */}
                      <ResizablePanel
                        defaultSize={30}
                        minSize={20}
                        maxSize={50}
                      >
                        <div className="h-full bg-neutral-50 border-r border-neutral-200">
                          <FileTree />
                        </div>
                      </ResizablePanel>

                      <ResizableHandle className="w-[1px] bg-neutral-200 hover:bg-neutral-300 transition-colors" />

                      {/* Monaco code editor panel */}
                      <ResizablePanel defaultSize={70}>
                        <div className="h-full bg-white">
                          <CodeEditor />
                        </div>
                      </ResizablePanel>
                    </ResizablePanelGroup>
                  )}
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </ChatProvider>
    </FileSystemProvider>
  );
}
