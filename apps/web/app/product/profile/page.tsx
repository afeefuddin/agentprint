import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Agentprint profile for coding-agent work",
  description: "Bring activity from Claude Code, Codex, OpenCode, and Kimi Code into one profile with a shareable URL and visibility controls.",
  alternates: { canonical: absoluteUrl("/product/profile") }
};

export default function ProductProfilePage() {
  return <ContentPage
    eyebrow="Agentprint profile"
    title="Your coding-agent work, in one profile."
    intro="Agentprint brings your activity from Claude Code, Codex, OpenCode, and Kimi Code into one recognizable profile. See the longer arc of your work, then decide what anyone else can see."
    qualifier="The profile shows activity and practice. It does not grade your work, inspect your code, or claim that more tokens mean better engineering."
    agent="agentprint"
    mode="profile"
    heroVariant="product"
    parent={null}
    secondaryCtaLabel="See what is in the profile"
    sectionEyebrow="Inside the profile"
    principlesEyebrow="Your profile, your call"
    principlesTitle="Public when you want it. Specific about what appears."
    proof={[
      { value: "One profile", label: "Claude Code, Codex, OpenCode, and Kimi Code" },
      { value: "One year", label: "A daily view of your agent activity" },
      { value: "Your choice", label: "Each public metric can be shown or hidden" }
    ]}
    outcomeTitle="A home for work that usually disappears into terminals."
    outcomeBody="Individual sessions are easy to forget and hard to explain. Your Agentprint profile turns their activity into a durable history you can keep private or share with one URL."
    steps={[
      { title: "A living activity history", body: "See when you worked with coding agents across the last year, with lifetime totals and streaks that make consistency visible." },
      { title: "Your tools in one place", body: "See how your work is distributed across supported coding agents instead of checking a separate dashboard for every tool." },
      { title: "The models behind the work", body: "Understand which models appear most often in your activity and how that mix changes over time." },
      { title: "Context when the numbers are not enough", body: "Add selected public sessions to the profile when you want people to see the decisions and process behind a result." }
    ]}
    principles={[
      { title: "Private from the start", body: "You can build and review the profile before making it public." },
      { title: "Separate visibility controls", body: "Show your tool mix without showing token totals, or share streaks while keeping model activity private." },
      { title: "Conversations stay separate", body: "Normal profile activity does not include prompts, replies, source code, repository names, or local paths." }
    ]}
    faqs={[
      { question: "What is an Agentprint profile?", answer: "It is a personal activity page for the work you do with supported coding agents. It can show your activity history, token totals, coding-agent mix, model mix, streaks, and sessions you deliberately publish." },
      { question: "Which coding agents can appear on the profile?", answer: "Agentprint currently supports activity from Claude Code, Codex, OpenCode, and Kimi Code. Session-sharing support differs by coding agent." },
      { question: "Does the profile publish my prompts or source code?", answer: "No. Normal activity collection excludes prompts, responses, source code, repository names, and local paths. Sharing a selected session is a separate action." },
      { question: "Can I make the profile private again?", answer: "Yes. You can change the whole profile's visibility and the visibility of individual metric groups from settings." }
    ]}
    related={[
      { href: "/product/session-sharing", label: "Session sharing", detail: "Show the work behind one result." },
      { href: "/integrations/claude-code", label: "Supported coding agents", detail: "See what Agentprint can track for each tool." },
      { href: "/privacy/what-agentprint-collects", label: "What Agentprint collects", detail: "Review what stays outside normal activity collection." }
    ]}
  />;
}
