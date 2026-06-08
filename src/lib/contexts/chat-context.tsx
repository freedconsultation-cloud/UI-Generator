"use client";

// ChatContext — wires the Vercel AI SDK useChat hook into a React context
// so any component in the tree can access the chat state without prop drilling.
// Also connects chat tool calls to the FileSystem context so VFS mutations
// happen in real time as the model streams its response.

import {
  createContext,
  useContext,
  ReactNode,
  useEffect,
} from "react";
import { useChat as useAIChat } from "@ai-sdk/react";
import { Message } from "ai";
import { useFileSystem } from "./file-system-context";
import { setHasAnonWork } from "@/lib/anon-work-tracker";

interface ChatContextProps {
  projectId?: string;       // Undefined for anonymous sessions
  initialMessages?: Message[]; // Pre-populated from a saved project
}

interface ChatContextType {
  messages: Message[];
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  status: string; // "idle" | "submitted" | "streaming" | "error"
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({
  children,
  projectId,
  initialMessages = [],
}: ChatContextProps & { children: ReactNode }) {
  // Pull the file system helpers needed to apply tool call results
  const { fileSystem, handleToolCall } = useFileSystem();

  // useAIChat manages the message array, streaming state, and form handlers
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    status,
  } = useAIChat({
    api: "/api/chat",
    initialMessages,
    // Send the current VFS state and optional projectId with every request
    // so the server can reconstruct the file system and persist changes
    body: {
      files: fileSystem.serialize(),
      projectId,
    },
    // Forward each tool call to the FileSystem context so the VFS is mutated live
    // while the model is still streaming (not just after it finishes)
    onToolCall: ({ toolCall }) => {
      handleToolCall(toolCall);
    },
  });

  // Track anonymous work in sessionStorage so it can be migrated on sign-in.
  // Only runs when there is no projectId (i.e. the user is anonymous).
  useEffect(() => {
    if (!projectId && messages.length > 0) {
      setHasAnonWork(messages, fileSystem.serialize());
    }
  }, [messages, fileSystem, projectId]);

  return (
    <ChatContext.Provider
      value={{
        messages,
        input,
        handleInputChange,
        handleSubmit,
        status,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

// Convenience hook — throws if used outside of ChatProvider
export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
