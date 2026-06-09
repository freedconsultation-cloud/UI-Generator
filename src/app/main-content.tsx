"use client";

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
  user?: { id: string; email: string } | null;
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
  const [activeView, setActiveView] = useState<"preview" | "code">("preview");
  const [mobileTab, setMobileTab] = useState<"chat" | "preview" | "code">("chat");

  return (
    <FileSystemProvider initialData={project?.data}>
      <ChatProvider projectId={project?.id} initialMessages={project?.messages}>
        <div className="h-screen w-screen overflow-hidden bg-neutral-50 flex flex-col">

          {/* ── Mobile layout ── */}
          <div className="flex flex-col h-full md:hidden">
            {/* Header */}
            <div
              className="h-14 flex items-center justify-between px-4 border-b border-neutral-200/60 bg-white shrink-0"
              onPointerDown={() => {
                const active = document.activeElement;
                if (active instanceof HTMLIFrameElement) active.blur();
              }}
            >
              <h1 className="text-base font-semibold text-neutral-900 tracking-tight truncate">
                React Component Generator
              </h1>
              <HeaderActions user={user} projectId={project?.id} />
            </div>

            {/* Tab bar */}
            <div className="shrink-0 flex border-b border-neutral-200/60 bg-white">
              {(["chat", "preview", "code"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setMobileTab(tab)}
                  className="flex-1 py-2.5 text-xs font-medium capitalize transition-colors"
                  style={{
                    color: mobileTab === tab ? "#171717" : "#737373",
                    borderBottom: mobileTab === tab ? "2px solid #171717" : "2px solid transparent",
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Panel content */}
            <div className="flex-1 overflow-hidden">
              {mobileTab === "chat" && (
                <div className="h-full flex flex-col bg-white">
                  <ChatInterface />
                </div>
              )}
              {mobileTab === "preview" && (
                <div className="h-full bg-white">
                  <PreviewFrame />
                </div>
              )}
              {mobileTab === "code" && (
                <div className="h-full flex bg-neutral-50">
                  <div className="w-28 shrink-0 border-r border-neutral-200">
                    <FileTree />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <CodeEditor />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Desktop layout ── */}
          <div className="hidden md:flex h-full">
            <ResizablePanelGroup id="main" direction="horizontal" className="h-full">
              {/* Left panel — chat */}
              <ResizablePanel defaultSize={35} minSize={25} maxSize={50}>
                <div className="h-full flex flex-col bg-white">
                  <div className="h-14 flex items-center px-6 border-b border-neutral-200/60">
                    <h1 className="text-lg font-semibold text-neutral-900 tracking-tight">
                      React Component Generator
                    </h1>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <ChatInterface />
                  </div>
                </div>
              </ResizablePanel>

              <ResizableHandle className="w-[1px] bg-neutral-200 hover:bg-neutral-300 transition-colors" />

              {/* Right panel — preview / code */}
              <ResizablePanel defaultSize={65}>
                <div className="h-full flex flex-col bg-white">
                  <div
                    className="h-14 border-b border-neutral-200/60 px-6 flex items-center justify-between bg-neutral-50/50"
                    onPointerDown={() => {
                      const active = document.activeElement;
                      if (active instanceof HTMLIFrameElement) active.blur();
                    }}
                  >
                    <Tabs
                      value={activeView}
                      onValueChange={(v) => setActiveView(v as "preview" | "code")}
                    >
                      <TabsList className="bg-white/60 border border-neutral-200/60 p-0.5 h-9 shadow-sm">
                        <TabsTrigger
                          value="preview"
                          className="data-[state=active]:bg-white data-[state=active]:text-neutral-900 data-[state=active]:shadow-sm text-neutral-600 px-4 py-1.5 text-sm font-medium transition-all"
                        >
                          Preview
                        </TabsTrigger>
                        <TabsTrigger
                          value="code"
                          className="data-[state=active]:bg-white data-[state=active]:text-neutral-900 data-[state=active]:shadow-sm text-neutral-600 px-4 py-1.5 text-sm font-medium transition-all"
                        >
                          Code
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                    <HeaderActions user={user} projectId={project?.id} />
                  </div>

                  <div className="flex-1 overflow-hidden bg-neutral-50">
                    {activeView === "preview" ? (
                      <div className="h-full bg-white">
                        <PreviewFrame />
                      </div>
                    ) : (
                      <ResizablePanelGroup id="code-editor" direction="horizontal" className="h-full">
                        <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
                          <div className="h-full bg-neutral-50 border-r border-neutral-200">
                            <FileTree />
                          </div>
                        </ResizablePanel>
                        <ResizableHandle className="w-[1px] bg-neutral-200 hover:bg-neutral-300 transition-colors" />
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

        </div>
      </ChatProvider>
    </FileSystemProvider>
  );
}
