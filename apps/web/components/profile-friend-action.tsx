"use client";

import Link from "next/link";
import { Check, Clock3, Inbox, UserPlus } from "lucide-react";
import { useState } from "react";

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
      <Link className="button button-small profile-friend-action" href={`/login?next=${encodeURIComponent(`/${handle}`)}`}>
        <UserPlus size={14} /> Add friend
      </Link>
    );
  }

  if (!state) return null;

  if (state.relationship === "accepted") {
    return (
      <Link className="button button-small button-secondary profile-friend-action" href="/friends">
        <Check size={14} /> Friends
      </Link>
    );
  }

  if (state.relationship === "pending" && state.direction === "incoming") {
    return (
      <Link className="button button-small profile-friend-action" href="/friends">
        <Inbox size={14} /> Respond to request
      </Link>
    );
  }

  if (state.relationship === "pending") {
    return (
      <span className="profile-friend-state" aria-live="polite">
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
    <span className="profile-friend-control">
      <button className="button button-small profile-friend-action" type="button" onClick={sendRequest} disabled={sending}>
        {sending ? <span className="button-spinner" /> : <UserPlus size={14} />}
        {sending ? "Sending…" : "Add friend"}
      </button>
      {error && <small role="alert">{error}</small>}
    </span>
  );
}
