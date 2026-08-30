import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Public AI coding profile for developers",
  description: "Build a public developer profile from coding-agent activity, choose which metrics are visible, and share selected redacted sessions.",
  alternates: { canonical: absoluteUrl("/use-cases/developer-ai-profile") }
};

export default function DeveloperAiProfilePage() {
  return <ContentPage
    eyebrow="Developer AI profile"
    title="Give your agent-assisted work a home beyond scattered terminals."
    intro="Agentprint turns a private cross-agent activity history into a recognizable developer profile with a shareable URL, live profile card, and optional published sessions."
    qualifier="Your profile is proof of activity and practice—not a certification, leaderboard score, or claim that tokens equal impact."
    agent="agentprint"
    mode="profile"
    parent={{ href: "/use-cases/ai-coding-activity-tracker", label: "Use cases" }}
    proof={[
      { value: "One URL", label: "A profile that travels with your work" },
      { value: "4 controls", label: "Tokens, agents, models, and streaks" },
      { value: "Optional", label: "Public sessions are published separately" }
    ]}
    outcomeTitle="Make the practice legible without exposing every project."
    outcomeBody="A profile can communicate consistency, tool range, and model choice while leaving prompts, source code, repositories, and private paths outside automatic collection."
    steps={[
      { title: "Build the private history first", body: "Connect supported coding agents and review your own activity before making any part of the profile public.", command: "agentprint sync" },
      { title: "Choose the visible metric groups", body: "Enable or hide token totals, coding-agent mix, model ranking, and streaks independently from profile settings." },
      { title: "Share one recognizable URL", body: "Use the public profile on a portfolio, GitHub README, social bio, application, or anywhere you explain how you build with agents." },
      { title: "Add the work behind a result when useful", body: "Publish a selected redacted session separately when the reasoning arc matters more than the aggregate profile." }
    ]}
    principles={[
      { title: "Private before public", body: "New profiles remain private through setup, giving you time to inspect the activity and visibility controls first." },
      { title: "Metrics remain independent", body: "You can show the coding agents you use without showing token totals, or share streaks without exposing model mix." },
      { title: "Sessions stay deliberate", body: "A public profile never turns background collection into automatic transcript publishing." }
    ]}
    faqs={[
      { question: "What appears on an Agentprint developer profile?", answer: "Your chosen display identity and whichever activity groups you enable: token totals, coding-agent mix, model mix, streaks, and deliberately public sessions." },
      { question: "Can I use the profile in a GitHub README?", answer: "Yes. Agentprint provides a live profile card and public URL designed to travel with your existing developer presence." },
      { question: "Does Agentprint verify code quality or authorship?", answer: "No. It presents activity derived from supported local records. It does not certify code quality, repository ownership, productivity, or professional ability." },
      { question: "Can I make the profile private again?", answer: "Yes. Profile visibility and each metric group can be changed from settings. Public sessions retain their own separate visibility and deletion controls." }
    ]}
    related={[
      { href: "/use-cases/ai-coding-activity-tracker", label: "AI coding activity tracker", detail: "Build the underlying cross-agent history." },
      { href: "/privacy/what-agentprint-collects", label: "What Agentprint collects", detail: "Inspect the automatic activity boundary." },
      { href: "/product/session-sharing", label: "Session sharing", detail: "Add a selected work story to the profile." }
    ]}
  />;
}
