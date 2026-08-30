import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "How to share a Claude Code session safely",
  description: "Create a local preview, redact sensitive values, and publish one Claude Code CLI session with a revocable Agentprint link.",
  alternates: { canonical: absoluteUrl("/guides/share-claude-code-session") }
};

export default function ShareClaudeSessionGuide() {
  return <ContentPage
    eyebrow="Claude Code session guide"
    title="Turn one Claude Code session into a link you control."
    intro="Choose a Claude Code session, review what will be shared on your machine, and publish it as unlisted, friends-only, or public. Your other sessions stay private."
    agent="claude"
    mode="sharing"
    proof={[
      { value: "One session", label: "Chosen from local history" },
      { value: "Strict mode", label: "Safer starting redaction" },
      { value: "Revocable", label: "Delete it and disable the link" }
    ]}
    outcomeTitle="Show the work behind the result."
    outcomeBody="A shared session can preserve the useful arc of a debugging or building run without sharing your other conversations."
    steps={[
      { title: "Find the session", body: "Agentprint reads recent Claude Code sessions locally and presents a short list you can inspect.", command: "agentprint sessions" },
      { title: "Review before sharing", body: "Dry run opens a local preview without publishing anything.", command: "agentprint share 2 --harness claude-code --dry-run --redact strict" },
      { title: "Publish, update, or revoke", body: "Choose visibility at publish time. Re-sharing the same session updates its existing URL; unshare deletes it.", command: "agentprint share 2 --visibility unlisted" }
    ]}
    principles={[
      { title: "Review it on your machine", body: "Agentprint prepares the session locally so you can see the result before sharing it." },
      { title: "Only the chosen session", body: "Sharing one session does not include your other conversations or projects." },
      { title: "Visibility is explicit", body: "New shares default to unlisted and only appear on a public profile after you intentionally make them public." }
    ]}
    faqs={[
      { question: "Is this the same as Claude Code sharing on the web?", answer: "No. Agentprint focuses on local CLI session discovery, local redaction preview, visibility controls, and a profile that can combine activity across supported coding agents." },
      { question: "Does automatic Claude Code tracking include prompts?", answer: "No. It records activity totals such as dates, token counts, and models—not prompts, responses, source code, repository names, or paths." },
      { question: "Which redaction level should I use?", answer: "Strict is the safest starting point because it omits tool arguments, tool output, and agent reasoning. Balanced and full preserve more context, so they require more careful preview review." },
      { question: "Can I delete a published session?", answer: "Yes. Run agentprint unshare to permanently delete it and disable its link." }
    ]}
    related={[
      { href: "/integrations/claude-code", label: "Claude Code usage tracking", detail: "See what Agentprint tracks automatically." },
      { href: "/guides/share-codex-session", label: "Share a Codex session", detail: "Use the same deliberate workflow with Codex." },
      { href: "/product/session-sharing", label: "Session sharing", detail: "See how selected sessions become controlled links." }
    ]}
  />;
}
