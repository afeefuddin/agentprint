import Link from "next/link";
import type { Viewer } from "@agentprint/database";
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
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Brand />
        {search ? <GlobalProfileSearch /> : null}
        {variant === "minimal" ? null : (
          <nav aria-label="Primary" data-variant={variant}>
            {active && variant === "app" ? (
              <>
                <Link className="nav-link" href={`/${active.handle}`}>Profile</Link>
                <Link className="nav-link" href="/dashboard/friends">Friends</Link>
                <Link className="button button-small" href="/dashboard">Dashboard</Link>
              </>
            ) : active ? (
              <Link className="button button-small" href="/dashboard">Open dashboard</Link>
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
