"use client";

import Link from "next/link";
import type { FriendshipEntry, FriendshipList } from "@agentprint/database";
import {
  ArrowRight,
  Ban,
  Check,
  Clock3,
  LockKeyhole,
  MoreHorizontal,
  RotateCcw,
  Search,
  UserPlus,
  Users,
  X
} from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import {
  buttonClass,
  cx,
  avatarChipClass,
  iconButtonClass,
  iconButtonDangerClass,
  quietActionClass,
  spinnerClass
} from "@/lib/ui";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";

const SECTION = "mt-10";
const SECTION_HEADING = "mb-3 flex items-end justify-between gap-7";
const SECTION_TITLE = "m-0 block text-base font-semibold text-ink-strong";
const SECTION_SUB = "mt-1 block text-xs leading-[1.5] text-muted";
const SECTION_COUNT = "pb-0.5 text-xs font-medium text-faint";
const CARD = "rounded-md border border-line bg-panel shadow-[0_1px_2px_color-mix(in_srgb,var(--color-ink-strong)_5%,transparent)]";
const ROW =
  `${CARD} grid min-h-[92px] grid-cols-[minmax(220px,1fr)_minmax(175px,.7fr)_auto] items-center gap-[18px] px-5 py-4 transition-[border-color,box-shadow,transform] duration-[160ms] hover:-translate-y-px hover:border-line-strong hover:shadow-[0_8px_22px_color-mix(in_srgb,var(--color-ink-strong)_7%,transparent)] max-desktop:grid-cols-[minmax(200px,1fr)_auto] max-tablet:grid-cols-[1fr] max-tablet:gap-[13px] max-tablet:px-[18px] max-tablet:py-4`;
const ROW_ACTIONS =
  "flex items-center justify-end gap-[7px] max-desktop:col-start-2 max-desktop:row-span-2 max-desktop:row-start-1 max-tablet:col-start-1 max-tablet:row-auto max-tablet:flex-wrap max-tablet:justify-start";
const RELATIONSHIP_NOTE = "inline-flex items-center gap-1.5 text-xs text-faint";
const LIST = "grid gap-2.5";
const MENU_ITEM =
  "flex min-h-[35px] w-full cursor-pointer items-center gap-[7px] rounded-xs border-0 bg-transparent px-[9px] text-left text-xs text-muted hover:bg-canvas-deep hover:text-ink-strong disabled:cursor-wait disabled:opacity-50";

type Candidate = {
  handle: string;
  displayName: string;
  friendshipId: string | null;
  relationship: "pending" | "accepted" | null;
  direction: "incoming" | "outgoing" | "friend" | null;
};

type Confirmation = {
  action: "block" | "cancel" | "remove";
  entry: FriendshipEntry;
};

type Notice = { message: string; tone: "success" | "error" };
type ConnectionTarget = Pick<FriendshipEntry, "id" | "other">;

