"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (posthog.__loaded) posthog.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="mx-auto grid min-h-screen max-w-3xl place-content-center px-6 text-center">
          <h1 className="text-2xl font-semibold text-ink-strong">Something went wrong</h1>
          <p className="mt-3 text-sm text-muted">Try the page again. Your Agentprint data is still safe.</p>
          <button
            className="mx-auto mt-6 rounded-sm border border-line bg-panel px-4 py-2 text-sm font-medium text-ink-strong"
            onClick={reset}
            type="button"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
