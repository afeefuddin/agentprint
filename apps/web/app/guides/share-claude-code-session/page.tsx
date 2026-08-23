import type { Metadata } from "next";
import { SeoContentPage } from "@/components/seo-content-page";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "How to share a Claude Code session safely",
  description: "Create a local preview, redact sensitive values, and publish one Claude Code CLI session with a revocable Agentprint link.",
  alternates: { canonical: absoluteUrl("/guides/share-claude-code-session") }
};

export default function ShareClaudeSessionGuide() {
  return <SeoContentPage
    eyebrow="Claude Code session guide"
    title="Turn one Claude Code session into a link you control."
    intro="Choose a local Claude Code session, inspect the redacted result on your machine, and publish it as unlisted, friends-only, or public. Background collection remains metadata-only."
    agent="claude"
    mode="sharing"
    outcomeTitle="Show the work behind the result."
    outcomeBody="A shared session can preserve the useful arc of a debugging or building run without quietly turning every local conversation into cloud content."
    steps={[
      { title: "Find the session", body: "Agentprint reads recent Claude Code sessions locally and presents a short list you can inspect.", command: "agentprint sessions" },
      { title: "Review the redacted render", body: "Dry run opens the HTML preview and writes the exact JSON payload without contacting the publish endpoint.", command: "agentprint share 2 --harness claude-code --dry-run --redact strict" },
      { title: "Publish, update, or revoke", body: "Choose visibility at publish time. Re-sharing the same session updates its existing URL; unshare deletes it.", command: "agentprint share 2 --visibility unlisted" }
    ]}
    principles={[
      { title: "Local inspection", body: "Prompts, responses, and tool blocks are transformed on the machine where the Claude Code session lives." },
      { title: "Closed payload shape", body: "The share contract accepts a bounded vocabulary of transcript blocks and rejects unknown fields." },
      { title: "Visibility is explicit", body: "New shares default to unlisted and only appear on a public profile after you intentionally make them public." }
    ]}
    faqs={[
      { question: "Is this the same as Claude Code sharing on the web?", answer: "No. Agentprint focuses on local CLI session discovery, local redaction preview, visibility controls, and a profile that can combine activity across supported coding agents." },
      { question: "Does normal Claude Code tracking include prompts?", answer: "No. Normal sync uses numeric usage metadata such as date, token counts, harness, and model. Its contract does not accept prompt, response, source-code, repository, or path fields." },
      { question: "Which redaction level should I use?", answer: "Strict is the safest starting point because it omits tool arguments, tool output, and agent reasoning. Balanced and full preserve more context, so they require more careful preview review." },
      { question: "Can I delete a published session?", answer: "Yes. agentprint unshare hard-deletes the shared transcript. The published URL then stops resolving." }
    ]}
    related={[
      { href: "/integrations/claude-code", label: "Claude Code usage tracking", detail: "Understand the metadata-only activity flow." },
      { href: "/guides/share-codex-session", label: "Share a Codex session", detail: "Use the same deliberate workflow with Codex." },
      { href: "/docs/getting-started", label: "Install Agentprint", detail: "Connect your first machine in a few commands." }
    ]}
  />;
}
