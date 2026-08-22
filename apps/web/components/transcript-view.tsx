import {
  Brain,
  Check,
  ChevronRight,
  CircleUserRound,
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
    <details className="group/step border-b border-line last:border-b-0">
      <summary className="grid min-h-10 cursor-pointer list-none grid-cols-[16px_minmax(0,auto)_minmax(0,1fr)_auto_14px] items-center gap-2 py-2 text-left [&::-webkit-details-marker]:hidden">
        <Terminal size={14} className="text-faint" aria-hidden="true" />
        <b className="text-xs font-[weight:560] text-ink-strong">{use.name}</b>
        <span className="truncate text-xs text-muted">{detail}</span>
        {result ? (
          <span className={cx("inline-flex items-center gap-1 text-2xs", result.ok ? "text-muted" : "text-red")}>
            {result.ok ? <Check size={12} /> : <TriangleAlert size={12} />}
            {result.ok ? "Done" : "Failed"}
          </span>
        ) : null}
        <ChevronRight size={13} className="text-faint transition-transform duration-150 group-open/step:rotate-90" aria-hidden="true" />
      </summary>
      <div className="grid gap-2 pb-3 pl-6">
        <div>
          <span className="mb-1 block text-2xs text-faint">Arguments</span>
          <pre className="m-0 max-h-[340px] overflow-auto whitespace-pre-wrap rounded-xs bg-canvas-deep px-3 py-2.5 font-[ui-monospace,SFMono-Regular,Menlo,monospace] text-2xs leading-[1.55] text-ink [overflow-wrap:anywhere]">
            {use.input || "(no arguments)"}
          </pre>
        </div>
        {result ? (
          <div>
            <span className="mb-1 block text-2xs text-faint">{result.ok ? "Result" : "Error"}{result.truncated ? " · truncated" : ""}</span>
            <pre className={cx(
              "m-0 max-h-[340px] overflow-auto whitespace-pre-wrap rounded-xs px-3 py-2.5 font-[ui-monospace,SFMono-Regular,Menlo,monospace] text-2xs leading-[1.55] [overflow-wrap:anywhere]",
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
  return (
    <details className="group/step border-b border-line last:border-b-0">
      <summary className="grid min-h-10 cursor-pointer list-none grid-cols-[16px_auto_1fr_14px] items-center gap-2 py-2 [&::-webkit-details-marker]:hidden">
        <Brain size={14} className="text-faint" aria-hidden="true" />
        <b className="text-xs font-[weight:560] text-ink-strong">Thinking</b>
        <span className="truncate text-xs text-muted">Hidden until expanded</span>
        <ChevronRight size={13} className="text-faint transition-transform duration-150 group-open/step:rotate-90" aria-hidden="true" />
      </summary>
      <p className="mb-3 ml-6 whitespace-pre-wrap text-xs leading-[1.55] text-muted [overflow-wrap:anywhere]">{block.text}</p>
    </details>
  );
}

function ExecutionTrail({
  blocks,
  results
}: {
  blocks: Array<ToolUseBlock | ThinkingBlock>;
  results: Map<string, ToolResultBlock>;
}) {
  if (blocks.length === 0) return null;
  const toolCount = blocks.filter((block) => block.kind === "tool_use").length;
  return (
    <div className="mt-4 border-t border-line pt-2">
      <p className="flex items-center gap-2 py-1 text-2xs font-[weight:560] text-faint">
        <Terminal size={13} aria-hidden="true" />
        Execution{toolCount ? ` · ${toolCount} ${toolCount === 1 ? "tool call" : "tool calls"}` : ""}
      </p>
      <div className="mt-1">
        {blocks.map((block, index) => block.kind === "thinking" ? (
          <ThinkingStep block={block} key={`thinking-${index}`} />
        ) : (
          <ToolStep use={block} result={block.id ? results.get(block.id) : undefined} key={block.id ?? `${block.name}-${index}`} />
        ))}
      </div>
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
    <section className="mt-10" aria-label="Session transcript">
      <ol className="relative m-0 list-none p-0 before:absolute before:bottom-7 before:left-[17px] before:top-7 before:w-px before:bg-line">
        {turns.map((turn) => {
          const textBlocks = turn.blocks.filter((block): block is Extract<TranscriptBlock, { kind: "text" }> => block.kind === "text");
          const omittedBlocks = turn.blocks.filter((block): block is Extract<TranscriptBlock, { kind: "omitted" }> => block.kind === "omitted");
          const executionBlocks = turn.blocks.filter((block): block is ToolUseBlock | ThinkingBlock => block.kind === "tool_use" || block.kind === "thinking");
          const isPrompt = turn.role === "user" && textBlocks.length > 0;
          const isAssistant = turn.role === "assistant" && (textBlocks.length > 0 || executionBlocks.length > 0);
          const isFinal = isAssistant && turn.index === lastAssistantText;

          if (!isPrompt && !isAssistant && turn.role !== "system") return null;

          return (
            <li className="relative grid grid-cols-[36px_minmax(0,1fr)] gap-4 pb-4 last:pb-0" id={`turn-${turn.index}`} key={turn.index}>
              <span className={cx(
                "relative z-[1] grid size-9 place-items-center rounded-full border bg-panel-raised",
                isPrompt ? "border-steel-2 text-accent" : isFinal ? "border-accent bg-accent text-white" : "border-line-strong text-muted"
              )}>
                {isPrompt ? <CircleUserRound size={16} aria-hidden="true" /> : <Sparkles size={15} aria-hidden="true" />}
              </span>

              <article className={cx(
                "min-w-0 rounded-sm border px-5 py-4 max-tablet:px-4",
                isPrompt ? "border-steel-1 bg-accent-soft" : isFinal ? "border-steel-2 bg-panel-raised" : "border-line bg-panel"
              )}>
                <header className="mb-2.5 flex items-center gap-2 text-xs">
                  <b className={cx("font-[weight:560]", isPrompt ? "text-accent-strong" : "text-ink-strong")}>
                    {isPrompt ? "Prompt" : isFinal ? "Final answer" : turn.role === "system" ? "System" : "Agent"}
                  </b>
                  {turn.model_id && !isPrompt ? <span className="text-faint">{turn.model_id}</span> : null}
                  {timeLabel(turn.occurred_at) ? <time className="ml-auto text-faint" dateTime={new Date(turn.occurred_at!).toISOString()}>{timeLabel(turn.occurred_at)}</time> : null}
                </header>

                {textBlocks.map((block, index) => (
                  <p className="mb-3 whitespace-pre-wrap text-base leading-[1.6] text-ink [overflow-wrap:anywhere] last:mb-0" key={`text-${index}`}>{block.text}</p>
                ))}
                {omittedBlocks.map((block, index) => <Omitted block={block} key={`omitted-${index}`} />)}
                <ExecutionTrail blocks={executionBlocks} results={results} />
              </article>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
