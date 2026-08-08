import Link from "next/link";
import type { Viewer } from "@agentprint/database";
import { Brand } from "./brand";
import { GlobalProfileSearch } from "./global-profile-search";

export function SiteHeader({ current }: { current?: Viewer | null }) {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Brand />
        <GlobalProfileSearch />
        <nav aria-label="Primary">
          {current?.onboarding_complete ? (
            <>
              <Link className="nav-link" href={`/${current.handle}`}>Profile</Link>
              <Link className="nav-link" href="/dashboard/friends">Friends</Link>
              <Link className="button button-small" href="/dashboard">Dashboard</Link>
            </>
          ) : !current ? (
            <>
              <Link className="nav-link" href="/login">Sign in</Link>
              <Link className="button button-small" href="/register">Create profile</Link>
            </>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
