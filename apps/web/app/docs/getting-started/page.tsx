import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Getting started with Agentprint",
  description: "Install the Agentprint CLI, connect a machine, sync supported coding-agent activity, and choose what appears on your profile.",
  alternates: { canonical: absoluteUrl("/docs/getting-started") }
};

export default function GettingStartedPage() {
  return <ContentPage
    eyebrow="Getting started"
    title="From coding activity to your first Agentprint profile."
    intro="Install Agentprint, connect your machine, and build a private profile from your coding activity. You choose when it becomes public."
    agent="agentprint"
    mode="setup"
    outcomeTitle="Connected in a few deliberate steps."
    outcomeBody="Agentprint supports macOS, Linux, and Windows, finds supported coding tools, and lets you disconnect a machine whenever you want."
    steps={[
      { title: "Create your profile", body: "Sign in with GitHub or Google, choose your handle, and keep the profile private while you set it up." },
      { title: "Install and connect Agentprint", body: "Use the installer shown during onboarding, then finish signing in through your browser.", command: "agentprint login" },
      { title: "Check your coding tools", body: "Confirm which supported tools Agentprint found and update your activity.", command: "agentprint sources && agentprint sync" },
      { title: "Choose what visitors see", body: "Publish the profile only when ready. Tokens, coding tools, models, and streaks each have their own visibility control." }
    ]}
    principles={[
      { title: "Supported sources", body: "Background tracking supports Claude Code, Codex, OpenCode, and Kimi Code. Session sharing currently supports Claude Code, Codex, and Kimi Code." },
      { title: "Easy to check", body: "agentprint status shows whether Agentprint is connected and which coding tools it found. Your connected devices also appear in settings." },
      { title: "Easy to leave", body: "Pause updates, remove a device, export your data, delete a shared session, or delete your account whenever you want." }
    ]}
    faqs={[
      { question: "Which operating systems are supported?", answer: "Agentprint supports macOS, Linux, and Windows on common Intel, AMD, and Arm computers." },
      { question: "Which coding agents can Agentprint track?", answer: "Agentprint supports Claude Code, Codex, OpenCode, and Kimi Code. Sharing OpenCode sessions is not supported yet." },
      { question: "Will installing Agentprint share old prompts?", answer: "No. Automatic activity tracking never includes conversations. A session is only shared when you explicitly choose it and run agentprint share." },
      { question: "How do I check that Agentprint is working?", answer: "Run agentprint status, then review your connected device and coding tools in Agentprint settings." }
    ]}
    related={[
      { href: "/integrations/claude-code", label: "Claude Code integration", detail: "See how Agentprint tracks Claude Code activity." },
      { href: "/integrations/codex", label: "Codex integration", detail: "See how Agentprint tracks Codex activity." },
      { href: "/privacy", label: "Privacy policy", detail: "Read what is collected, shared, retained, and controlled." }
    ]}
  />;
}
