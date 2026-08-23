import type { Metadata } from "next";
import { SeoContentPage } from "@/components/seo-content-page";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "How to share a Codex session safely",
  description: "Preview, redact, and share one Codex CLI session with Agentprint. Review it locally before anything is published.",
  alternates: { canonical: absoluteUrl("/guides/share-codex-session") }
};

export default function ShareCodexSessionGuide() {
  return <SeoContentPage
    eyebrow="Codex session guide"
    title="Share a Codex session without sharing your whole machine."
    intro="Agentprint finds your Codex sessions, creates a readable preview on your device, hides likely credentials and private locations, then publishes only the session you choose."
    agent="codex"
    mode="sharing"
    proof={[
      { value: "Exact preview", label: "Review the prepared payload" },
      { value: "Checked twice", label: "Local and server safeguards" },
      { value: "Unlisted", label: "The default sharing audience" }
    ]}
    outcomeTitle="A deliberate link, not a background recording."
    outcomeBody="Automatic activity tracking never includes your conversations. Sharing is a separate choice you make for one session at a time."
    steps={[
      { title: "List local Codex sessions", body: "Review recent sessions by time and title. Nothing is uploaded while you browse the list.", command: "agentprint sessions" },
      { title: "Open the local preview", body: "A dry run shows exactly what will be shared without publishing anything. Read it before you continue.", command: "agentprint share 3 --dry-run" },
      { title: "Publish with the right visibility", body: "Shares start unlisted unless you explicitly choose public or friends-only visibility. You can revoke the link later.", command: "agentprint share 3 --visibility unlisted" }
    ]}
    principles={[
      { title: "Preview before sharing", body: "You must open the local preview before Agentprint asks you to publish the session." },
      { title: "Sensitive details are checked twice", body: "Agentprint hides likely credentials on your machine and checks again before publishing." },
      { title: "Delete it whenever you want", body: "Run agentprint unshare with the share ID to permanently delete the session and disable its link." }
    ]}
    faqs={[
      { question: "Does Agentprint share every Codex conversation?", answer: "No. Automatic activity tracking never includes conversations. A session is only shared when you explicitly choose it and run agentprint share." },
      { question: "What does redaction remove?", answer: "Credential-shaped values are replaced, home and project paths are rewritten, images are dropped, and long tool output is truncated. Strict mode also omits tool arguments, tool output, and agent reasoning." },
      { question: "Can redaction guarantee that every secret is gone?", answer: "No automated check can promise that. Agentprint checks for likely credentials twice, but you should still read the local preview before publishing." },
      { question: "Will the link appear in search results?", answer: "Unlisted and friends-only sessions do not appear in search results. Only sessions you deliberately make public may be discoverable." }
    ]}
    related={[
      { href: "/integrations/codex", label: "Codex activity tracking", detail: "See what Agentprint tracks automatically." },
      { href: "/guides/share-claude-code-session", label: "Share a Claude Code session", detail: "The equivalent workflow for Claude Code." },
      { href: "/privacy#sharing", label: "Session-sharing privacy", detail: "See what is and is not shared." }
    ]}
  />;
}
