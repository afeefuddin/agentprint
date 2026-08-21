import Link from "next/link";
import type { Viewer } from "@agentprint/database";
import { AppNav } from "./app-nav";
import { Brand } from "./brand";
import { GlobalProfileSearch } from "./global-profile-search";
import { buttonClass } from "@/lib/ui";

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
    <header
      data-site-header
      className="fixed inset-x-0 top-0 z-20 border-b border-line-strong/75 bg-[rgb(255_255_252_/_0.82)] backdrop-blur-[20px] backdrop-saturate-[1.35]"
    >
      <div className="shell flex min-h-[calc(var(--header-h)-1px)] items-center justify-between">
        <Brand />
        {search ? <GlobalProfileSearch /> : null}
        {variant === "minimal" ? null : (
          <nav
            aria-label="Primary"
            data-variant={appNav ? "app" : variant}
            className="ml-3 flex items-center gap-2 data-[variant=app]:max-desktop:ml-2 data-[variant=app]:max-desktop:min-w-0 data-[variant=app]:max-desktop:gap-0.5 data-[variant=app]:max-desktop:overflow-x-auto data-[variant=app]:max-desktop:[scrollbar-width:none] data-[variant=app]:max-desktop:[&::-webkit-scrollbar]:hidden"
          >
            {active ? (
              <AppNav handle={active.handle} />
            ) : current ? (
              <Link className={buttonClass({ variant: "signal", size: "small" })} href="/onboarding">
                Finish setup
              </Link>
            ) : (
              <Link className={buttonClass({ variant: "signal", size: "small" })} href="/login">
                Sign in
              </Link>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
