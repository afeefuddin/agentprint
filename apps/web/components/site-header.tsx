import Link from "next/link";
import type { Viewer } from "@agentprint/database";
import { AppNav } from "./app-nav";
import { Brand } from "./brand";
import { GlobalProfileSearch } from "./global-profile-search";

type HeaderVariant = "marketing" | "app" | "minimal";

export function SiteHeader({
  current,
  variant = "app",
  search = variant === "app"
}: {
  current?: Viewer | null;
  variant?: HeaderVariant;
  search?: boolean;
}) {
  const active = current?.onboarding_complete ? current : null;
  // A signed-in viewer keeps the tabs everywhere, including on public pages such as
  // a profile or a shared session. Only onboarding drops navigation entirely.
  const appNav = Boolean(active) && variant !== "minimal";
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Brand />
        {search ? <GlobalProfileSearch /> : null}
        {variant === "minimal" ? null : (
          <nav aria-label="Primary" data-variant={appNav ? "app" : variant}>
            {active ? (
              <AppNav handle={active.handle} />
            ) : current ? (
              <Link className="button button-small" href="/onboarding">Finish setup</Link>
            ) : (
              <>
                <Link className="nav-link" href="/login">Sign in</Link>
                <Link className="button button-small" href="/register">Create profile</Link>
              </>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
