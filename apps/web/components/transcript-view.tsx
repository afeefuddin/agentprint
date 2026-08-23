import {
  Brain,
  Check,
  ChevronDown,
  ImageOff,
  Sparkles,
  Terminal,
  TriangleAlert
} from "lucide-react";
import type { TranscriptBlock } from "@agentprint/contracts";
import { cx } from "@/lib/ui";

export type TranscriptTurnView = {
  index: number;
  role: string;
  occurred_at: string | Date | null;
  model_id: string | null;
  blocks: TranscriptBlock[];
};

type ToolUseBlock = Extract<TranscriptBlock, { kind: "tool_use" }>;
type ToolResultBlock = Extract<TranscriptBlock, { kind: "tool_result" }>;
type ThinkingBlock = Extract<TranscriptBlock, { kind: "thinking" }>;

const omissionCopy: Record<string, string> = {
  image: "Image omitted",
  attachment: "Attachment omitted",
  excluded: "Turn excluded by the author",
  oversize: "Content omitted for size",
  redaction_level: "Hidden by the author's redaction level"
};

function timeLabel(value: string | Date | null) {
  if (!value) return null;
  return new Date(value).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" });
}

function toolDetail(input: string) {
  if (!input) return undefined;
  let value: unknown = input;
  try {
    value = JSON.parse(input);
  } catch {
    return input.split("\n")[0].slice(0, 110);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["command", "file_path", "path", "pattern", "query", "url", "description"]) {
      const candidate = record[key];
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.replace(/\s+/g, " ").slice(0, 110);
      }
    }
  }
  return undefined;
}

