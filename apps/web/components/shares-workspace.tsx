"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Copy, ExternalLink, Trash2 } from "lucide-react";
import type { ShareSummary } from "@agentprint/database";
import type { ShareVisibility } from "@agentprint/contracts";
import { buttonClass, cx } from "@/lib/ui";

const MONO = "font-[ui-monospace,SFMono-Regular,Menlo,monospace]";

const harnessLabels: Record<string, string> = {
  codex: "Codex",
  "claude-code": "Claude Code",
  opencode: "OpenCode",
  "kimi-code": "Kimi Code",
  synthetic: "Synthetic"
};

const emptyStateCommands = ["agentprint sessions", "agentprint share --dry-run"];

const visibilityCopy: Record<ShareVisibility, string> = {
  unlisted: "Anyone with the link. Never indexed or listed on your profile.",
  public: "Listed on your public profile and indexable by search engines.",
  friends: "Only people you are connected to on Agentprint can open it."
};

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
          The dry run renders the exact payload locally so you can read it before anything
          is uploaded.
        </p>
      </section>
    );
  }

  return (
    <div>
      {error ? (
        <p className="mb-4 rounded-sm border border-red px-4 py-3 text-xs text-red" role="alert">{error}</p>
      ) : null}
      {shares.map((share) => (
        <article className="rounded-md border border-line bg-panel p-7 not-first:mt-3.5 max-tablet:p-[22px]" key={share.id}>
          <div className="flex items-start justify-between gap-6 max-compact:flex-col max-compact:gap-4">
            <div>
              <span className="text-xs text-faint">
                {harnessLabels[share.harness_id] ?? share.harness_id}
              </span>
              <h2 className="mt-[5px] text-md font-[weight:560]">
                <Link className="text-ink-strong hover:text-accent" href={`/s/${share.slug}`}>{share.title}</Link>
              </h2>
              <p className="mt-1.5 text-xs text-muted">
                {share.turn_count} turns · {share.view_count} views ·{" "}
                published {new Date(share.published_at).toLocaleDateString("en", {
                  day: "numeric",
                  month: "short",
                  year: "numeric"
                })}
                {share.expires_at
                  ? ` · expires ${new Date(share.expires_at).toLocaleDateString("en", {
                      day: "numeric",
                      month: "short"
                    })}`
                  : ""}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                className={buttonClass({ variant: "secondary", size: "small" })}
                onClick={() => copyLink(share)}
              >
                {copied === share.id ? <Check size={14} /> : <Copy size={14} />}
                {copied === share.id ? "Copied" : "Copy link"}
              </button>
              <Link className={buttonClass({ variant: "secondary", size: "small" })} href={`/s/${share.slug}`}>
                Open <ExternalLink size={13} />
              </Link>
            </div>
          </div>

          <div className="mt-5 border-t border-line pt-4">
            <div
              className="inline-flex rounded-full border border-line-strong bg-canvas-deep p-[3px]"
              role="group"
              aria-label="Who can see this session"
            >
              {(["unlisted", "friends", "public"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  className="cursor-pointer rounded-full border-0 bg-none px-[15px] py-1.5 text-xs text-muted disabled:cursor-wait disabled:opacity-50 data-[active=true]:bg-panel-raised data-[active=true]:text-ink-strong data-[active=true]:shadow-[0_1px_2px_rgb(0_0_0_/_0.06)]"
                  data-active={share.visibility === option}
                  disabled={busy === share.id}
                  onClick={() => changeVisibility(share.id, option)}
                >
                  {option === "unlisted" ? "Unlisted" : option === "friends" ? "Friends" : "Public"}
                </button>
              ))}
            </div>
            <p className="mt-2.5 text-xs text-muted">{visibilityCopy[share.visibility]}</p>
          </div>

          {confirming === share.id ? (
            <div className="mt-4 rounded-sm border border-red bg-[color-mix(in_srgb,var(--color-red)_5%,var(--color-panel))] px-4 py-3.5">
              <p className="mb-3 text-xs text-ink">
                Deleting removes the transcript from Agentprint and the link stops working.
                This cannot be undone.
              </p>
              <div className="flex gap-2">
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
                  Keep it
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="mt-4 inline-flex cursor-pointer items-center gap-1.5 border-0 bg-none p-0 text-xs text-faint hover:text-red"
              onClick={() => setConfirming(share.id)}
            >
              <Trash2 size={13} /> Delete this session
            </button>
          )}
        </article>
      ))}
    </div>
  );
}
