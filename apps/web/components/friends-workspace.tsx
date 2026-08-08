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
import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";

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
  initialFriendships,
  initialComparisonSharing
}: {
  initialFriendships: FriendshipList;
  initialComparisonSharing: boolean;
}) {
  const [friendships, setFriendships] = useState(initialFriendships);
  const [comparisonSharing, setComparisonSharing] = useState(initialComparisonSharing);
  const [handle, setHandle] = useState("");
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [searching, setSearching] = useState(false);
  const [sharingBusy, setSharingBusy] = useState(false);
  const [pending, setPending] = useState<Record<string, true>>({});
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);

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

  async function search(event: FormEvent) {
    event.preventDefault();
    setSearching(true);
    setCandidate(null);
    setNotice(null);

    try {
      const response = await fetch(`/v1/me/friends/search?handle=${encodeURIComponent(handle.trim().toLowerCase())}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "That profile could not be found.");
      setCandidate(result.candidate);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "That profile could not be found.", "error");
    } finally {
      setSearching(false);
    }
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

  async function toggleSharing() {
    const next = !comparisonSharing;
    setComparisonSharing(next);
    setSharingBusy(true);

    try {
      const response = await fetch("/v1/me/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ friends_can_compare: next })
      });
      if (!response.ok) throw new Error("Comparison sharing could not be updated.");
      showNotice(next ? "Friend comparisons enabled." : "Friend comparisons paused.");
    } catch (error) {
      setComparisonSharing(!next);
      showNotice(error instanceof Error ? error.message : "Comparison sharing could not be updated.", "error");
    } finally {
      setSharingBusy(false);
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
  const readyCount = friendships.friends.filter((entry) => canCompare(entry, comparisonSharing)).length;

  return (
    <>
      <header className="friends-hero">
        <div>
          <span className="eyebrow">Private peer network</span>
          <h1>Compare traces,<br /><em>not people.</em></h1>
          <p>Connect by exact handle and align agent activity on the same dates. Every comparison requires both friends to opt in.</p>
        </div>
        <div className="friends-overview" aria-label="Friend workspace summary">
          <span><b>{friendCount}</b><small>Connected</small></span>
          <span><b>{friendships.incoming.length}</b><small>Requests</small></span>
          <span><b>{readyCount}</b><small>Ready to compare</small></span>
        </div>
      </header>

      <section className="sharing-rail" aria-labelledby="friend-sharing-title">
        <span className="sharing-rail-icon"><LockKeyhole size={18} /></span>
        <span><b id="friend-sharing-title">Friend comparisons</b><small>{comparisonSharing ? "Accepted friends can compare mutually visible metrics." : "Your trace stays unavailable until you enable sharing."}</small></span>
        <span className="sharing-state" data-enabled={comparisonSharing || undefined}>{comparisonSharing ? "Enabled" : "Paused"}</span>
        <button className="switch" role="switch" aria-checked={comparisonSharing} aria-label="Friend comparisons" onClick={toggleSharing} disabled={sharingBusy}><i /></button>
      </section>

      <section className="friend-search-panel" aria-labelledby="add-friend-title">
        <div className="friend-panel-heading">
          <span><h2 id="add-friend-title">Add a friend</h2><small>Exact handles protect discovery from becoming a public directory.</small></span>
        </div>
        <form className="friend-search" onSubmit={search}>
          <label className="sr-only" htmlFor="friend-handle">Exact Agentprint handle</label>
          <span aria-hidden="true">@</span>
          <input id="friend-handle" value={handle} onChange={(event) => setHandle(event.target.value)} placeholder="Exact Agentprint handle" autoComplete="off" required />
          <button className="button button-small" disabled={searching || !handle.trim()}>{searching ? <span className="button-spinner" /> : <Search size={14} />} {searching ? "Searching…" : "Find friend"}</button>
        </form>

        {candidate && (
          <div className="friend-candidate" aria-live="polite">
            <FriendIdentity entry={candidate} />
            <CandidateAction
              candidate={candidate}
              pending={Boolean(pending[`candidate:${candidate.handle}`]) || Boolean(candidate.friendshipId && isPending(pending, candidate.friendshipId))}
              onAccept={() => act({ id: candidate.friendshipId!, other: candidate }, "accept")}
              onSend={sendRequest}
            />
          </div>
        )}
      </section>

      {friendships.incoming.length > 0 && (
        <section className="friend-panel incoming-panel" aria-labelledby="incoming-title">
          <div className="friend-panel-heading">
            <span><h2 id="incoming-title">Requests for you</h2><small>Only accept people whose handle you recognize.</small></span>
            <span>{friendships.incoming.length}</span>
          </div>
          <div className="friend-list">
            {friendships.incoming.map((entry) => (
              <div className="friend-row" key={entry.id}>
                <FriendIdentity entry={entry.other} />
                <div className="friend-actions">
                  <button className="button button-small" onClick={() => act(entry, "accept")} disabled={isPending(pending, entry.id)}>{pending[`${entry.id}:accept`] ? <span className="button-spinner" /> : <Check size={14} />} Accept</button>
                  <button className="quiet-action" onClick={() => act(entry, "decline")} disabled={isPending(pending, entry.id)}><X size={14} /> Decline</button>
                  <button className="icon-button danger" onClick={() => setConfirmation({ action: "block", entry })} disabled={isPending(pending, entry.id)} aria-label={`Block ${entry.other.displayName}`}><Ban size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="friend-panel" aria-labelledby="network-title">
        <div className="friend-panel-heading">
          <span><h2 id="network-title">Your friends</h2><small>Comparison availability follows both people’s sharing controls.</small></span>
          <span>{friendCount}</span>
        </div>
        <div className="friend-list">
          {friendCount === 0 && (
            <div className="friends-empty"><Users size={22} /><span><b>Your peer rail is empty</b><small>Add someone by exact handle to align your first traces.</small></span></div>
          )}
          {friendships.friends.map((entry) => {
            const ready = canCompare(entry, comparisonSharing);
            return (
              <div className="friend-row" key={entry.id}>
                <FriendIdentity entry={entry.other} />
                <div className="friend-sharing">
                  <span data-ready={ready || undefined}>{sharingStatus(entry, comparisonSharing)}</span>
                </div>
                <div className="friend-actions">
                  <ComparisonAction entry={entry} ready={ready} comparisonSharing={comparisonSharing} sharingBusy={sharingBusy} onEnableSharing={toggleSharing} />
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
        <section className="friend-panel secondary-panel" aria-labelledby="sent-title">
          <div className="friend-panel-heading">
            <span><h2 id="sent-title">Sent requests</h2><small>Pending until the other person accepts.</small></span>
            <span>{friendships.outgoing.length}</span>
          </div>
          <div className="friend-list">
            {friendships.outgoing.map((entry) => (
              <div className="friend-row" key={entry.id}>
                <FriendIdentity entry={entry.other} />
                <span className="relationship-note"><Clock3 size={14} /> Waiting for a response</span>
                <button className="quiet-action" onClick={() => setConfirmation({ action: "cancel", entry })} disabled={isPending(pending, entry.id)}>Cancel request</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {friendships.blocked.length > 0 && (
        <details className="blocked-friends">
          <summary>Blocked people <span>{friendships.blocked.length}</span></summary>
          <div className="friend-list">
            {friendships.blocked.map((entry) => (
              <div className="friend-row" key={entry.id}>
                <FriendIdentity entry={entry.other} />
                <button className="quiet-action" onClick={() => act(entry, "unblock")} disabled={isPending(pending, entry.id)}>{pending[`${entry.id}:unblock`] ? <span className="button-spinner dark" /> : <RotateCcw size={14} />} Unblock</button>
              </div>
            ))}
          </div>
        </details>
      )}

      {notice && <div className="friends-notice" data-tone={notice.tone} role="status"><span>{notice.tone === "success" ? <Check size={14} /> : <X size={14} />}</span>{notice.message}</div>}
      {confirmation && <ConfirmDialog confirmation={confirmation} onCancel={() => setConfirmation(null)} onConfirm={confirmAction} />}
    </>
  );
}

function CandidateAction({ candidate, pending, onAccept, onSend }: { candidate: Candidate; pending: boolean; onAccept: () => void; onSend: () => void }) {
  if (candidate.direction === "friend") return <span className="relationship-note"><Check size={14} /> Already friends</span>;
  if (candidate.direction === "outgoing") return <span className="relationship-note"><Clock3 size={14} /> Request pending</span>;
  if (candidate.direction === "incoming") return <button className="button button-small" onClick={onAccept} disabled={pending}><Check size={14} /> Accept request</button>;
  return <button className="button button-small" onClick={onSend} disabled={pending}>{pending ? <span className="button-spinner" /> : <UserPlus size={14} />} Send request</button>;
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
    <details className="friend-menu">
      <summary className="icon-button" aria-label={`More actions for ${entry.other.displayName}`} aria-disabled={disabled || undefined} onClick={(event) => { if (disabled) event.preventDefault(); }}><MoreHorizontal size={16} /></summary>
      <div>
        <button onClick={(event) => chooseAction(event, onRemove)} disabled={disabled}>Remove friend</button>
        <button className="danger" onClick={(event) => chooseAction(event, onBlock)} disabled={disabled}><Ban size={13} /> Block</button>
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
    <div className="confirm-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <section ref={dialog} className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description">
        <span className="confirm-icon" data-danger={isBlock || undefined}>{isBlock ? <Ban size={19} /> : <Users size={19} />}</span>
        <h2 id="confirm-title">{copy.title}</h2>
        <p id="confirm-description">{copy.description}</p>
        <div>
          <button ref={cancelButton} className="button button-secondary button-small" onClick={onCancel}>Keep connection</button>
          <button className={`button button-small${isBlock ? " button-danger" : ""}`} onClick={onConfirm}>{copy.confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}

function FriendIdentity({ entry }: { entry: { handle: string; displayName: string } }) {
  const initials = entry.displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2);
  return (
    <div className="friend-identity">
      <span className="friend-avatar" aria-hidden="true">{initials}</span>
      <span><b>{entry.displayName}</b><small>@{entry.handle}</small></span>
    </div>
  );
}

function canCompare(entry: FriendshipEntry, comparisonSharing: boolean) {
  return comparisonSharing && entry.friendSharesComparisons;
}

function sharingStatus(entry: FriendshipEntry, comparisonSharing: boolean) {
  if (canCompare(entry, comparisonSharing)) return "Ready to compare";
  if (!comparisonSharing) return "Your sharing is paused";
  return "Waiting for their sharing";
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

function ComparisonAction({ entry, ready, comparisonSharing, sharingBusy, onEnableSharing }: { entry: FriendshipEntry; ready: boolean; comparisonSharing: boolean; sharingBusy: boolean; onEnableSharing: () => void }) {
  if (ready) return <Link className="button button-secondary button-small" href={`/dashboard/friends/${entry.id}`}>Compare traces <ArrowRight size={13} /></Link>;
  if (!comparisonSharing) return <button className="quiet-action sharing-action" onClick={onEnableSharing} disabled={sharingBusy}>Enable sharing</button>;
  return null;
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
