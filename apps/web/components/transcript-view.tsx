"use client";

import { useState } from "react";
import { Brain, ChevronRight, ImageOff, Terminal, TriangleAlert } from "lucide-react";
import type { TranscriptBlock } from "@agentprint/contracts";

export type TranscriptTurnView = {
  index: number;
  role: string;
  occurred_at: string | Date | null;
  model_id: string | null;
  blocks: TranscriptBlock[];
};

const omissionCopy: Record<string, string> = {
  image: "Image omitted",
  attachment: "Attachment omitted",
  excluded: "Turn excluded by the author",
  oversize: "Content omitted for size",
  redaction_level: "Hidden by the author's redaction level"
};

/*
 * A typical session is a few user prompts and several hundred tool calls, so
 * everything except the conversation itself starts collapsed. The reader
 * should see the shape of the work first and be able to open any step.
 */
function Collapsible({
  label,
  detail,
  tone = "tool",
  children
}: {
  label: string;
  detail?: string;
  tone?: "tool" | "thinking" | "error";
  children: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`transcript-step transcript-step-${tone}`} data-open={open}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}>
        <ChevronRight size={14} className="transcript-caret" aria-hidden="true" />
        {tone === "thinking" ? <Brain size={14} aria-hidden="true" /> : null}
        {tone === "tool" ? <Terminal size={14} aria-hidden="true" /> : null}
        {tone === "error" ? <TriangleAlert size={14} aria-hidden="true" /> : null}
        <b>{label}</b>
        {detail ? <span>{detail}</span> : null}
      </button>
      {open ? <pre>{children}</pre> : null}
    </div>
  );
}

// A one-line gist of what a tool call actually did, so a collapsed step still
// tells the reader something.
function toolDetail(input: string) {
  if (!input) return undefined;
  let value: unknown = input;
  try {
    value = JSON.parse(input);
  } catch {
    return input.split("\n")[0].slice(0, 90);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["command", "file_path", "path", "pattern", "query", "url", "description"]) {
      const candidate = record[key];
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.replace(/\s+/g, " ").slice(0, 90);
      }
    }
  }
  return undefined;
}

function Block({ block }: { block: TranscriptBlock }) {
  switch (block.kind) {
    case "text":
      return <p className="transcript-text">{block.text}</p>;
    case "thinking":
      return <Collapsible label="Thinking" tone="thinking">{block.text}</Collapsible>;
    case "tool_use":
      return (
        <Collapsible label={block.name} detail={toolDetail(block.input)}>
          {block.input || "(no arguments)"}
        </Collapsible>
      );
    case "tool_result":
      return (
        <Collapsible
          label={block.ok ? "Result" : "Result failed"}
          tone={block.ok ? "tool" : "error"}
          detail={block.truncated ? "truncated" : undefined}
        >
          {block.output || "(no output)"}
        </Collapsible>
      );
    case "omitted":
      return (
        <p className="transcript-omitted">
          <ImageOff size={13} aria-hidden="true" />
          {omissionCopy[block.reason] ?? "Content omitted"}
        </p>
      );
  }
}

/*
 * Harnesses attribute tool results to the user role, because that is who the
 * model receives them from. Presenting them as prompts would be misleading —
 * the person did not type them — so a turn made only of tool output is shown
 * as machine output instead.
 */
function displayRole(turn: TranscriptTurnView) {
  if (
    turn.role === "user" &&
    turn.blocks.length > 0 &&
    turn.blocks.every((block) => block.kind === "tool_result" || block.kind === "omitted")
  ) {
    return { key: "tool", label: "Tool result" };
  }
  if (turn.role === "user") return { key: "user", label: "Prompt" };
  if (turn.role === "assistant") return { key: "assistant", label: "Agent" };
  return { key: "system", label: "System" };
}

export function TranscriptView({ turns }: { turns: TranscriptTurnView[] }) {
  return (
    <div className="transcript">
      {turns.map((turn) => {
        const role = displayRole(turn);
        return (
        <article
          key={turn.index}
          className={`transcript-turn transcript-turn-${role.key}`}
          id={`turn-${turn.index}`}
        >
          <div className="transcript-role">
            <span>{role.label}</span>
            {turn.occurred_at ? (
              <time dateTime={new Date(turn.occurred_at).toISOString()}>
                {new Date(turn.occurred_at).toLocaleTimeString("en", {
                  hour: "2-digit",
                  minute: "2-digit"
                })}
              </time>
            ) : null}
          </div>
          <div className="transcript-blocks">
            {turn.blocks.map((block, position) => (
              <Block key={position} block={block} />
            ))}
          </div>
        </article>
        );
      })}
    </div>
  );
}
