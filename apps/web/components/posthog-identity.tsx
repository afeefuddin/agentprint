"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

const IDENTIFIED_USER_KEY = "agentprint_posthog_identified_user";

type PostHogIdentityProps = {
  userId: string | null;
  username: string | null;
};

export function PostHogIdentity({ userId, username }: PostHogIdentityProps) {
  useEffect(() => {
    if (!posthog.__loaded) return;

    const previousUserId = window.localStorage.getItem(IDENTIFIED_USER_KEY);
    if (userId) {
      posthog.identify(userId, username ? { username } : undefined);
      window.localStorage.setItem(IDENTIFIED_USER_KEY, userId);
      return;
    }

    if (previousUserId) {
      posthog.reset();
      window.localStorage.removeItem(IDENTIFIED_USER_KEY);
    }
  }, [userId, username]);

  return null;
}
