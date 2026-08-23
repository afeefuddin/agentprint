import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "How to share a Kimi Code session safely",
  description: "Preview, redact, and share one Kimi Code session with an unlisted, friends-only, or public Agentprint link.",
  alternates: { canonical: absoluteUrl("/guides/share-kimi-code-session") }
};

export default function ShareKimiCodeSessionPage() {
  return <ContentPage
    eyebrow="Kimi Code session guide"
    title="Share one Kimi Code session after you have seen the final payload."
    intro="Agentprint finds local Kimi Code sessions, prepares a readable redacted preview on your machine, and publishes only the session and audience you choose."
    qualifier="Session sharing is separate from automatic activity tracking. Your other Kimi Code conversations are not included."
    agent="kimi"
    mode="sharing"
    proof={[
      { value: "One session", label: "Selected from local history" },
      { value: "Local preview", label: "Required before confirmation" },
      { value: "Revocable", label: "Delete the session and disable its link" }
    ]}
    outcomeTitle="Preserve a useful build story without publishing your history."
    outcomeBody="A shared Kimi Code session can document the decisions behind a fix or feature while remaining separate from background activity collection and every other project."
    steps={[
      { title: "List recent Kimi Code sessions", body: "Browse locally discovered sessions by title and time. Listing them does not upload transcript content.", command: "agentprint sessions --harness kimi-code" },
      { title: "Open the exact local preview", body: "Use a dry run to inspect the serialized payload, rewritten paths, removed images, and redaction markers before publishing.", command: "agentprint share 2 --harness kimi-code --dry-run" },
      { title: "Choose the audience", body: "Keep the link unlisted, limit it to accepted friends, or make it public on your profile. You can revoke it later.", command: "agentprint share 2 --visibility unlisted" }
    ]}
    principles={[
      { title: "Background sync stays numeric", body: "Normal Kimi Code activity tracking never includes prompts, replies, source code, repository names, or paths." },
      { title: "The preview is the payload", body: "The local review represents the escaped data prepared for publishing, rather than a simplified transcript-only mockup." },
      { title: "More context means more review", body: "Strict mode removes the most detail. Balanced and full modes preserve more of the session and require closer inspection." }
    ]}
    faqs={[
      { question: "Does Agentprint support Kimi Code session sharing?", answer: "Yes. Kimi Code has a supported local session reader, and a selected session can use the same preview, redaction, visibility, and revocation workflow as other supported readers." },
      { question: "Will Kimi Code conversations be uploaded during normal sync?", answer: "No. Automatic activity sync and transcript sharing are separate pipelines. Normal sync only accepts numeric activity metadata." },
      { question: "Can automated redaction guarantee that nothing sensitive remains?", answer: "No automated detector can make that promise. The local preview is required so you can read the final payload before deciding to publish it." },
      { question: "How do I remove a shared Kimi Code session?", answer: "Run agentprint shares to find the published item, then agentprint unshare with its ID. Deletion disables the link." }
    ]}
    related={[
      { href: "/integrations/kimi-code", label: "Track Kimi Code activity", detail: "See the numeric background-sync boundary." },
      { href: "/security/session-redaction", label: "How redaction works", detail: "Inspect the checks applied before publishing." },
      { href: "/guides/share-codex-session", label: "Share a Codex session", detail: "Follow the equivalent Codex workflow." }
    ]}
  />;
}
