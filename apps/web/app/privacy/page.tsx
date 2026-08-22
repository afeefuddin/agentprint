import type { Metadata } from "next";
import Link from "next/link";
import { EyeOff, LockKeyhole, Share2 } from "lucide-react";
import { viewer } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { eyebrowClass } from "@/lib/ui";

const SECTION =
  "grid grid-cols-[190px_minmax(0,1fr)] gap-12 border-t border-line py-9 max-tablet:grid-cols-[1fr] max-tablet:gap-4 max-tablet:py-8";
const SECTION_TITLE = "m-0 text-[22px] font-[weight:540] tracking-[-.025em] text-ink-strong";
const COPY = "m-0 text-base leading-[1.7] text-muted";
const LIST = "m-0 grid gap-3 pl-5 text-base leading-[1.65] text-muted marker:text-blue";

const assurances = [
  {
    icon: EyeOff,
    title: "No work content",
    copy: "Background sync does not collect prompts, responses, source code, or files."
  },
  {
    icon: LockKeyhole,
    title: "Private by default",
    copy: "You decide whether your profile, metrics, or friend comparisons are visible."
  },
  {
    icon: Share2,
    title: "Sharing is deliberate",
    copy: "A transcript is uploaded only when you choose one session and confirm it."
  }
];

export const metadata: Metadata = {
  title: "Privacy",
  description: "How Agentprint collects, uses, and protects your information."
};

export default async function PrivacyPage() {
  const current = await viewer();

  return (
    <>
      <SiteHeader current={current} variant="marketing" />
      <main id="main" className="shell pb-[var(--page-bottom)] pt-[var(--page-top)]">
        <header className="max-w-[780px]">
          <span className={eyebrowClass}>Privacy</span>
          <h1 className="mb-6 mt-4 text-[clamp(48px,6vw,72px)] font-[weight:520] leading-[.96] tracking-[-.06em] text-ink-strong max-tablet:text-[48px]">
            Your work stays yours.
          </h1>
          <p className="m-0 max-w-[680px] text-md leading-[1.65] text-muted">
            Agentprint measures how you use coding agents without reading what you build with them. We collect the minimum information needed to sync your activity and create the profile you control.
          </p>
          <p className="mt-5 text-xs text-faint">Last updated August 22, 2026</p>
        </header>

        <section
          className="mt-12 grid grid-cols-3 overflow-hidden rounded-md border border-line bg-panel max-desktop:grid-cols-[1fr]"
          aria-label="Privacy at a glance"
        >
          {assurances.map(({ icon: Icon, title, copy }) => (
            <div
              className="grid grid-cols-[auto_1fr] items-start gap-4 border-r border-line p-6 last:border-r-0 max-desktop:border-b max-desktop:border-r-0 max-desktop:last:border-b-0 max-tablet:p-5"
              key={title}
            >
              <span className="grid size-9 place-items-center rounded-full border border-line bg-canvas text-blue" aria-hidden="true">
                <Icon size={16} />
              </span>
              <span>
                <b className="block text-base font-[weight:540] text-ink-strong">{title}</b>
                <small className="mt-1.5 block text-sm leading-[1.5] text-muted">{copy}</small>
              </span>
            </div>
          ))}
        </section>

        <div className="mx-auto mt-16 max-w-[920px]">
          <section className={SECTION} aria-labelledby="collect-title">
            <h2 id="collect-title" className={SECTION_TITLE}>What we collect</h2>
            <div className="grid gap-5">
              <p className={COPY}>We collect only the information needed to operate Agentprint:</p>
              <ul className={LIST}>
                <li>Account information such as your name, handle, email from your sign-in provider, timezone, and profile settings.</li>
                <li>Usage metadata such as dates, token counts, estimated cost, and the coding agent or model involved.</li>
                <li>Device and source identifiers needed to sync reliably and prevent duplicate activity.</li>
              </ul>
            </div>
          </section>

          <section className={SECTION} aria-labelledby="never-title">
            <h2 id="never-title" className={SECTION_TITLE}>What sync leaves alone</h2>
            <div className="grid gap-5">
              <p className={COPY}>Normal background sync does not collect the content of your work.</p>
              <ul className={LIST}>
                <li>No prompts or agent responses.</li>
                <li>No source code, file contents, repository names, or local paths.</li>
                <li>No shell history, API keys, passwords, or other credentials.</li>
              </ul>
            </div>
          </section>

          <section className={SECTION} id="sharing" aria-labelledby="sharing-title">
            <h2 id="sharing-title" className={SECTION_TITLE}>Shared sessions</h2>
            <div className="grid gap-5">
              <p className={COPY}>
                Session sharing is separate from background sync. It can include prompts, responses, and tool output, but only for the specific session you choose to publish.
              </p>
              <p className={COPY}>
                Agentprint previews and redacts the session on your device before upload. New shares begin as unlisted, and you can change their visibility or delete them at any time. Redaction helps, but you should still read the preview before publishing.
              </p>
            </div>
          </section>

          <section className={SECTION} aria-labelledby="use-title">
            <h2 id="use-title" className={SECTION_TITLE}>How we use information</h2>
            <div className="grid gap-5">
              <p className={COPY}>We use your information to authenticate your account, sync activity, build the views you request, provide support, and keep Agentprint reliable and secure.</p>
              <p className={COPY}>We do not sell personal information or use it for targeted advertising. We share information only with service providers needed to run Agentprint, when you direct us to share it, or when required by law.</p>
            </div>
          </section>

          <section className={SECTION} aria-labelledby="control-title">
            <h2 id="control-title" className={SECTION_TITLE}>Your controls</h2>
            <div className="grid gap-5">
              <p className={COPY}>You control whether your profile is public, which metrics appear, and whether friends can compare activity with you. You can also revoke devices, export your data, delete shared sessions, or delete your account.</p>
              <Link className="w-fit border-b border-line-strong text-base font-[weight:540] text-ink-strong hover:border-blue hover:text-blue" href="/settings#visibility">
                Review your privacy settings
              </Link>
            </div>
          </section>

          <section className={SECTION} aria-labelledby="retention-title">
            <h2 id="retention-title" className={SECTION_TITLE}>Retention and security</h2>
            <div className="grid gap-5">
              <p className={COPY}>We keep account and usage information while your account is active and as needed to provide the service. Deleting your account removes your active server-side data, including shared sessions, subject to limited security, backup, or legal retention requirements.</p>
              <p className={COPY}>Your account uses your sign-in provider, and every connected device has its own access credential. You can revoke a device from Settings whenever you want.</p>
            </div>
          </section>

          <section className={SECTION} aria-labelledby="rights-title">
            <h2 id="rights-title" className={SECTION_TITLE}>Questions and requests</h2>
            <div className="grid gap-5">
              <p className={COPY}>Depending on where you live, you may have rights to access, correct, export, or delete your personal information. Most of these controls are available directly in Settings.</p>
              <p className={COPY}>
                For another privacy request or a question about this notice, contact us through the{" "}
                <a className="border-b border-line-strong font-[weight:540] text-ink-strong hover:border-blue hover:text-blue" href="https://github.com/afeefuddin/agentprint/issues">
                  Agentprint project
                </a>.
              </p>
              <p className="m-0 text-xs leading-[1.6] text-faint">We may update this notice as Agentprint changes. The date at the top shows the latest revision.</p>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
