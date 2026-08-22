"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Copy,
  EyeOff,
  Globe2,
  Trash2,
  Users
} from "lucide-react";
import { formatTokens } from "@agentprint/analytics";
import type { ShareSummary } from "@agentprint/database";
import type { ShareVisibility } from "@agentprint/contracts";
import { harnessBrand, harnessLabels } from "@/lib/brands";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { buttonClass, cx, iconButtonDangerClass, quietActionClass } from "@/lib/ui";

const MONO = "font-[ui-monospace,SFMono-Regular,Menlo,monospace]";
const emptyStateCommands = ["agentprint sessions", "agentprint share --dry-run"];

const visibilityMeta: Record<ShareVisibility, { label: string; description: string }> = {
  unlisted: { label: "Unlisted", description: "Anyone with the link can open it." },
  public: { label: "Public", description: "Visible on your profile and in search." },
  friends: { label: "Friends", description: "Only your Agentprint friends can open it." }
};

function VisibilityIcon({ visibility, size = 13 }: { visibility: ShareVisibility; size?: number }) {
  if (visibility === "public") return <Globe2 size={size} aria-hidden="true" />;
  if (visibility === "friends") return <Users size={size} aria-hidden="true" />;
  return <EyeOff size={size} aria-hidden="true" />;
}

