import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Agentprint session sharing",
  description: "Turn one selected coding-agent session into a readable, redacted link with a local preview and revocable visibility controls.",
  alternates: { canonical: absoluteUrl("/product/session-sharing") }
};

export default function ProductSessionSharingPage() {
  return <ContentPage
    eyebrow="Agentprint session sharing"
    title="Share the session. Keep the rest private."
    intro="Agentprint turns one coding-agent session into a readable link. You choose the session, inspect the prepared version on your machine, choose who can open it, and keep every other session private."
    qualifier="Redaction looks for common sensitive details, but no automated check can promise that every secret is gone. The local preview is there for you to read before publishing."
    agent="agentprint"
    mode="sharing"
    heroVariant="product"
    parent={null}
    secondaryCtaLabel="See what gets shared"
    sectionEyebrow="From session to link"
    principlesEyebrow="The sharing boundary"
    principlesTitle="A publishing tool, not a background recorder."
    proof={[
      { value: "One session", label: "Selected from your local history" },
      { value: "Preview first", label: "Read the prepared session before publishing" },
      { value: "Revocable", label: "Remove the session and disable its link" }
    ]}
    outcomeTitle="A readable record of how the work happened."
    outcomeBody="A finished feature or fix rarely shows the reasoning behind it. Session sharing preserves that useful story without turning your full coding-agent history into public content."
    steps={[
      { title: "Choose the session", body: "Browse the supported sessions found on your machine and select the one that tells the story you want to share." },
      { title: "Review the prepared version", body: "Agentprint creates a local preview, replaces likely credentials, rewrites private paths, removes images, and trims long output before anything is published." },
      { title: "Choose who can open it", body: "Keep the link unlisted, limit it to accepted friends, or make it public on your profile." },
      { title: "Update it or take it down", body: "Share the same session again to update its link, or revoke it to permanently remove the published copy." }
    ]}
    principles={[
      { title: "Sharing is always deliberate", body: "Automatic activity tracking never turns your conversations into published sessions." },
      { title: "The preview stays on your machine", body: "You see the prepared session before Agentprint asks whether you want to publish it." },
      { title: "The audience is explicit", body: "New shares begin unlisted. Public and friends-only visibility require a choice from you." }
    ]}
    faqs={[
      { question: "What is Agentprint session sharing?", answer: "It is a way to publish one selected coding-agent session as a readable link after reviewing a redacted preview on your machine." },
      { question: "Does Agentprint upload every coding-agent conversation?", answer: "No. Normal activity collection does not include conversations. A session is only prepared for publishing after you select it and start the sharing flow." },
      { question: "Which coding agents support session sharing?", answer: "Agentprint supports sharing selected Claude Code, Codex, and Kimi Code sessions. OpenCode activity can appear on your profile, but OpenCode session sharing is not currently supported." },
      { question: "Can I remove a shared session?", answer: "Yes. Revoking a share permanently removes the published session and disables its link." }
    ]}
    related={[
      { href: "/product/profile", label: "Agentprint profile", detail: "See the complete activity profile." },
      { href: "/guides/share-codex-session", label: "Share a Codex session", detail: "Follow the complete preview and publishing workflow." },
      { href: "/security/session-redaction", label: "Session redaction", detail: "Understand what the preview checks and removes." }
    ]}
  />;
}
