import type { Metadata } from "next";
import { SeoContentPage } from "@/components/seo-content-page";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Getting started with Agentprint",
  description: "Install the Agentprint CLI, connect a machine, sync supported coding-agent activity, and choose what appears on your profile.",
  alternates: { canonical: absoluteUrl("/docs/getting-started") }
};

export default function GettingStartedPage() {
  return <SeoContentPage
    eyebrow="Getting started"
    title="From local agent logs to your first activity field."
    intro="Install one small collector, connect it with a device code, and let Agentprint build a private profile from numeric activity metadata. You choose when it becomes public."
    agent="agentprint"
    mode="setup"
    outcomeTitle="Connected in a few deliberate steps."
    outcomeBody="The collector supports macOS, Linux, and Windows, discovers supported coding agents locally, and keeps its connection visible and revocable."
    steps={[
      { title: "Create your profile", body: "Sign in with GitHub or Google, choose your handle, and keep the profile private while you set it up." },
      { title: "Install and connect the CLI", body: "Use the installer shown during onboarding, then complete the browser device-code flow.", command: "agentprint login" },
      { title: "Check detected sources", body: "Confirm which local harnesses Agentprint found and run an immediate sync.", command: "agentprint sources && agentprint sync" },
      { title: "Choose what visitors see", body: "Publish the profile only when ready. Tokens, harnesses, models, and streaks each have their own visibility control." }
    ]}
    principles={[
      { title: "Supported sources", body: "Background tracking supports Claude Code, Codex, OpenCode, and Kimi Code. Session sharing currently supports Claude Code, Codex, and Kimi Code." },
      { title: "Inspectable health", body: "agentprint status shows the queue, last sync, and detected sources. Devices and their last activity are also visible in settings." },
      { title: "Easy exit", body: "Pause collection, revoke a device, export your data, delete a share, or delete the account without losing control of the boundary." }
    ]}
    faqs={[
      { question: "Which operating systems are supported?", answer: "The release installer provides builds for macOS, Linux, and Windows on amd64 and arm64 where available." },
      { question: "Which coding agents can Agentprint track?", answer: "The background collector supports Claude Code, Codex, OpenCode, and Kimi Code. OpenCode session transcript sharing is not supported yet." },
      { question: "Will installing Agentprint upload old prompts?", answer: "No. Background usage sync does not have transcript fields. Sharing content requires a separate explicit share command for one selected session." },
      { question: "How do I verify collection is working?", answer: "Run agentprint status for local health and review the device and source state in Agentprint settings after the first sync." }
    ]}
    related={[
      { href: "/integrations/claude-code", label: "Claude Code integration", detail: "Understand its activity and privacy model." },
      { href: "/integrations/codex", label: "Codex integration", detail: "See how Codex records become activity." },
      { href: "/privacy", label: "Privacy policy", detail: "Read what is collected, shared, retained, and controlled." }
    ]}
  />;
}