function duration(from: Date | string, to: Date | string) {
  const minutes = Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hr`;
  return `${Math.round(hours / 24)} days`;
}

function publishedAt(value: Date | string) {
  return new Date(value).toLocaleDateString("en", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

export function SharesWorkspace({
  initialShares,
  baseUrl
}: {
  initialShares: ShareSummary[];
  baseUrl: string;
}) {
  const [shares, setShares] = useState(initialShares);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  async function changeVisibility(id: string, visibility: ShareVisibility) {
    setBusy(id);
    setError(null);
    const response = await fetch(`/v1/me/shares/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibility })
    });
    if (response.ok) {
      setShares((current) =>
        current.map((share) => (share.id === id ? { ...share, visibility } : share))
      );
    } else {
      setError("That change could not be saved. Please try again.");
    }
    setBusy(null);
  }

  async function revoke(id: string) {
    setBusy(id);
    setError(null);
    const response = await fetch(`/v1/me/shares/${id}`, { method: "DELETE" });
    if (response.ok) {
      setShares((current) => current.filter((share) => share.id !== id));
    } else {
      setError("That session could not be deleted. Please try again.");
    }
    setConfirming(null);
    setBusy(null);
  }

  async function copyLink(share: ShareSummary) {
    await navigator.clipboard.writeText(`${baseUrl}/s/${share.slug}`);
    setCopied(share.id);
    setTimeout(() => setCopied(null), 1500);
  }

  async function copyCommand(command: string) {
    await navigator.clipboard.writeText(command);
    setCopiedCommand(command);
    setTimeout(() => setCopiedCommand((value) => (value === command ? null : value)), 1500);
  }

  if (shares.length === 0) {
    return (
      <section className="rounded-md border border-line bg-panel p-7 text-center max-tablet:p-[22px]">
        <h2 className="m-0 text-lg font-[weight:560] text-ink-strong">No shared sessions yet</h2>
        <p className="mx-auto mt-2.5 max-w-[460px] text-sm text-muted">
          Sharing publishes one session at a time, and only when you ask for it. Your
          background sync never uploads transcript content.
        </p>
        <div className="mt-[22px] inline-block overflow-hidden rounded-sm border border-line bg-canvas-deep text-left">
          {emptyStateCommands.map((command) => (
            <div
              className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-[18px] py-[5px] pl-4 pr-1.5 not-first:border-t not-first:border-line"
              data-copied={copiedCommand === command || undefined}
              key={command}
            >
              <code className={cx(MONO, "overflow-x-auto whitespace-pre text-xs leading-[1.7] text-ink-strong")}>{command}</code>
              <button
                type="button"
                className="grid size-8 cursor-pointer place-items-center rounded-xs border border-transparent bg-transparent p-0 text-faint transition-[background-color,border-color,color] duration-150 hover:border-line-strong hover:bg-panel hover:text-ink-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent group-data-[copied]:text-accent"
                onClick={() => copyCommand(command)}
                aria-label={copiedCommand === command ? "Copied" : `Copy ${command}`}
              >
                {copiedCommand === command ? <Check size={15} /> : <Copy size={15} />}
              </button>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-2.5 max-w-[460px] text-xs text-faint">
          The dry run renders the exact payload locally so you can read it before anything is uploaded.
        </p>
      </section>
    );
  }

  return (
    <div className="grid gap-2.5">
      {error ? (
        <p className="rounded-sm border border-red px-4 py-3 text-xs text-red" role="alert">{error}</p>
      ) : null}
      {shares.map((share) => {
        const brand = harnessBrand(share.harness_id);
        const visibility = visibilityMeta[share.visibility];
        return (
          <article
            className="group relative grid grid-cols-[minmax(0,1fr)_auto] gap-x-8 gap-y-4 rounded-sm bg-panel px-6 py-5 transition-colors duration-150 hover:bg-panel-raised max-tablet:grid-cols-1 max-tablet:px-5"
            key={share.id}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5 text-xs text-faint">
                <span className="inline-flex items-center gap-[7px] font-[weight:560] text-ink-strong">
                  <i className="size-2 rounded-full" style={{ background: brand.color }} aria-hidden="true" />
                  {harnessLabels[share.harness_id] ?? brand.label}
                </span>
                <span className="text-line-strong" aria-hidden="true">/</span>
                <span className="inline-flex items-center gap-[5px]">
                  <VisibilityIcon visibility={share.visibility} /> {visibility.label}
                </span>
                <span className="text-line-strong" aria-hidden="true">·</span>
                <span>Published {publishedAt(share.published_at)}</span>
              </div>

              <h2 className="mt-2.5 max-w-[820px] text-[22px] font-[weight:570] leading-[1.25] tracking-[-.02em] text-ink-strong max-tablet:text-lg">
                <Link className="inline-flex items-start gap-2 hover:text-accent" href={`/s/${share.slug}`}>
                  {share.title}<ArrowUpRight className="mt-1 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" size={16} aria-hidden="true" />
                </Link>
              </h2>
              {share.summary ? (
                <p className="mt-2 max-w-[820px] text-sm leading-[1.55] text-muted">{share.summary}</p>
              ) : null}
              <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted [font-variant-numeric:tabular-nums]">
                <span><b className="font-[weight:560] text-ink-strong">{share.turn_count}</b> turns</span>
                <span className="text-line-strong" aria-hidden="true">·</span>
                <span><b className="font-[weight:560] text-ink-strong">{formatTokens(Number(share.total_tokens))}</b> tokens</span>
                <span className="text-line-strong" aria-hidden="true">·</span>
                <span><b className="font-[weight:560] text-ink-strong">{duration(share.started_at, share.ended_at)}</b></span>
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end justify-between gap-4 self-stretch max-tablet:w-full">
              <div className="flex items-center gap-1">
                <button type="button" className={quietActionClass} onClick={() => copyLink(share)}>
                  {copied === share.id ? <Check size={14} /> : <Copy size={14} />}
                  {copied === share.id ? "Copied" : "Copy link"}
                </button>

                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className={cx(quietActionClass, "group/sharing")}>
                      <VisibilityIcon visibility={share.visibility} /> Sharing
                      <ChevronDown size={13} className="transition-transform group-data-[state=open]/sharing:rotate-180" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    sideOffset={8}
                    className="w-[320px] rounded-sm border-line-strong bg-panel-raised p-2.5 text-ink shadow-[0_12px_32px_rgb(23_25_20_/_0.12)]"
                  >
                    <DropdownMenuLabel className="px-2 pb-2 pt-1 text-xs font-[weight:560] text-ink-strong">
                      Who can open this session?
                    </DropdownMenuLabel>
                    {(["unlisted", "friends", "public"] as const).map((option) => (
                      <DropdownMenuItem
                        key={option}
                        className="grid cursor-pointer grid-cols-[32px_1fr_auto] items-center gap-2.5 rounded-xs px-2 py-2.5 text-left focus:bg-canvas-deep focus:text-ink"
                        disabled={busy === share.id}
                        onSelect={() => changeVisibility(share.id, option)}
                      >
                        <span className="grid size-8 place-items-center rounded-xs border border-line bg-canvas text-muted">
                          <VisibilityIcon visibility={option} size={14} />
                        </span>
                        <span className="min-w-0">
                          <b className="block text-xs font-[weight:560] text-ink-strong">{visibilityMeta[option].label}</b>
                          <span className="mt-0.5 block text-2xs text-muted">{visibilityMeta[option].description}</span>
                        </span>
                        {share.visibility === option ? <Check size={14} className="text-accent" aria-label="Selected" /> : null}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className={iconButtonDangerClass}
                  onClick={() => setConfirming(share.id)}
                  aria-label={`Delete ${share.title}`}
                >
                  <Trash2 size={14} />
                </button>
                <Link className={buttonClass({ variant: "primary", size: "small", className: "ml-1" })} href={`/s/${share.slug}`}>
                  Open <ArrowUpRight size={14} />
                </Link>
              </div>
            </div>

            {confirming === share.id ? (
              <div className="col-span-full rounded-xs bg-[color-mix(in_srgb,var(--color-red)_6%,var(--color-panel))] px-4 py-3.5 max-tablet:col-span-1">
                <p className="text-xs text-ink">Delete this transcript permanently? The shared link will stop working.</p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    className={buttonClass({ variant: "danger", size: "small" })}
                    disabled={busy === share.id}
                    onClick={() => revoke(share.id)}
                  >
                    Delete permanently
                  </button>
                  <button
                    type="button"
                    className={buttonClass({ variant: "secondary", size: "small" })}
                    onClick={() => setConfirming(null)}
                  >
                    Keep session
                  </button>
                </div>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
