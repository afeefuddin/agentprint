import { LockKeyhole } from "lucide-react";
import type { ProfileIdentity } from "@agentprint/database";
import type { ReactNode } from "react";
import { handleClass, profileAvatarClass } from "@/lib/ui";

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export function PrivateProfileView({ identity, friendAction }: { identity: ProfileIdentity; friendAction?: ReactNode }) {
  return (
    <main id="main" className="min-h-[calc(100dvh-69px)] overflow-hidden">
      <div className="shell grid min-h-[calc(100dvh-69px)] place-items-center py-[72px] max-tablet:py-[46px]">
        <section
          className="relative w-[min(100%,680px)] border-y border-line-strong pb-[42px] pt-[34px] before:absolute before:inset-x-[17%] before:bottom-auto before:-top-[120px] before:-z-[1] before:h-[250px] before:rounded-full before:bg-[color-mix(in_srgb,var(--color-accent-soft)_78%,transparent)] before:blur-[65px] before:content-[''] max-tablet:pb-9 max-tablet:pt-[29px]"
          aria-labelledby="private-profile-title"
        >
          <div className="flex items-center justify-center gap-[17px] max-tablet:justify-start">
            <div className={profileAvatarClass} aria-hidden="true">{initials(identity.displayName)}</div>
            <div>
              <h1 className="m-0 text-3xl font-medium leading-[1.05] text-ink-strong max-tablet:text-3xl">
                {identity.displayName}
              </h1>
              <p className={`${handleClass} mb-0`}>@{identity.handle}</p>
            </div>
          </div>
          {friendAction && <div className="mt-[22px] flex justify-center">{friendAction}</div>}
          <div
            className="mx-auto mb-[31px] mt-9 grid w-[min(100%,420px)] grid-cols-[1fr_auto_1fr] items-center gap-3.5 text-faint"
            aria-hidden="true"
          >
            <span className="h-px bg-gradient-to-r from-transparent to-line-strong" />
            <LockKeyhole size={18} />
            <span className="h-px bg-gradient-to-r from-line-strong to-transparent" />
          </div>
          <div className="mx-auto max-w-[480px] text-center">
            <p className="mb-[13px] inline-flex items-center gap-[7px] text-xs font-semibold text-blue">
              <LockKeyhole size={14} /> Private profile
            </p>
            <h2
              id="private-profile-title"
              className="m-0 text-6xl font-medium leading-[1.02] text-ink-strong max-tablet:text-4xl"
            >
              This profile is private.
            </h2>
            <span className="mx-auto mt-[17px] block max-w-[390px] text-sm leading-[1.65] text-muted">
              Only their name and username are visible. Activity and usage details remain private.
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}
