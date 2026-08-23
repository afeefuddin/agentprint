"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

const IDENTIFIED_USER_KEY = "agentprint_posthog_identified_user";

export function PostHogIdentity({ userId }: { userId: string | null }) {
  useEffect(() => {
    if (!posthog.__loaded) return;

    const previousUserId = window.localStorage.getItem(IDENTIFIED_USER_KEY);
    if (userId) {
      if (previousUserId !== userId || posthog.get_distinct_id() !== userId) {
        posthog.identify(userId);
      }
      window.localStorage.setItem(IDENTIFIED_USER_KEY, userId);
      return;
    }

    if (previousUserId) {
      posthog.reset();
      window.localStorage.removeItem(IDENTIFIED_USER_KEY);
    }
  }, [userId]);

  return null;
}
