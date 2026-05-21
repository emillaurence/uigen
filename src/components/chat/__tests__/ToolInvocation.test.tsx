import { test, expect, describe, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import {
  ToolInvocation,
  getToolInvocationLabel,
} from "../ToolInvocation";

afterEach(() => {
  cleanup();
});

describe("getToolInvocationLabel", () => {
  test("str_replace_editor create → Creating/Created with basename", () => {
    const args = { command: "create", path: "/components/Card.jsx" };
    expect(getToolInvocationLabel("str_replace_editor", args, false)).toBe(
      "Creating Card.jsx"
    );
    expect(getToolInvocationLabel("str_replace_editor", args, true)).toBe(
      "Created Card.jsx"
    );
  });

  test("str_replace_editor str_replace → Editing/Edited", () => {
    const args = { command: "str_replace", path: "/App.jsx" };
    expect(getToolInvocationLabel("str_replace_editor", args, false)).toBe(
      "Editing App.jsx"
    );
    expect(getToolInvocationLabel("str_replace_editor", args, true)).toBe(
      "Edited App.jsx"
    );
  });

  test("str_replace_editor insert is also Editing", () => {
    const args = { command: "insert", path: "/App.jsx" };
    expect(getToolInvocationLabel("str_replace_editor", args, false)).toBe(
      "Editing App.jsx"
    );
    expect(getToolInvocationLabel("str_replace_editor", args, true)).toBe(
      "Edited App.jsx"
    );
  });

  test("str_replace_editor view → Reading/Read", () => {
    const args = { command: "view", path: "/components/Button.jsx" };
    expect(getToolInvocationLabel("str_replace_editor", args, false)).toBe(
      "Reading Button.jsx"
    );
    expect(getToolInvocationLabel("str_replace_editor", args, true)).toBe(
      "Read Button.jsx"
    );
  });

  test("str_replace_editor undo_edit → Reverting/Reverted", () => {
    const args = { command: "undo_edit", path: "/App.jsx" };
    expect(getToolInvocationLabel("str_replace_editor", args, false)).toBe(
      "Reverting App.jsx"
    );
    expect(getToolInvocationLabel("str_replace_editor", args, true)).toBe(
      "Reverted App.jsx"
    );
  });

  test("file_manager rename includes both file names", () => {
    const args = {
      command: "rename",
      path: "/components/Old.jsx",
      new_path: "/components/New.jsx",
    };
    expect(getToolInvocationLabel("file_manager", args, false)).toBe(
      "Renaming Old.jsx → New.jsx"
    );
    expect(getToolInvocationLabel("file_manager", args, true)).toBe(
      "Renamed Old.jsx → New.jsx"
    );
  });

  test("file_manager rename without new_path drops the arrow", () => {
    const args = { command: "rename", path: "/components/Old.jsx" };
    expect(getToolInvocationLabel("file_manager", args, false)).toBe(
      "Renaming Old.jsx"
    );
  });

  test("file_manager delete → Deleting/Deleted", () => {
    const args = { command: "delete", path: "/components/Card.jsx" };
    expect(getToolInvocationLabel("file_manager", args, false)).toBe(
      "Deleting Card.jsx"
    );
    expect(getToolInvocationLabel("file_manager", args, true)).toBe(
      "Deleted Card.jsx"
    );
  });

  test("strips leading directories so only the file name shows", () => {
    const args = {
      command: "create",
      path: "/deeply/nested/path/to/Widget.tsx",
    };
    expect(getToolInvocationLabel("str_replace_editor", args, true)).toBe(
      "Created Widget.tsx"
    );
  });

  test("falls back to tool name when args are missing", () => {
    expect(getToolInvocationLabel("str_replace_editor", undefined, false)).toBe(
      "str_replace_editor"
    );
    expect(getToolInvocationLabel("str_replace_editor", {}, false)).toBe(
      "str_replace_editor"
    );
    expect(getToolInvocationLabel("str_replace_editor", null, false)).toBe(
      "str_replace_editor"
    );
  });

  test("falls back to tool name when command is unknown", () => {
    const args = { command: "warp_drive", path: "/App.jsx" };
    expect(getToolInvocationLabel("str_replace_editor", args, false)).toBe(
      "str_replace_editor"
    );
  });

  test("falls back to tool name when path is missing", () => {
    const args = { command: "create" };
    expect(getToolInvocationLabel("str_replace_editor", args, false)).toBe(
      "str_replace_editor"
    );
  });

  test("falls back to tool name for unknown tools", () => {
    expect(
      getToolInvocationLabel("mystery_tool", { command: "create", path: "/x" }, true)
    ).toBe("mystery_tool");
  });
});

describe("ToolInvocation component", () => {
  test("renders the friendly label", () => {
    render(
      <ToolInvocation
        toolInvocation={{
          toolCallId: "1",
          toolName: "str_replace_editor",
          args: { command: "create", path: "/components/Card.jsx" },
          state: "result",
          result: "File created: /components/Card.jsx",
        }}
      />
    );

    expect(screen.getByText("Created Card.jsx")).toBeDefined();
  });

  test("renders the present-continuous label while in progress", () => {
    render(
      <ToolInvocation
        toolInvocation={{
          toolCallId: "1",
          toolName: "str_replace_editor",
          args: { command: "create", path: "/components/Card.jsx" },
          state: "call",
        }}
      />
    );

    expect(screen.getByText("Creating Card.jsx")).toBeDefined();
  });

  test("shows a spinner while in progress and a green dot when done", () => {
    const { container: inProgress } = render(
      <ToolInvocation
        toolInvocation={{
          toolCallId: "1",
          toolName: "str_replace_editor",
          args: { command: "create", path: "/App.jsx" },
          state: "call",
        }}
      />
    );
    expect(inProgress.querySelector(".animate-spin")).not.toBeNull();
    expect(inProgress.querySelector(".bg-emerald-500")).toBeNull();

    cleanup();

    const { container: done } = render(
      <ToolInvocation
        toolInvocation={{
          toolCallId: "1",
          toolName: "str_replace_editor",
          args: { command: "create", path: "/App.jsx" },
          state: "result",
          result: "ok",
        }}
      />
    );
    expect(done.querySelector(".bg-emerald-500")).not.toBeNull();
    expect(done.querySelector(".animate-spin")).toBeNull();
  });

  test("falls back to tool name when args don't match a known shape", () => {
    render(
      <ToolInvocation
        toolInvocation={{
          toolCallId: "1",
          toolName: "str_replace_editor",
          args: {},
          state: "result",
          result: "Success",
        }}
      />
    );

    expect(screen.getByText("str_replace_editor")).toBeDefined();
  });
});