export function FriendsWorkspace({
  initialFriendships
}: {
  initialFriendships: FriendshipList;
}) {
  const [friendships, setFriendships] = useState(initialFriendships);
  const [handle, setHandle] = useState("");
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<string, true>>({});
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);

  useEffect(() => {
    const query = handle.trim().toLowerCase();
    if (!query) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/v1/me/friends/search?handle=${encodeURIComponent(query)}`, {
          signal: controller.signal
        });
        const result = await response.json();
        if (!response.ok) {
          setSearchError(result.message ?? "That profile could not be found.");
          return;
        }
        setCandidate(result.candidate);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSearchError("That profile could not be found.");
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [handle]);

  function showNotice(message: string, tone: Notice["tone"] = "success") {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice({ message, tone });
    noticeTimer.current = setTimeout(() => setNotice(null), 3200);
  }

  function setActionPending(key: string, active: boolean) {
    setPending((current) => {
      const next = { ...current };
      if (active) next[key] = true;
      else delete next[key];
      return next;
    });
  }

  async function refresh() {
    const response = await fetch("/v1/me/friends");
    if (!response.ok) throw new Error("Friend list refresh failed");
    setFriendships(await response.json());
  }

  async function sendRequest() {
    if (!candidate) return;
    const key = `candidate:${candidate.handle}`;
    setActionPending(key, true);

    try {
      const response = await fetch("/v1/me/friends", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handle: candidate.handle })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "The friend request could not be sent.");
      setCandidate(null);
      setHandle("");
      await refresh();
      showNotice(`Request sent to @${candidate.handle}.`);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "The friend request could not be sent.", "error");
    } finally {
      setActionPending(key, false);
    }
  }

  async function act(entry: ConnectionTarget, action: "accept" | "decline" | "block" | "unblock") {
    const key = `${entry.id}:${action}`;
    setActionPending(key, true);

    try {
      const response = await fetch(`/v1/me/friends/${entry.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action })
      });
      if (!response.ok) throw new Error("That connection could not be updated.");
      await refresh();
      showNotice(actionMessage(entry, action));
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "That connection could not be updated.", "error");
    } finally {
      setActionPending(key, false);
    }
  }

  async function remove(entry: FriendshipEntry) {
    const key = `${entry.id}:remove`;
    setActionPending(key, true);

    try {
      const response = await fetch(`/v1/me/friends/${entry.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("That connection could not be removed.");
      await refresh();
      showNotice(entry.direction === "outgoing" ? "Friend request cancelled." : `@${entry.other.handle} removed from your friends.`);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "That connection could not be removed.", "error");
    } finally {
      setActionPending(key, false);
    }
  }

  async function confirmAction() {
    if (!confirmation) return;
    const { action, entry } = confirmation;
    setConfirmation(null);
    if (action === "block") await act(entry, "block");
    else await remove(entry);
  }

  const friendCount = friendships.friends.length;

  return (
    <>
      <header className="mb-10">
        <div className="flex items-center gap-3">
          <h1 className="m-0 text-4xl font-medium leading-none tracking-[-.04em] text-ink-strong">Friends</h1>
          <span className="inline-flex items-center gap-[5px] rounded-full border border-line bg-panel px-2.5 py-1 text-xs font-medium text-muted">
            <LockKeyhole size={12} /> Private
          </span>
        </div>
        <p className="mb-0 mt-2 max-w-[610px] text-sm leading-[1.55] text-muted">
          See how your activity lines up with friends.
        </p>
      </header>

      <section aria-labelledby="network-overview-title">
        <div className={SECTION_HEADING}>
          <span className="min-w-0">
            <h2 id="network-overview-title" className={SECTION_TITLE}>Your network</h2>
            <small className={SECTION_SUB}>A private space for the people you build alongside.</small>
          </span>
        </div>
        <div className={cx(CARD, "p-4 max-tablet:p-3.5")} aria-label="Friend workspace summary">
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: friendCount, label: "Friends" },
              { value: friendships.incoming.length, label: "New requests" },
              { value: friendships.outgoing.length, label: "Sent requests" }
            ].map((stat) => (
              <span key={stat.label} className="rounded-sm bg-canvas-deep px-4 py-3.5 max-tablet:px-3">
                <b className="block text-xl font-semibold leading-none text-ink-strong [font-variant-numeric:tabular-nums]">{stat.value}</b>
                <small className="mt-2 block text-xs text-muted">{stat.label}</small>
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className={SECTION} aria-labelledby="add-friend-title">
        <div className={SECTION_HEADING}>
          <span className="min-w-0">
            <h2 id="add-friend-title" className={SECTION_TITLE}>Add a friend</h2>
            <small className={SECTION_SUB}>Search by their Agentprint handle.</small>
          </span>
        </div>
        <div className={cx(CARD, "p-4 max-tablet:p-3.5")}>
          <Popover
            open={Boolean(candidate || searchError)}
            onOpenChange={(open) => {
              if (open) return;
              setCandidate(null);
              setSearchError(null);
            }}
          >
            <PopoverAnchor asChild>
              <div className="grid min-h-[52px] grid-cols-[auto_1fr_auto] items-center rounded-sm bg-canvas-deep transition-[box-shadow] duration-150 focus-within:shadow-[inset_0_0_0_1px_var(--color-steel-3)]">
                <label className="sr-only" htmlFor="friend-handle">Agentprint handle</label>
                <span aria-hidden="true" className="pl-4 text-faint">@</span>
                <input
                  id="friend-handle"
                  className="h-[52px] min-w-0 border-0 bg-transparent pl-[3px] pr-3 text-ink-strong outline-0 placeholder:text-faint"
                  value={handle}
                  onChange={(event) => {
                    setHandle(event.target.value);
                    setCandidate(null);
                    setSearchError(null);
                    setSearching(false);
                  }}
                  placeholder="handle"
                  autoComplete="off"
                  required
                />
                <span className="mr-4 grid size-5 place-items-center text-faint" aria-label={searching ? "Searching" : "Search by handle"}>
                  {searching ? <span className={spinnerClass} /> : <Search size={15} />}
                </span>
              </div>
            </PopoverAnchor>
            <PopoverContent
              align="start"
              sideOffset={8}
              onOpenAutoFocus={(event) => event.preventDefault()}
              className="w-[360px] max-w-[calc(100vw-28px)] border-line-strong bg-panel-raised p-2.5 text-ink shadow-[0_14px_36px_color-mix(in_srgb,var(--color-ink-strong)_12%,transparent)]"
              aria-live="polite"
            >
              {candidate ? (
                <div className="flex min-h-[58px] items-center gap-3 rounded-sm bg-canvas-deep p-2.5 max-tablet:flex-col max-tablet:items-stretch">
                  <FriendIdentity entry={candidate} className="min-w-0 flex-1" />
                  <CandidateAction
                    candidate={candidate}
                    pending={Boolean(pending[`candidate:${candidate.handle}`]) || Boolean(candidate.friendshipId && isPending(pending, candidate.friendshipId))}
                    onAccept={() => act({ id: candidate.friendshipId!, other: candidate }, "accept")}
                    onSend={sendRequest}
                  />
                </div>
              ) : (
                <p className="m-0 px-2 py-2 text-xs leading-[1.5] text-muted" role="status">{searchError}</p>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </section>

      {friendships.incoming.length > 0 && (
        <section className={SECTION} aria-labelledby="incoming-title">
          <div className={SECTION_HEADING}>
            <span className="min-w-0">
              <h2 id="incoming-title" className={SECTION_TITLE}>Requests for you</h2>
              <small className={SECTION_SUB}>People who want to connect with you.</small>
            </span>
            <span className={SECTION_COUNT}>{friendships.incoming.length}</span>
          </div>
          <div className={LIST}>
            {friendships.incoming.map((entry) => (
              <div className={ROW} key={entry.id}>
                <FriendIdentity entry={entry.other} />
                <div className={ROW_ACTIONS}>
                  <button className={buttonClass({ size: "small" })} onClick={() => act(entry, "accept")} disabled={isPending(pending, entry.id)}>
                    {pending[`${entry.id}:accept`] ? <span className={spinnerClass} /> : <Check size={14} />} Accept
                  </button>
                  <button className={quietActionClass} onClick={() => act(entry, "decline")} disabled={isPending(pending, entry.id)}>
                    <X size={14} /> Decline
                  </button>
                  <button
                    className={cx(iconButtonDangerClass, "disabled:cursor-wait disabled:opacity-50")}
                    onClick={() => setConfirmation({ action: "block", entry })}
                    disabled={isPending(pending, entry.id)}
                    aria-label={`Block ${entry.other.displayName}`}
                  ><Ban size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className={SECTION} aria-labelledby="network-title">
        <div className={SECTION_HEADING}>
          <span className="min-w-0">
            <h2 id="network-title" className={SECTION_TITLE}>Your friends</h2>
            <small className={SECTION_SUB}>Compare activity with the people you’ve added.</small>
          </span>
          <span className={SECTION_COUNT}>{friendCount}</span>
        </div>
        <div className={LIST}>
          {friendCount === 0 && (
            <div className={cx(CARD, "flex min-h-[104px] items-center gap-[13px] px-5 py-[18px] text-faint")}>
              <span className="grid size-10 shrink-0 place-items-center rounded-sm bg-canvas-deep"><Users size={18} /></span>
              <span>
                <b className="block text-sm font-medium text-ink-strong">No friends yet</b>
                <small className="mt-1 block text-xs">Add someone above to start comparing activity.</small>
              </span>
            </div>
          )}
          {friendships.friends.map((entry) => {
            return (
              <div className={ROW} key={entry.id}>
                <FriendIdentity entry={entry.other} />
                <div className="max-desktop:col-start-1 max-tablet:row-auto">
                  <span
                    className="inline-flex items-center gap-[7px] text-xs text-faint before:size-1.5 before:rounded-full before:bg-line-strong before:content-[''] data-[ready]:text-blue data-[ready]:before:bg-blue data-[ready]:before:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-blue)_10%,transparent)]"
                    data-ready
                  >
                    Ready to compare
                  </span>
                </div>
                <div className={ROW_ACTIONS}>
                  <ComparisonAction entry={entry} />
                  <ActionMenu
                    entry={entry}
                    disabled={isPending(pending, entry.id)}
                    onBlock={() => setConfirmation({ action: "block", entry })}
                    onRemove={() => setConfirmation({ action: "remove", entry })}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {friendships.outgoing.length > 0 && (
        <section className={SECTION} aria-labelledby="sent-title">
          <div className={SECTION_HEADING}>
            <span className="min-w-0">
              <h2 id="sent-title" className={SECTION_TITLE}>Sent requests</h2>
              <small className={SECTION_SUB}>Waiting for the other person.</small>
            </span>
            <span className={SECTION_COUNT}>{friendships.outgoing.length}</span>
          </div>
          <div className={LIST}>
            {friendships.outgoing.map((entry) => (
              <div className={ROW} key={entry.id}>
                <FriendIdentity entry={entry.other} />
                <span className={RELATIONSHIP_NOTE}><Clock3 size={14} /> Waiting for a response</span>
                <button className={quietActionClass} onClick={() => setConfirmation({ action: "cancel", entry })} disabled={isPending(pending, entry.id)}>Cancel request</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {friendships.blocked.length > 0 && (
        <details className="mt-9 border-t border-line text-xs text-faint">
          <summary className="flex w-fit cursor-pointer items-center gap-2 px-0.5 py-3.5">
            Blocked people <span className="grid h-5 min-w-5 place-items-center border border-line text-2xs">{friendships.blocked.length}</span>
          </summary>
          <div className={LIST}>
            {friendships.blocked.map((entry) => (
              <div className={ROW} key={entry.id}>
                <FriendIdentity entry={entry.other} />
                <button className={quietActionClass} onClick={() => act(entry, "unblock")} disabled={isPending(pending, entry.id)}>
                  {pending[`${entry.id}:unblock`] ? <span className={cx(spinnerClass, "text-muted")} /> : <RotateCcw size={14} />} Unblock
                </button>
              </div>
            ))}
          </div>
        </details>
      )}

      {notice && (
        <div
          className="group fixed bottom-6 right-6 z-[45] flex min-h-12 max-w-[min(390px,calc(100vw-28px))] items-center gap-2.5 rounded-md border border-steel-2 bg-panel-raised py-[9px] pl-[9px] pr-3.5 text-xs text-ink shadow-[0_16px_42px_color-mix(in_srgb,var(--color-ink-strong)_12%,transparent)] animate-[notice-enter_240ms_cubic-bezier(.16,1,.3,1)_both] data-[tone=error]:border-[color-mix(in_srgb,var(--color-red)_46%,var(--color-line))] max-tablet:bottom-3.5 max-tablet:right-3.5"
          data-tone={notice.tone}
          role="status"
        >
          <span className="grid size-[29px] place-items-center rounded-sm bg-accent-soft text-blue group-data-[tone=error]:bg-[color-mix(in_srgb,var(--color-red)_9%,var(--color-panel))] group-data-[tone=error]:text-red">
            {notice.tone === "success" ? <Check size={14} /> : <X size={14} />}
          </span>
          {notice.message}
        </div>
      )}
      {confirmation && <ConfirmDialog confirmation={confirmation} onCancel={() => setConfirmation(null)} onConfirm={confirmAction} />}
    </>
  );
}

function CandidateAction({ candidate, pending, onAccept, onSend }: { candidate: Candidate; pending: boolean; onAccept: () => void; onSend: () => void }) {
  if (candidate.direction === "friend") return <span className={RELATIONSHIP_NOTE}><Check size={14} /> Already friends</span>;
  if (candidate.direction === "outgoing") return <span className={RELATIONSHIP_NOTE}><Clock3 size={14} /> Request pending</span>;
  if (candidate.direction === "incoming") return <button className={buttonClass({ size: "small" })} onClick={onAccept} disabled={pending}><Check size={14} /> Accept request</button>;
  return <button className={buttonClass({ size: "small" })} onClick={onSend} disabled={pending}>{pending ? <span className={spinnerClass} /> : <UserPlus size={14} />} Send request</button>;
}

function ActionMenu({ entry, disabled, onBlock, onRemove }: { entry: FriendshipEntry; disabled: boolean; onBlock: () => void; onRemove: () => void }) {
  function chooseAction(event: MouseEvent<HTMLButtonElement>, action: () => void) {
    const details = event.currentTarget.closest("details");
    if (!details) return;
    details.open = false;
    details.querySelector<HTMLElement>("summary")?.focus();
    action();
  }

  return (
    <details className="relative">
      <summary
        className={cx(
          iconButtonClass,
          "list-none [&::-webkit-details-marker]:hidden aria-disabled:pointer-events-none aria-disabled:opacity-50",
          "[[open]>&]:border-steel-2 [[open]>&]:bg-accent-soft"
        )}
        aria-label={`More actions for ${entry.other.displayName}`}
        aria-disabled={disabled || undefined}
        onClick={(event) => { if (disabled) event.preventDefault(); }}
      ><MoreHorizontal size={16} /></summary>
      <div className="absolute right-0 top-[calc(100%+7px)] z-[8] w-40 rounded-sm border border-line-strong bg-panel-raised p-[5px] shadow-[0_14px_36px_color-mix(in_srgb,var(--color-ink-strong)_12%,transparent)] animate-[menu-enter_150ms_cubic-bezier(.16,1,.3,1)_both] max-tablet:left-0 max-tablet:right-auto">
        <button className={MENU_ITEM} onClick={(event) => chooseAction(event, onRemove)} disabled={disabled}>Remove friend</button>
        <button className={cx(MENU_ITEM, "text-red")} onClick={(event) => chooseAction(event, onBlock)} disabled={disabled}><Ban size={13} /> Block</button>
      </div>
    </details>
  );
}

function ConfirmDialog({ confirmation, onCancel, onConfirm }: { confirmation: Confirmation; onCancel: () => void; onConfirm: () => void }) {
  const dialog = useRef<HTMLElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement | null;

    function handleDialogKeys(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancelRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialog.current) return;
      const focusable = [...dialog.current.querySelectorAll<HTMLElement>("button:not(:disabled)")];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener("keydown", handleDialogKeys);
    cancelButton.current?.focus();
    return () => {
      document.removeEventListener("keydown", handleDialogKeys);
      previousFocus.current?.focus();
    };
  }, []);

  const isBlock = confirmation.action === "block";
  const copy = confirmationCopy(confirmation);

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-[color-mix(in_srgb,var(--color-ink-strong)_30%,transparent)] p-5 backdrop-blur-[5px] animate-[veil-enter_180ms_ease-out_both]"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}
    >
      <section
        ref={dialog}
        className="w-[min(440px,100%)] rounded-md border border-line-strong bg-panel-raised p-[30px] shadow-[0_28px_80px_color-mix(in_srgb,var(--color-ink-strong)_20%,transparent)] animate-[dialog-enter_260ms_cubic-bezier(.16,1,.3,1)_both] max-tablet:px-5 max-tablet:py-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
      >
        <span
          className="grid size-11 place-items-center rounded-sm border border-steel-2 bg-accent-soft text-blue data-[danger]:border-[color-mix(in_srgb,var(--color-red)_42%,var(--color-line))] data-[danger]:bg-[color-mix(in_srgb,var(--color-red)_8%,var(--color-panel))] data-[danger]:text-red"
          data-danger={isBlock || undefined}
        >{isBlock ? <Ban size={19} /> : <Users size={19} />}</span>
        <h2 id="confirm-title" className="mb-2 mt-5 text-3xl font-medium text-ink-strong">{copy.title}</h2>
        <p id="confirm-description" className="m-0 text-sm leading-[1.6] text-muted">{copy.description}</p>
        <div className="mt-[26px] flex justify-end gap-2 max-tablet:flex-col-reverse max-tablet:items-stretch">
          <button ref={cancelButton} className={buttonClass({ variant: "secondary", size: "small" })} onClick={onCancel}>Keep connection</button>
          <button className={buttonClass({ variant: isBlock ? "danger" : "primary", size: "small" })} onClick={onConfirm}>{copy.confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}

function FriendIdentity({ entry, className }: { entry: { handle: string; displayName: string }; className?: string }) {
  const initials = entry.displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2);
  return (
    <div className={cx("flex min-w-0 items-center gap-[11px]", className)}>
      <span className={avatarChipClass()} aria-hidden="true">{initials}</span>
      <span className="block min-w-0">
        <b className="block truncate text-xs font-semibold text-ink-strong">{entry.displayName}</b>
        <small className="mt-0.5 block truncate text-xs text-faint">@{entry.handle}</small>
      </span>
    </div>
  );
}

function isPending(pending: Record<string, true>, friendshipId: string) {
  return Object.keys(pending).some((key) => key.startsWith(`${friendshipId}:`));
}

function actionMessage(entry: ConnectionTarget, action: "accept" | "decline" | "block" | "unblock") {
  if (action === "accept") return `You and @${entry.other.handle} are now friends.`;
  if (action === "decline") return "Friend request declined.";
  if (action === "block") return `@${entry.other.handle} blocked.`;
  return `@${entry.other.handle} unblocked.`;
}

function ComparisonAction({ entry }: { entry: FriendshipEntry }) {
  return <Link className={buttonClass({ variant: "secondary", size: "small" })} href={`/friends/${entry.id}`}>Compare traces <ArrowRight size={13} /></Link>;
}

function confirmationCopy(confirmation: Confirmation) {
  if (confirmation.action === "block") {
    return {
      title: `Block @${confirmation.entry.other.handle}?`,
      description: "They will no longer find you or see this connection. You can unblock them later.",
      confirmLabel: "Block person"
    };
  }
  if (confirmation.action === "cancel") {
    return {
      title: "Cancel this request?",
      description: "The request will disappear from both accounts. You can send another later.",
      confirmLabel: "Cancel request"
    };
  }
  return {
    title: `Remove @${confirmation.entry.other.handle}?`,
    description: "Your shared comparison will close immediately. You can reconnect with a new request.",
    confirmLabel: "Remove friend"
  };
}
