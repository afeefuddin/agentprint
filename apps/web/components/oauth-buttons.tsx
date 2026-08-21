"use client";

const oauthErrors: Record<string, string> = {
  github_denied: "GitHub authorization was cancelled.",
  github_invalid_state: "That GitHub sign-in expired. Please try again.",
  github_email_required: "GitHub must provide a verified email address to continue.",
  github_not_configured: "GitHub sign-in is not configured yet.",
  github_failed: "GitHub sign-in could not be completed. Please try again.",
  google_denied: "Google authorization was cancelled.",
  google_invalid_state: "That Google sign-in expired. Please try again.",
  google_email_required: "Google must provide a verified email address to continue.",
  google_not_configured: "Google sign-in is not configured yet.",
  google_failed: "Google sign-in could not be completed. Please try again."
};

function GitHubMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
      <path fill="currentColor" d="M12 .5C5.73.5.5 5.73.5 12c0 5.1 3.29 9.42 7.86 10.96.58.1.79-.25.79-.56v-2.17c-3.2.7-3.88-1.36-3.88-1.36-.52-1.34-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.56-.29-5.26-1.28-5.26-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.05 0 0 .97-.31 3.17 1.18A11.04 11.04 0 0 1 12 6.02c.98 0 1.96.13 2.88.39 2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.4-5.27 5.69.42.36.78 1.06.78 2.14v3.19c0 .31.21.67.79.56A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
      <path fill="#4285f4" d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.6h3.2c1.9-1.8 3-4.3 3-7.3Z" />
      <path fill="#34a853" d="M12 22c2.7 0 5-.9 6.6-2.5l-3.2-2.6c-.9.6-2 1-3.4 1a5.8 5.8 0 0 1-5.4-4H3.3v2.7A10 10 0 0 0 12 22Z" />
      <path fill="#fbbc05" d="M6.6 13.9a6 6 0 0 1 0-3.8V7.4H3.3a10 10 0 0 0 0 9.2l3.3-2.7Z" />
      <path fill="#ea4335" d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.9-2.8A9.7 9.7 0 0 0 3.3 7.4l3.3 2.7a5.8 5.8 0 0 1 5.4-4Z" />
    </svg>
  );
}

export function OAuthButtons({
  nextPath,
  oauthError
}: {
  nextPath?: string;
  oauthError?: string;
}) {
  const query = new URLSearchParams({ source: "login", ...(nextPath ? { next: nextPath } : {}) });
  const providerButton =
    "flex h-[52px] w-full items-center justify-center gap-[9px] rounded-sm border border-line-strong text-sm font-semibold transition-[background-color,border-color,transform] duration-[140ms] active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
  return (
    <div className="mt-8 w-full">
      {oauthError && (
        <p className="mb-4 rounded-sm border border-red/35 bg-red/5 px-3.5 py-3 text-xs leading-[1.5] text-red" role="alert">
          {oauthErrors[oauthError] ?? "Sign-in could not be completed. Please try again."}
        </p>
      )}
      <a
        className={`${providerButton} bg-ink-strong text-canvas shadow-[0_8px_22px_rgb(23_25_20_/_0.12)] hover:border-[#2d3029] hover:bg-[#2d3029]`}
        href={`/api/auth/github?${query}`}
      >
        <GitHubMark /><span>Continue with GitHub</span>
      </a>
      <a
        className={`${providerButton} mt-3 bg-panel text-ink-strong hover:border-ink hover:bg-canvas-deep`}
        href={`/api/auth/google?${query}`}
      >
        <GoogleMark /><span>Continue with Google</span>
      </a>
    </div>
  );
}
