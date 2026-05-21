"use client";

import { Loader2 } from "lucide-react";

interface ToolInvocationPart {
  toolCallId: string;
  toolName: string;
  args: unknown;
  state: "partial-call" | "call" | "result";
  result?: unknown;
}

interface ToolInvocationProps {
  toolInvocation: ToolInvocationPart;
}

function basename(path: string): string {
  const segments = path.split("/").filter(Boolean);
  return segments.length > 0 ? segments[segments.length - 1] : path;
}

export function getToolInvocationLabel(
  toolName: string,
  args: unknown,
  isDone: boolean
): string {
  if (!args || typeof args !== "object") {
    return toolName;
  }

  const a = args as Record<string, unknown>;
  const command = typeof a.command === "string" ? a.command : undefined;
  const path = typeof a.path === "string" ? a.path : undefined;
  const newPath = typeof a.new_path === "string" ? a.new_path : undefined;

  if (toolName === "str_replace_editor" && command && path) {
    const file = basename(path);
    switch (command) {
      case "create":
        return isDone ? `Created ${file}` : `Creating ${file}`;
      case "str_replace":
      case "insert":
        return isDone ? `Edited ${file}` : `Editing ${file}`;
      case "view":
        return isDone ? `Read ${file}` : `Reading ${file}`;
      case "undo_edit":
        return isDone ? `Reverted ${file}` : `Reverting ${file}`;
    }
  }

  if (toolName === "file_manager" && command && path) {
    const file = basename(path);
    if (command === "rename") {
      const target = newPath ? basename(newPath) : null;
      const arrow = target ? ` → ${target}` : "";
      return isDone ? `Renamed ${file}${arrow}` : `Renaming ${file}${arrow}`;
    }
    if (command === "delete") {
      return isDone ? `Deleted ${file}` : `Deleting ${file}`;
    }
  }

  return toolName;
}

export function ToolInvocation({ toolInvocation }: ToolInvocationProps) {
  const isDone =
    toolInvocation.state === "result" && toolInvocation.result !== undefined;
  const label = getToolInvocationLabel(
    toolInvocation.toolName,
    toolInvocation.args,
    isDone
  );

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs font-mono border border-neutral-200">
      {isDone ? (
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
      ) : (
        <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
      )}
      <span className="text-neutral-700">{label}</span>
    </div>
  );
}
