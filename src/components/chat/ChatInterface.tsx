"use client";

// ChatInterface — the top-level chat UI component.
// Composes MessageList (history) + MessageInput (new message form)
// inside a scrollable area that auto-scrolls to the latest message.

import { useEffect, useRef } from "react";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChat } from "@/lib/contexts/chat-context";
import { Bot } from "lucide-react";

export function ChatInterface() {
  // Ref on the Radix ScrollArea wrapper so we can imperatively scroll it
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Pull chat state and handlers from the context provided by ChatProvider
  const { messages, input, handleInputChange, handleSubmit, status } = useChat();

  // Scroll to the bottom of the message list whenever a new message arrives.
  // Radix ScrollArea renders a nested viewport div — we find it by data attribute.
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]); // Re-run every time the messages array changes

  return (
    <div className="flex flex-col h-full p-4 overflow-hidden">
      {/* When there are no messages, render the empty state directly in the flex container
          so justify-center has a real height to work against (ScrollArea doesn't propagate height) */}
      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50 mb-4 shadow-sm">
            <Bot className="h-7 w-7 text-blue-600" />
          </div>
          <p className="text-neutral-900 font-semibold text-lg mb-2">Start a conversation to generate React components</p>
          <p className="text-neutral-500 text-sm max-w-sm">I can help you create buttons, forms, cards, and more</p>
        </div>
      ) : (
        /* Scrollable message history — takes all available vertical space */
        <ScrollArea ref={scrollAreaRef} className="flex-1 overflow-hidden">
          <div className="pr-4">
            {/* Pass isLoading so MessageList can show a spinner on the last AI message */}
            <MessageList messages={messages} isLoading={status === "streaming"} />
          </div>
        </ScrollArea>
      )}

      {/* Fixed-height input area at the bottom — does not scroll with messages */}
      <div className="mt-4 flex-shrink-0">
        <MessageInput
          input={input}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
          // Disable input while a request is in-flight (submitted or actively streaming)
          isLoading={status === "submitted" || status === "streaming"}
        />
      </div>
    </div>
  );
}