function ToolStep({ use, result }: { use: ToolUseBlock; result?: ToolResultBlock }) {
  const detail = toolDetail(use.input);
  return (
    <details className="group/step w-full max-w-full">
      <summary className="inline-flex min-h-7 max-w-full cursor-pointer list-none items-center gap-1.5 rounded-full border border-line bg-canvas-deep/70 px-2.5 py-1 text-left text-[11px] leading-4 text-faint transition-colors hover:border-line-strong hover:text-muted [&::-webkit-details-marker]:hidden">
        <Terminal size={11} className="shrink-0" aria-hidden="true" />
        <span className="shrink-0">Used</span>
        <b className="shrink-0 font-semibold text-muted">{use.name}</b>
        {detail ? <span className="truncate text-faint">· {detail}</span> : null}
        {result ? (
          <span className={cx("ml-0.5 inline-flex shrink-0 items-center", result.ok ? "text-faint" : "text-red")} aria-label={result.ok ? "Succeeded" : "Failed"}>
            {result.ok ? <Check size={10} /> : <TriangleAlert size={10} />}
          </span>
        ) : null}
        <ChevronDown size={10} className="shrink-0 transition-transform duration-150 group-open/step:rotate-180" aria-hidden="true" />
      </summary>
      <div className="mt-1.5 grid gap-2 rounded-xs border border-line bg-panel p-2.5">
        <div>
          <span className="mb-1 block text-2xs text-faint">Arguments</span>
          <pre className="m-0 max-h-[340px] overflow-auto whitespace-pre-wrap rounded-xs bg-canvas-deep px-3 py-2.5 font-mono text-2xs leading-[1.55] text-ink [overflow-wrap:anywhere]">
            {use.input || "(no arguments)"}
          </pre>
        </div>
        {result ? (
          <div>
            <span className="mb-1 block text-2xs text-faint">{result.ok ? "Result" : "Error"}{result.truncated ? " · truncated" : ""}</span>
            <pre className={cx(
              "m-0 max-h-[340px] overflow-auto whitespace-pre-wrap rounded-xs px-3 py-2.5 font-mono text-2xs leading-[1.55] [overflow-wrap:anywhere]",
              result.ok ? "bg-canvas-deep text-ink" : "bg-[color-mix(in_srgb,var(--color-red)_5%,var(--color-panel))] text-red"
            )}>
              {result.output || "(no output)"}
            </pre>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function ThinkingStep({ block }: { block: ThinkingBlock }) {
  const preview = block.text.replace(/\s+/g, " ").trim();
  return (
    <details className="group/thought mb-2 overflow-hidden rounded-xs bg-canvas-deep/70">
      <summary className="flex min-h-8 cursor-pointer list-none items-center gap-1.5 px-2.5 py-1.5 text-2xs text-faint transition-colors hover:text-muted [&::-webkit-details-marker]:hidden">
        <Brain size={12} className="shrink-0" aria-hidden="true" />
        <span className="shrink-0 font-semibold text-muted">Reasoning</span>
        <span className="truncate">{preview}</span>
        <ChevronDown size={11} className="ml-auto shrink-0 transition-transform duration-150 group-open/thought:rotate-180" aria-hidden="true" />
      </summary>
      <p className="border-t border-line/70 px-2.5 py-2 whitespace-pre-wrap text-xs leading-[1.6] text-muted [overflow-wrap:anywhere]">{block.text}</p>
    </details>
  );
}

function ToolTrail({
  tools,
  results
}: {
  tools: ToolUseBlock[];
  results: Map<string, ToolResultBlock>;
}) {
  if (tools.length === 0) return null;
  return (
    <div className="mt-2.5 flex flex-col items-start gap-1.5">
      {tools.map((block, index) => (
        <ToolStep use={block} result={block.id ? results.get(block.id) : undefined} key={block.id ?? `${block.name}-${index}`} />
      ))}
    </div>
  );
}

function Omitted({ block }: { block: Extract<TranscriptBlock, { kind: "omitted" }> }) {
  return (
    <p className="mt-2 flex items-center gap-[7px] text-xs text-faint">
      <ImageOff size={13} aria-hidden="true" />
      {omissionCopy[block.reason] ?? "Content omitted"}
    </p>
  );
}

export function TranscriptView({ turns }: { turns: TranscriptTurnView[] }) {
  const results = new Map<string, ToolResultBlock>();
  for (const turn of turns) {
    for (const block of turn.blocks) {
      if (block.kind === "tool_result" && block.tool_use_id) results.set(block.tool_use_id, block);
    }
  }

  const lastAssistantText = [...turns].reverse().find((turn) =>
    turn.role === "assistant" && turn.blocks.some((block) => block.kind === "text" && block.text.trim())
  )?.index;

  return (
    <section className="mt-8 w-full" aria-label="Session transcript">
      <ol className="relative m-0 list-none p-0 before:absolute before:bottom-4 before:left-[14px] before:top-4 before:w-px before:bg-line-strong">
        {turns.map((turn) => {
          const textBlocks = turn.blocks.filter((block): block is Extract<TranscriptBlock, { kind: "text" }> => block.kind === "text");
          const omittedBlocks = turn.blocks.filter((block): block is Extract<TranscriptBlock, { kind: "omitted" }> => block.kind === "omitted");
          const executionBlocks = turn.blocks.filter((block): block is ToolUseBlock | ThinkingBlock => block.kind === "tool_use" || block.kind === "thinking");
          const thinkingBlocks = executionBlocks.filter((block): block is ThinkingBlock => block.kind === "thinking");
          const toolBlocks = executionBlocks.filter((block): block is ToolUseBlock => block.kind === "tool_use");
          const isPrompt = turn.role === "user" && textBlocks.length > 0;
          const isAssistant = turn.role === "assistant" && (textBlocks.length > 0 || executionBlocks.length > 0);
          const isFinal = isAssistant && turn.index === lastAssistantText;

          if (!isPrompt && !isAssistant && turn.role !== "system") return null;

          return (
            <li className={cx(
              "relative min-w-0 pb-2.5 last:pb-0",
              isPrompt ? "z-[1] flex justify-end bg-canvas pl-[42px]" : "grid grid-cols-[30px_minmax(0,1fr)] gap-3"
            )} id={`turn-${turn.index}`} key={turn.index}>
              {!isPrompt ? (
                <span className={cx(
                  "relative z-[1] grid size-[30px] place-items-center rounded-full border",
                  isFinal ? "border-accent bg-accent text-white" : "border-line-strong bg-panel-raised text-muted"
                )}>
                  <Sparkles size={12} aria-hidden="true" />
                </span>
              ) : null}
              <article className={cx(
                "min-w-0 rounded-sm border px-4 py-3",
                isPrompt
                  ? "w-fit max-w-[82%] border-steel-1 bg-accent-soft max-tablet:max-w-[94%]"
                  : isFinal ? "border-steel-2 bg-panel-raised" : "border-line bg-panel"
              )}>
                <header className="mb-1.5 flex items-center gap-2 text-2xs">
                  <b className={cx("font-semibold", isPrompt ? "text-accent-strong" : "text-ink-strong")}>
                    {isPrompt ? "Prompt" : isFinal ? "Final answer" : turn.role === "system" ? "System" : "Agent"}
                  </b>
                  {turn.model_id && !isPrompt ? <span className="text-faint">{turn.model_id}</span> : null}
                  {timeLabel(turn.occurred_at) ? <time className="ml-auto text-faint" dateTime={new Date(turn.occurred_at!).toISOString()}>{timeLabel(turn.occurred_at)}</time> : null}
                </header>

                {thinkingBlocks.map((block, index) => <ThinkingStep block={block} key={`thinking-${index}`} />)}
                {textBlocks.map((block, index) => (
                  <p className={cx(
                    "mb-3 whitespace-pre-wrap text-ink [overflow-wrap:anywhere] last:mb-0",
                    isPrompt ? "text-base leading-[1.55]" : "text-base leading-[1.62] tracking-[-.004em]"
                  )} key={`text-${index}`}>{block.text}</p>
                ))}
                {omittedBlocks.map((block, index) => <Omitted block={block} key={`omitted-${index}`} />)}
                <ToolTrail tools={toolBlocks} results={results} />
              </article>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
