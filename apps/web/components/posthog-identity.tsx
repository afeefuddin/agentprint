"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

const IDENTIFIED_USER_KEY = "agentprint_posthog_identified_user";

export function PostHogIdentity() {
  useEffect(() => {
    if (!posthog.__loaded) return;

    const controller = new AbortController();

    async function identifyViewer() {
      try {
        const response = await fetch("/v1/me", {
          cache: "no-store",
          signal: controller.signal
        });
        if (response.status === 401) {
          if (window.localStorage.getItem(IDENTIFIED_USER_KEY)) {
            posthog.reset();
            window.localStorage.removeItem(IDENTIFIED_USER_KEY);
          }
          return;
        }
        if (!response.ok) return;

        const result = await response.json() as {
          user: { handle: string; onboarding_complete: boolean };
        };
        if (!result.user.onboarding_complete) return;

        posthog.identify(result.user.handle, { username: result.user.handle });
        window.localStorage.setItem(IDENTIFIED_USER_KEY, result.user.handle);
      } catch {
        // Identity enrichment must never affect page availability.
      }
    }

    void identifyViewer();
    return () => controller.abort();
  }, []);

  return null;
}
