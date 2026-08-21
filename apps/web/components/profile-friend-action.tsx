"use client";

import Link from "next/link";
import { Check, Clock3, Inbox, UserPlus } from "lucide-react";
import { useState } from "react";
import { buttonClass, spinnerClass } from "@/lib/ui";

type RelationshipState = {
  friendshipId: string | null;
  relationship: "pending" | "accepted" | null;
  direction: "incoming" | "outgoing" | "friend" | null;
};

type ProfileFriendActionProps = {
  handle: string;
  signedIn: boolean;
  initialState?: RelationshipState | null;
};

export function ProfileFriendAction({
  handle,
  signedIn,
  initialState
}: ProfileFriendActionProps) {
  const [state, setState] = useState(initialState);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  if (!signedIn) {
    return (
      <Link
        className={buttonClass({ size: "small", className: "whitespace-nowrap" })}
        href={`/login?next=${encodeURIComponent(`/${handle}`)}`}
      >
        <UserPlus size={14} /> Add friend
      </Link>
    );
  }

  if (!state) return null;

  if (state.relationship === "accepted") {
    return (
      <Link className={buttonClass({ variant: "secondary", size: "small", className: "whitespace-nowrap" })} href="/friends">
        <Check size={14} /> Friends
      </Link>
    );
  }

  if (state.relationship === "pending" && state.direction === "incoming") {
    return (
      <Link className={buttonClass({ size: "small", className: "whitespace-nowrap" })} href="/friends">
        <Inbox size={14} /> Respond to request
      </Link>
    );
  }

  if (state.relationship === "pending") {
    return (
      <span
        className="inline-flex min-h-[39px] items-center justify-center gap-[7px] whitespace-nowrap rounded-full border border-steel-2 bg-[color-mix(in_srgb,var(--color-accent-soft)_48%,transparent)] px-3.5 text-xs text-blue"
        aria-live="polite"
      >
        <Clock3 size={14} /> Request sent
      </span>
    );
  }

  async function sendRequest() {
    setSending(true);
    setError("");
    try {
      const response = await fetch("/v1/me/friends", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handle })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "The friend request could not be sent.");
      setState({ friendshipId: result.id, relationship: "pending", direction: "outgoing" });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The friend request could not be sent.");
    } finally {
      setSending(false);
    }
  }

  return (
    <span className="relative inline-flex">
      <button
        className={buttonClass({ size: "small", className: "whitespace-nowrap" })}
        type="button"
        onClick={sendRequest}
        disabled={sending}
      >
        {sending ? <span className={spinnerClass} /> : <UserPlus size={14} />}
        {sending ? "Sending…" : "Add friend"}
      </button>
      {error && (
        <small
          className="absolute right-0 top-[calc(100%+7px)] z-[2] w-[230px] border border-[color-mix(in_srgb,var(--color-red)_35%,var(--color-line))] bg-panel-raised px-[9px] py-[7px] text-right text-xs leading-[1.35] text-red max-tablet:left-0 max-tablet:right-auto max-tablet:text-left"
          role="alert"
        >
          {error}
        </small>
      )}
    </span>
  );
}
