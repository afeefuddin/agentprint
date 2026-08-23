import type { Metadata } from "next";
import { SeoContentPage } from "@/components/seo-content-page";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "How to share a Codex session safely",
  description: "Preview, redact, and share one Codex CLI session with Agentprint. See the exact payload locally before anything is uploaded.",
  alternates: { canonical: absoluteUrl("/guides/share-codex-session") }
};

export default function ShareCodexSessionGuide() {
  return <SeoContentPage
    eyebrow="Codex session guide"
    title="Share a Codex session without sharing your whole machine."
    intro="Agentprint finds local Codex sessions, creates a readable preview on your device, removes credential-shaped values and local paths, then publishes only the session you choose."
    agent="codex"
    mode="sharing"
    outcomeTitle="A deliberate link, not a background recording."
    outcomeBody="Background activity sync only accepts numeric metadata. Transcript sharing is a separate command, a separate payload, and a choice you make one session at a time."
    steps={[
      { title: "List local Codex sessions", body: "Review recent sessions by time and title. Nothing is uploaded while you browse the list.", command: "agentprint sessions" },
      { title: "Open the exact local preview", body: "A dry run writes the rendered preview and serialized payload locally. Read both before you publish.", command: "agentprint share 3 --dry-run" },
      { title: "Publish with the right visibility", body: "Shares start unlisted unless you explicitly choose public or friends-only visibility. You can revoke the link later.", command: "agentprint share 3 --visibility unlisted" }
    ]}
    principles={[
      { title: "Preview before consent", body: "The publish confirmation is gated behind the local preview, so the actual rendered session is visible before upload." },
      { title: "Redaction in depth", body: "The CLI rewrites the session locally and the server scans the submitted payload again for apparent live credentials." },
      { title: "Revocable by design", body: "Run agentprint unshare with the share id to hard-delete the published transcript and break its link." }
    ]}
    faqs={[
      { question: "Does Agentprint upload every Codex conversation?", answer: "No. Background sync cannot accept transcript fields. Content enters the sharing pipeline only when you explicitly run agentprint share for one selected session." },
      { question: "What does redaction remove?", answer: "Credential-shaped values are replaced, home and project paths are rewritten, images are dropped, and long tool output is truncated. Strict mode also omits tool arguments, tool output, and agent reasoning." },
      { question: "Can redaction guarantee that every secret is gone?", answer: "No automated detector can promise that. Agentprint shows the exact local preview for human review and adds a server-side credential scan, but you should still read the preview before publishing." },
      { question: "Will the link appear in search results?", answer: "Unlisted and friends-only shares are marked noindex and excluded from the sitemap. Only sessions deliberately set to public are eligible for discovery." }
    ]}
    related={[
      { href: "/integrations/codex", label: "Codex activity tracking", detail: "See what normal metadata sync records." },
      { href: "/guides/share-claude-code-session", label: "Share a Claude Code session", detail: "The equivalent workflow for Claude Code." },
      { href: "/privacy#sharing", label: "Session-sharing privacy", detail: "Read the product boundary in plain language." }
    ]}
  />;
}
