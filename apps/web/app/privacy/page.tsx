import type { Metadata } from "next";
import Link from "next/link";
import { viewer } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { absoluteUrl } from "@/lib/site";

const SECTION =
  "grid gap-4 border-t border-line pt-9 first:border-t-0 first:pt-0";
const SECTION_TITLE =
  "m-0 text-3xl font-medium leading-[1.15] tracking-[-.03em] text-ink-strong max-tablet:text-2xl";
const COPY = "m-0 text-base font-medium leading-[1.65] text-muted";
const LIST =
  "m-0 grid list-disc gap-2.5 pl-5 text-base font-medium leading-[1.65] text-muted marker:text-ink";

export const metadata: Metadata = {
  title: "Privacy-first coding agent tracking",
  description: "See what Agentprint collects during background sync, what stays on your machine, and how session preview, redaction, visibility, and deletion work.",
  alternates: { canonical: absoluteUrl("/privacy") }
};

export default async function PrivacyPage() {
  const current = await viewer();

  return (
    <>
      <SiteHeader current={current} variant="marketing" />
      <main id="main" className="shell pb-[var(--page-bottom)] pt-[72px] max-tablet:pt-12">
        <article className="mx-auto max-w-[734px]">
          <header>
            <h1 className="m-0 text-6xl font-medium leading-[.95] tracking-[-.045em] text-ink-strong max-tablet:text-5xl">
              Privacy policy
            </h1>
            <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-faint">
              <span>Last updated August 27, 2026</span>
              <span aria-hidden="true">·</span>
              <span>Legal</span>
            </div>
          </header>

          <div className="mt-16 grid gap-12 max-tablet:mt-12 max-tablet:gap-10">
            <section className={SECTION} aria-labelledby="overview-title">
              <h2 id="overview-title" className={SECTION_TITLE}>1. Overview</h2>
              <p className={COPY}>
                Agentprint measures how you use coding agents without reading what you build with them. We collect the minimum information needed to sync your activity and create the profile you control.
              </p>
            </section>

            <section className={SECTION} aria-labelledby="collect-title">
              <h2 id="collect-title" className={SECTION_TITLE}>2. Information we collect</h2>
              <p className={COPY}>We collect only the information needed to operate Agentprint:</p>
              <ul className={LIST}>
                <li>Account information such as your name, handle, email from your sign-in provider, timezone, and profile settings.</li>
                <li>Usage details such as dates, token counts, and the coding agent or model involved.</li>
                <li>Device and source details needed to sync reliably and prevent duplicate activity.</li>
              </ul>
            </section>

            <section className={SECTION} aria-labelledby="never-title">
              <h2 id="never-title" className={SECTION_TITLE}>3. What sync leaves alone</h2>
              <p className={COPY}>Normal background sync does not collect the content of your work.</p>
              <ul className={LIST}>
                <li>No prompts or agent responses.</li>
                <li>No source code, file contents, repository names, or local paths.</li>
                <li>No shell history, API keys, passwords, or other credentials.</li>
              </ul>
            </section>

            <section className={SECTION} id="sharing" aria-labelledby="sharing-title">
              <h2 id="sharing-title" className={SECTION_TITLE}>4. Shared sessions</h2>
              <p className={COPY}>
                Session sharing is separate from background sync. It can include prompts, responses, and tool output, but only for the specific session you choose to publish.
              </p>
              <p className={COPY}>
                Agentprint previews and redacts the session on your device before upload. New shares begin as unlisted, and you can change their visibility or delete them at any time. Redaction helps, but you should still read the preview before publishing.
              </p>
              <p className={COPY}>
                Agentprint keeps the session private while checking it for publication. The temporary upload is deleted after processing and automatically expires within one day if processing cannot finish.
              </p>
            </section>

            <section className={SECTION} aria-labelledby="use-title">
              <h2 id="use-title" className={SECTION_TITLE}>5. How we use information</h2>
              <p className={COPY}>We use your information to sign you in, sync activity, build the views you request, provide support, and keep Agentprint reliable and secure.</p>
            </section>

            <section className={SECTION} aria-labelledby="control-title">
              <h2 id="control-title" className={SECTION_TITLE}>6. Your controls</h2>
              <p className={COPY}>You control whether your profile is public, which metrics appear, and whether friends can compare activity with you. You can also remove devices, export your data, delete shared sessions, or delete your account.</p>
              <Link className="w-fit border-b border-line-strong text-base font-semibold text-ink-strong transition-colors hover:border-blue hover:text-blue" href="/settings#visibility">
                Review your privacy settings
              </Link>
            </section>

            <section className={SECTION} aria-labelledby="retention-title">
              <h2 id="retention-title" className={SECTION_TITLE}>7. Retention and security</h2>
              <p className={COPY}>We keep your account and activity information while your account is active. If you delete your account, we delete your information and shared sessions. We may keep some information for a limited time for security, backups, or legal reasons.</p>
              <p className={COPY}>You sign in through your chosen provider. Each device you use is connected separately, and you can remove any device in Settings at any time.</p>
            </section>

            <section className={SECTION} aria-labelledby="cookies-title">
              <h2 id="cookies-title" className={SECTION_TITLE}>8. Cookies and analytics</h2>
              <p className={COPY}>Our website uses cookies and similar technologies for essential functionality and to understand how the site is used. You can control cookies through your browser settings.</p>
              <p className={COPY}>We use PostHog for product analytics, error reporting, and session replay. Recordings can include the pages and published session content visible in your browser. Passwords, contact inputs, device codes, URL parameters, network payloads, and console logs are excluded or masked.</p>
            </section>

            <section className={SECTION} aria-labelledby="changes-title">
              <h2 id="changes-title" className={SECTION_TITLE}>9. Changes to this policy</h2>
              <p className={COPY}>We may update this policy from time to time. We will post the revised version on this page and update the date above. Material changes will be communicated with reasonable notice.</p>
            </section>

            <section className={SECTION} aria-labelledby="contact-title">
              <h2 id="contact-title" className={SECTION_TITLE}>10. Contact</h2>
              <p className={COPY}>
                For privacy questions or requests, contact us through the{" "}
                <a className="border-b border-line-strong font-semibold text-ink-strong transition-colors hover:border-blue hover:text-blue" href="https://github.com/afeefuddin/agentprint/issues">
                  Agentprint project
                </a>.
              </p>
            </section>
          </div>
        </article>
      </main>
    </>
  );
}
