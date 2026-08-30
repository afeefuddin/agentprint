import Image from "next/image";
import Link from "next/link";
import type { Viewer } from "@agentprint/database";

export function SiteFooter({ current }: { current?: Viewer | null }) {
  return (
    <footer className="border-t border-line bg-canvas text-ink-strong">
      <div className="shell grid grid-cols-[1fr_auto_auto_auto] items-start gap-[clamp(32px,5vw,76px)] py-11 max-desktop:grid-cols-3 max-tablet:grid-cols-2 max-tablet:gap-x-10 max-tablet:gap-y-9">
        <div className="max-desktop:col-span-full">
          <Link href="/" aria-label="Agentprint home" className="inline-flex">
            <Image
              src="/brand/agentprint-lockup.svg"
              alt="Agentprint"
              width={360}
              height={80}
              className="h-8 w-auto"
              loading="eager"
              unoptimized
            />
          </Link>
          <p className="mb-0 mt-4 max-w-[280px] text-xs leading-[1.55] text-faint">Your coding agent activity, measured locally and shared on your terms.</p>
          <span className="mt-5 block text-xs text-faint">© 2026 Agentprint</span>
        </div>
        <nav aria-label="Explore Agentprint" className="grid min-w-[120px] gap-2.5 text-sm text-muted">
          <b className="mb-1 text-xs font-semibold text-ink-strong">Product</b>
          <Link className="transition-colors duration-[140ms] hover:text-accent-strong" href="/product/profile">Profile</Link>
          <Link className="transition-colors duration-[140ms] hover:text-accent-strong" href="/product/session-sharing">Session sharing</Link>
        </nav>
        <nav aria-label="Coding agent integrations" className="grid min-w-[150px] gap-2.5 text-sm text-muted">
          <b className="mb-1 text-xs font-semibold text-ink-strong">Integrations</b>
          <Link className="transition-colors duration-[140ms] hover:text-accent-strong" href="/integrations/claude-code">Claude Code</Link>
          <Link className="transition-colors duration-[140ms] hover:text-accent-strong" href="/integrations/codex">Codex</Link>
          <Link className="transition-colors duration-[140ms] hover:text-accent-strong" href="/integrations/opencode">OpenCode</Link>
          <Link className="transition-colors duration-[140ms] hover:text-accent-strong" href="/integrations/kimi-code">Kimi Code</Link>
        </nav>
        <nav aria-label="Agentprint links" className="grid min-w-[120px] gap-2.5 text-sm text-muted">
          <b className="mb-1 text-xs font-semibold text-ink-strong">Agentprint</b>
          <Link className="transition-colors duration-[140ms] hover:text-accent-strong" href="/privacy">Privacy</Link>
          <a className="transition-colors duration-[140ms] hover:text-accent-strong" href="https://github.com/afeefuddin/agentprint" target="_blank" rel="noreferrer">GitHub</a>
          <Link className="transition-colors duration-[140ms] hover:text-accent-strong" href={current?.onboarding_complete ? `/${current.handle}` : current ? "/onboarding" : "/login"}>
            {current ? "Your profile" : "Sign in"}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
