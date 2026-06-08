import { test, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatInterface } from "../ChatInterface";
import { useChat } from "@/lib/contexts/chat-context";

// Mock the dependencies
vi.mock("@/lib/contexts/chat-context", () => ({
  useChat: vi.fn(),
}));

// Mock the ScrollArea component
vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children, className }: any) => (
    <div className={className} data-radix-scroll-area-viewport>
      {children}
    </div>
  ),
}));

// Mock the child components
vi.mock("../MessageList", () => ({
  MessageList: ({ messages, isLoading }: any) => (
    <div data-testid="message-list">
      {messages.length} messages, loading: {isLoading.toString()}
    </div>
  ),
}));

vi.mock("../MessageInput", () => ({
  MessageInput: ({ input, handleInputChange, handleSubmit, isLoading }: any) => (
    <div data-testid="message-input">
      <input
        value={input}
        onChange={handleInputChange}
        data-testid="input"
        disabled={isLoading}
      />
      <button onClick={handleSubmit} disabled={isLoading} data-testid="submit">
        Submit
      </button>
    </div>
  ),
}));

const mockUseChat = {
  messages: [],
  input: "",
  handleInputChange: vi.fn(),
  handleSubmit: vi.fn(),
  status: "idle" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  (useChat as any).mockReturnValue(mockUseChat);
});

afterEach(() => {
  cleanup();
});

test("renders empty state and input when there are no messages", () => {
  // With no messages, the empty state is rendered instead of MessageList
  render(<ChatInterface />);

  expect(screen.getByText("Start a conversation to generate React components")).toBeDefined();
  expect(screen.getByTestId("message-input")).toBeDefined();
  expect(screen.queryByTestId("message-list")).toBeNull();
});

test("renders message list and input when there are messages", () => {
  (useChat as any).mockReturnValue({
    ...mockUseChat,
    messages: [{ id: "1", role: "user", content: "Hello" }],
  });

  render(<ChatInterface />);

  expect(screen.getByTestId("message-list")).toBeDefined();
  expect(screen.getByTestId("message-input")).toBeDefined();
});

test("passes correct props to MessageList", () => {
  const messages = [
    { id: "1", role: "user", content: "Hello" },
    { id: "2", role: "assistant", content: "Hi there!" },
  ];
  
  (useChat as any).mockReturnValue({
    ...mockUseChat,
    messages,
    status: "streaming",
  });

  render(<ChatInterface />);

  const messageList = screen.getByTestId("message-list");
  expect(messageList.textContent).toContain("2 messages");
  expect(messageList.textContent).toContain("loading: true");
});

test("passes correct props to MessageInput", () => {
  (useChat as any).mockReturnValue({
    ...mockUseChat,
    input: "Test input",
    status: "submitted",
  });

  render(<ChatInterface />);

  const input = screen.getByTestId("input");
  expect(input).toHaveProperty("value", "Test input");
  expect(input).toHaveProperty("disabled", true);
});

test("isLoading is true when status is submitted", () => {
  (useChat as any).mockReturnValue({
    ...mockUseChat,
    status: "submitted",
  });

  render(<ChatInterface />);

  const submitButton = screen.getByTestId("submit");
  expect(submitButton).toHaveProperty("disabled", true);
});

test("isLoading is true when status is streaming", () => {
  (useChat as any).mockReturnValue({
    ...mockUseChat,
    status: "streaming",
  });

  render(<ChatInterface />);

  const submitButton = screen.getByTestId("submit");
  expect(submitButton).toHaveProperty("disabled", true);
});

test("isLoading is false when status is idle", () => {
  (useChat as any).mockReturnValue({
    ...mockUseChat,
    status: "idle",
  });

  render(<ChatInterface />);

  const submitButton = screen.getByTestId("submit");
  expect(submitButton).toHaveProperty("disabled", false);
});


test("scrolls when messages change from empty to populated", () => {
  const { rerender } = render(<ChatInterface />);

  // Initially no messages — empty state is shown, no scroll container
  expect(screen.queryByTestId("message-list")).toBeNull();

  // Add messages — this should switch to the ScrollArea + MessageList path
  (useChat as any).mockReturnValue({
    ...mockUseChat,
    messages: [
      { id: "1", role: "user", content: "Hello" },
      { id: "2", role: "assistant", content: "Hi there!" },
    ],
  });

  rerender(<ChatInterface />);

  // Verify the message list now renders with the correct message count
  const messageList = screen.getByTestId("message-list");
  expect(messageList.textContent).toContain("2 messages");
});

test("renders with correct layout classes", () => {
  // Use non-empty messages so the ScrollArea path renders (gives us a .flex-1 to query)
  (useChat as any).mockReturnValue({
    ...mockUseChat,
    messages: [{ id: "1", role: "user", content: "Hello" }],
  });

  const { container } = render(<ChatInterface />);

  const mainDiv = container.firstChild as HTMLElement;
  expect(mainDiv.className).toContain("flex");
  expect(mainDiv.className).toContain("flex-col");
  expect(mainDiv.className).toContain("h-full");
  expect(mainDiv.className).toContain("p-4");
  expect(mainDiv.className).toContain("overflow-hidden");

  const scrollArea = screen.getByTestId("message-list").closest(".flex-1");
  expect(scrollArea?.className).toContain("overflow-hidden");

  const inputWrapper = screen.getByTestId("message-input").parentElement;
  expect(inputWrapper?.className).toContain("mt-4");
  expect(inputWrapper?.className).toContain("flex-shrink-0");
});