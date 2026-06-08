// Tests for ToolCallBadge and its getToolLabel helper.
// Covers every recognised command for both tools, fallback behaviour,
// and the visual states (spinner vs green dot).

import { test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ToolCallBadge, getToolLabel } from "../ToolCallBadge";

afterEach(() => {
  cleanup();
});

// ─────────────────────────────────────────────────────────────
// getToolLabel — unit tests for the label mapping function
// ─────────────────────────────────────────────────────────────

test("getToolLabel: str_replace_editor create returns 'Creating <path>'", () => {
  expect(getToolLabel("str_replace_editor", { command: "create", path: "/App.jsx" }))
    .toBe("Creating /App.jsx");
});

test("getToolLabel: str_replace_editor str_replace returns 'Editing <path>'", () => {
  expect(getToolLabel("str_replace_editor", { command: "str_replace", path: "/components/Button.jsx" }))
    .toBe("Editing /components/Button.jsx");
});

test("getToolLabel: str_replace_editor insert returns 'Editing <path>'", () => {
  expect(getToolLabel("str_replace_editor", { command: "insert", path: "/App.jsx" }))
    .toBe("Editing /App.jsx");
});

test("getToolLabel: str_replace_editor view returns 'Reading <path>'", () => {
  expect(getToolLabel("str_replace_editor", { command: "view", path: "/App.jsx" }))
    .toBe("Reading /App.jsx");
});

test("getToolLabel: str_replace_editor undo_edit returns 'Reverting <path>'", () => {
  expect(getToolLabel("str_replace_editor", { command: "undo_edit", path: "/App.jsx" }))
    .toBe("Reverting /App.jsx");
});

test("getToolLabel: str_replace_editor unknown command with path returns 'Editing <path>'", () => {
  expect(getToolLabel("str_replace_editor", { command: "unknown_cmd", path: "/App.jsx" }))
    .toBe("Editing /App.jsx");
});

test("getToolLabel: str_replace_editor unknown command without path returns 'Editing file'", () => {
  expect(getToolLabel("str_replace_editor", {}))
    .toBe("Editing file");
});

test("getToolLabel: file_manager rename returns 'Renaming <old> → <new>'", () => {
  expect(getToolLabel("file_manager", { command: "rename", path: "/old.jsx", new_path: "/new.jsx" }))
    .toBe("Renaming /old.jsx → /new.jsx");
});

test("getToolLabel: file_manager rename without new_path returns 'Renaming <path>'", () => {
  expect(getToolLabel("file_manager", { command: "rename", path: "/old.jsx" }))
    .toBe("Renaming /old.jsx");
});

test("getToolLabel: file_manager delete returns 'Deleting <path>'", () => {
  expect(getToolLabel("file_manager", { command: "delete", path: "/App.jsx" }))
    .toBe("Deleting /App.jsx");
});

test("getToolLabel: file_manager unknown command with path returns 'Managing <path>'", () => {
  expect(getToolLabel("file_manager", { command: "move", path: "/App.jsx" }))
    .toBe("Managing /App.jsx");
});

test("getToolLabel: file_manager unknown command without path returns 'Managing file'", () => {
  expect(getToolLabel("file_manager", {}))
    .toBe("Managing file");
});

test("getToolLabel: unrecognised tool name returns the tool name itself", () => {
  expect(getToolLabel("some_other_tool", {}))
    .toBe("some_other_tool");
});

// ─────────────────────────────────────────────────────────────
// ToolCallBadge — rendering tests
// ─────────────────────────────────────────────────────────────

test("ToolCallBadge renders human-readable label for str_replace_editor create", () => {
  render(
    <ToolCallBadge
      toolInvocation={{
        toolCallId: "call_1",
        toolName: "str_replace_editor",
        args: { command: "create", path: "/App.jsx" },
        state: "call",
      }}
    />
  );

  // Should show the friendly label, not the raw tool name
  expect(screen.getByText("Creating /App.jsx")).toBeDefined();
  expect(screen.queryByText("str_replace_editor")).toBeNull();
});

test("ToolCallBadge renders human-readable label for str_replace_editor str_replace", () => {
  render(
    <ToolCallBadge
      toolInvocation={{
        toolCallId: "call_2",
        toolName: "str_replace_editor",
        args: { command: "str_replace", path: "/components/Card.jsx" },
        state: "result",
        result: "Replaced 1 occurrence",
      }}
    />
  );

  expect(screen.getByText("Editing /components/Card.jsx")).toBeDefined();
});

test("ToolCallBadge renders human-readable label for file_manager delete", () => {
  render(
    <ToolCallBadge
      toolInvocation={{
        toolCallId: "call_3",
        toolName: "file_manager",
        args: { command: "delete", path: "/old.jsx" },
        state: "call",
      }}
    />
  );

  expect(screen.getByText("Deleting /old.jsx")).toBeDefined();
});

test("ToolCallBadge renders human-readable label for file_manager rename", () => {
  render(
    <ToolCallBadge
      toolInvocation={{
        toolCallId: "call_4",
        toolName: "file_manager",
        args: { command: "rename", path: "/old.jsx", new_path: "/new.jsx" },
        state: "result",
        result: { success: true },
      }}
    />
  );

  expect(screen.getByText("Renaming /old.jsx → /new.jsx")).toBeDefined();
});

test("ToolCallBadge shows spinner when tool is still in flight (state='call')", () => {
  const { container } = render(
    <ToolCallBadge
      toolInvocation={{
        toolCallId: "call_5",
        toolName: "str_replace_editor",
        args: { command: "create", path: "/App.jsx" },
        state: "call",
      }}
    />
  );

  // Lucide Loader2 renders an SVG with the animate-spin class
  const spinner = container.querySelector(".animate-spin");
  expect(spinner).not.toBeNull();

  // Green dot should not be present while in flight
  const greenDot = container.querySelector(".bg-emerald-500");
  expect(greenDot).toBeNull();
});

test("ToolCallBadge shows spinner when state is 'partial-call'", () => {
  const { container } = render(
    <ToolCallBadge
      toolInvocation={{
        toolCallId: "call_6",
        toolName: "str_replace_editor",
        args: { command: "create", path: "/App.jsx" },
        state: "partial-call",
      }}
    />
  );

  const spinner = container.querySelector(".animate-spin");
  expect(spinner).not.toBeNull();
});

test("ToolCallBadge shows green dot when tool has a result (state='result')", () => {
  const { container } = render(
    <ToolCallBadge
      toolInvocation={{
        toolCallId: "call_7",
        toolName: "str_replace_editor",
        args: { command: "create", path: "/App.jsx" },
        state: "result",
        result: "File created: /App.jsx",
      }}
    />
  );

  // Green dot should be visible once the tool has finished
  const greenDot = container.querySelector(".bg-emerald-500");
  expect(greenDot).not.toBeNull();

  // Spinner should be gone
  const spinner = container.querySelector(".animate-spin");
  expect(spinner).toBeNull();
});

test("ToolCallBadge shows spinner when state='result' but result is undefined", () => {
  // A result state without a result value is treated as still-in-flight
  const { container } = render(
    <ToolCallBadge
      toolInvocation={{
        toolCallId: "call_8",
        toolName: "str_replace_editor",
        args: { command: "create", path: "/App.jsx" },
        state: "result",
        result: undefined,
      }}
    />
  );

  const spinner = container.querySelector(".animate-spin");
  expect(spinner).not.toBeNull();
});
