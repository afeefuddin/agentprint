import Link from "next/link";
import type { Viewer } from "@agentprint/database";
import { Brand } from "./brand";

export function SiteHeader({
  current,
  variant = "default"
}: {
  current?: Viewer | null;
  variant?: "default" | "profile";
}) {
  return (
    <header className={`site-header${variant === "profile" ? " site-header-profile" : ""}`}>
      <div className="shell header-inner">
        <Brand />
        <nav aria-label="Primary">
          {current?.onboarding_complete ? (
            <>
              <Link className="nav-link" href={`/${current.handle}`}>Profile</Link>
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
