"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

const IDENTIFIED_USER_KEY = "agentprint_posthog_identified_user";

type PostHogIdentityProps = {
  username: string | null;
};

export function PostHogIdentity({ username }: PostHogIdentityProps) {
  useEffect(() => {
    if (!posthog.__loaded) return;

    const previousUsername = window.localStorage.getItem(IDENTIFIED_USER_KEY);
    if (username) {
      posthog.identify(username, { username });
      window.localStorage.setItem(IDENTIFIED_USER_KEY, username);
      return;
    }

    if (previousUsername) {
      posthog.reset();
      window.localStorage.removeItem(IDENTIFIED_USER_KEY);
    }
  }, [username]);

  return null;
}
