"use client";

// MarkdownRenderer — renders assistant message text as formatted markdown.
// Uses react-markdown with a custom code component to style inline code
// differently from fenced code blocks.

import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({
  content,
  className,
}: MarkdownRendererProps) {
  return (
    // Apply Tailwind Typography prose styles; max-w-none prevents prose from
    // imposing a max-width that would conflict with the chat bubble layout
    <div className={cn("prose leading-tight max-w-none", className)}>
      <ReactMarkdown
        components={{
          // Override the default <code> renderer to distinguish inline code from blocks
          code: ({ children, className, ...props }) => {
            // react-markdown adds a "language-*" class to fenced code blocks;
            // absence of that class means this is inline code
            const match = /language-(\w+)/.exec(className || "");
            const isInline = !match;

            if (isInline) {
              // Inline code: small pill style with a light gray background
              return (
                <code
                  className="not-prose text-sm px-1 py-0.5 rounded-sm bg-neutral-100 text-neutral-900 font-mono"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            // Fenced code block: pass through with the language class intact
            // so syntax highlighters (if added later) can target it
            return (
              <code className={cn("", className)} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
