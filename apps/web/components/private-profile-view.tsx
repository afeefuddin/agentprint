import { LockKeyhole } from "lucide-react";
import type { ProfileIdentity } from "@agentprint/database";
import type { ReactNode } from "react";

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export function PrivateProfileView({ identity, friendAction }: { identity: ProfileIdentity; friendAction?: ReactNode }) {
  return (
    <main id="main" className="private-profile-main">
      <div className="shell private-profile-shell">
        <section className="private-profile-card" aria-labelledby="private-profile-title">
          <div className="private-profile-identity">
            <div className="avatar" aria-hidden="true">{initials(identity.displayName)}</div>
            <div>
              <h1>{identity.displayName}</h1>
              <p className="handle">@{identity.handle}</p>
            </div>
          </div>
          {friendAction && <div className="private-profile-action">{friendAction}</div>}
          <div className="private-profile-boundary" aria-hidden="true">
            <span /><LockKeyhole size={18} /><span />
          </div>
          <div className="private-profile-copy">
            <p><LockKeyhole size={14} /> Private profile</p>
            <h2 id="private-profile-title">This profile is private.</h2>
            <span>Only their name and username are visible. Activity and usage details remain private.</span>
          </div>
        </section>
      </div>
    </main>
  );
}
