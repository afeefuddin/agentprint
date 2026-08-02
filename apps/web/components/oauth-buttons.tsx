"use client";

import { Github } from "lucide-react";

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

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
      <path fill="currentColor" d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.6h3.2c1.9-1.8 3-4.3 3-7.3Z" />
      <path fill="currentColor" opacity=".75" d="M12 22c2.7 0 5-.9 6.6-2.5l-3.2-2.6c-.9.6-2 1-3.4 1a5.8 5.8 0 0 1-5.4-4H3.3v2.7A10 10 0 0 0 12 22Z" />
      <path fill="currentColor" opacity=".55" d="M6.6 13.9a6 6 0 0 1 0-3.8V7.4H3.3a10 10 0 0 0 0 9.2l3.3-2.7Z" />
      <path fill="currentColor" opacity=".9" d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.9-2.8A9.7 9.7 0 0 0 3.3 7.4l3.3 2.7a5.8 5.8 0 0 1 5.4-4Z" />
    </svg>
  );
}

export function OAuthButtons({ mode, nextPath, oauthError }: { mode: "register" | "login"; nextPath?: string; oauthError?: string }) {
  const query = new URLSearchParams({ source: mode, ...(nextPath ? { next: nextPath } : {}) });
  return (
    <div className="auth-form oauth-only">
      {oauthError && <p className="form-error" role="alert">{oauthErrors[oauthError] ?? "Sign-in could not be completed. Please try again."}</p>}
      <a className="github-auth-button" href={`/api/auth/github?${query}`}><Github size={18} /><span>Continue with GitHub</span></a>
      <a className="google-auth-button" href={`/api/auth/google?${query}`}><GoogleMark /><span>Continue with Google</span></a>
      <p className="auth-switch">Your profile stays private until you choose to publish it.</p>
    </div>
  );
}
