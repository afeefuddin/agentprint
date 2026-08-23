import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "How Agentprint session redaction works",
  description: "Understand Agentprint local session previews, credential checks, path rewriting, redaction levels, server validation, and their limitations.",
  alternates: { canonical: absoluteUrl("/security/session-redaction") }
};

export default function SessionRedactionPage() {
  return <ContentPage
    eyebrow="Session redaction"
    title="Redaction is a review layer, not a promise that secrets cannot exist."
    intro="Before Agentprint publishes a selected coding session, it rewrites likely credentials and private paths locally, removes unsupported media, and shows you the exact prepared payload."
    qualifier="Automated detection is defense in depth. You remain responsible for reading the local preview before publishing a session."
    agent="agentprint"
    mode="sharing"
    parent={{ href: "/guides", label: "Guides" }}
    proof={[
      { value: "Local first", label: "Redaction happens before upload" },
      { value: "2 checks", label: "CLI preparation and server rejection" },
      { value: "3 levels", label: "Strict, balanced, and full" }
    ]}
    outcomeTitle="Make the final payload inspectable before it leaves your machine."
    outcomeBody="The safest sharing decision comes from combining conservative automated rewriting with an exact local preview and a separate confirmation step."
    steps={[
      { title: "Select one supported session", body: "Agentprint reads only the session you choose from a supported local reader. Browsing the list does not publish anything.", command: "agentprint sessions" },
      { title: "Apply the chosen redaction level", body: "Credential-shaped values become visible markers, home and project paths are rewritten, images are removed, and long output is truncated. Strict mode also omits tool details and reasoning." },
      { title: "Open the exact local preview", body: "Dry run writes and opens the escaped serialized payload so you can review the real data prepared for the API.", command: "agentprint share 3 --dry-run --redact strict" },
      { title: "Confirm, validate, and publish", body: "After confirmation, the server checks uploadable strings again and rejects payloads that still resemble credentials." }
    ]}
    principles={[
      { title: "Preview failure stops confirmation", body: "If Agentprint cannot open the local preview, it does not silently continue into an interactive publish confirmation." },
      { title: "All uploadable strings matter", body: "Checks cover titles, summaries, harness and model metadata, turn content, tool identifiers, inputs, and outputs—not only the visible transcript body." },
      { title: "Deletion remains part of safety", body: "Published sessions have stable share IDs and can be permanently removed with agentprint unshare." }
    ]}
    faqs={[
      { question: "Can Agentprint guarantee that every secret is redacted?", answer: "No. Automated matching can miss unexpected formats or sensitive context that does not resemble a credential. Always read the exact local preview before publishing." },
      { question: "What is different about strict mode?", answer: "Strict mode preserves user and assistant text while omitting tool arguments, tool output, and agent reasoning. It is the safest starting point for a public example." },
      { question: "Why check the payload again on the server?", answer: "The server is a backstop for uploadable data. It prevents a client regression or older client from publishing strings that match known credential shapes." },
      { question: "Can I inspect without uploading?", answer: "Yes. The dry-run command prepares and opens the local preview, then exits without publishing." }
    ]}
    related={[
      { href: "/guides", label: "Session sharing guides", detail: "Follow a tool-specific walkthrough." },
      { href: "/privacy/what-agentprint-collects", label: "What Agentprint collects", detail: "Separate background activity from explicit sharing." },
      { href: "/privacy", label: "Privacy policy", detail: "Read the complete product privacy explanation." }
    ]}
  />;
}
