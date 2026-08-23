import posthog from "posthog-js";
import { sanitizeCapturedNetworkRequest, sanitizePostHogEvent } from "@/lib/posthog";

const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

if (projectToken && apiHost) {
  posthog.init(projectToken, {
    api_host: apiHost,
    defaults: "2026-05-30",
    autocapture: false,
    capture_pageview: "history_change",
    capture_pageleave: true,
    capture_exceptions: true,
    capture_heatmaps: false,
    capture_performance: { network_timing: true, web_vitals: true },
    disable_session_recording: false,
    enable_recording_console_log: false,
    person_profiles: "identified_only",
    session_recording: {
      sampleRate: 1,
      maskAllInputs: false,
      maskInputOptions: {
        email: true,
        password: true,
        tel: true
      },
      recordBody: false,
      recordHeaders: false,
      maskCapturedNetworkRequestFn: sanitizeCapturedNetworkRequest
    },
    before_send: sanitizePostHogEvent
  });
} else if (process.env.NODE_ENV === "development") {
  console.warn(
    "PostHog is disabled. Set NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN and NEXT_PUBLIC_POSTHOG_HOST to enable analytics."
  );
}
