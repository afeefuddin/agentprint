import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { Calendar, CheckCircle2, Clock3, ExternalLink, MapPin } from "lucide-react";
import { formatTokens } from "@agentprint/analytics";
import type { getProfile } from "@agentprint/database";
import { compactTokens, harnessBrand, harnessLabels, modelBrand } from "@/lib/brands";
import { ContributionField } from "./contribution-field";
import { ShareButton } from "./share-button";

type ProfileData = NonNullable<Awaited<ReturnType<typeof getProfile>>>;

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export function ProfileView({
  data,
  preview = false,
  friendAction
}: {
  data: ProfileData;
  preview?: boolean;
  friendAction?: ReactNode;
}) {
  const { profile, activity, thresholds, summary, harnesses, models } = data;
  const harnessTotal = Object.values(harnesses).reduce((sum, value) => sum + value, 0);
  const modelTotal = Object.values(models).reduce((sum, value) => sum + value, 0);
  return (
    <main id="main" className="profile-main">
      <div className="shell profile-shell">
        <section className="profile-identity">
          <div className="avatar" aria-hidden="true">{initials(profile.display_name)}</div>
          <div className="identity-copy">
            <div className="identity-title">
              <h1>{profile.display_name}</h1>
              <span className="trust-chip"><CheckCircle2 size={13} /> Synced profile</span>
            </div>
            <p className="handle">@{profile.handle}</p>
            <p className="bio">{profile.bio || "Building with agents, one trace at a time."}</p>
            <div className="identity-meta">
              <span><MapPin size={13} /> {profile.timezone.replaceAll("_", " ")}</span>
              <span><Calendar size={13} /> Joined {new Date(profile.created_at).toLocaleDateString("en", { month: "long", year: "numeric" })}</span>
            </div>
          </div>
          <div className="profile-identity-actions">
            {preview && (
              <Link className="profile-preview-chip" href="/settings#visibility" aria-label="Private preview. Manage profile visibility.">
                <Clock3 size={14} /> Private preview
              </Link>
            )}
            {friendAction}
            <ShareButton title={`${profile.display_name} on Agentprint`} />
          </div>
        </section>

        <ContributionField
          activity={activity}
          thresholds={thresholds}
          showTokens={profile.show_tokens}
          showCost={profile.show_cost}
          showHarnesses={profile.show_harnesses}
        />

        <section className="metric-rail" aria-label="Profile summary">
          {profile.show_tokens && (
            <div><span>Lifetime tokens</span><strong>{formatTokens(summary.totalTokens)}</strong><small>input + output</small></div>
          )}
          {profile.show_cost && (
            <div><span>Estimated spend</span><strong>${(summary.estimatedCostMicros / 1_000_000).toLocaleString("en", { maximumFractionDigits: 0 })}</strong><small className="estimated">price-table estimate</small></div>
          )}
          <div><span>Active days</span><strong>{summary.activeDays}</strong><small>trailing 12 months</small></div>
          {profile.show_streaks && (
            <>
              <div><span>Current streak</span><strong>{summary.currentStreak}<i> days</i></strong><small>local calendar</small></div>
              <div><span>Longest streak</span><strong>{summary.longestStreak}<i> days</i></strong><small>all time</small></div>
            </>
          )}
        </section>

        <div className="profile-breakdowns">
          {profile.show_harnesses && (
            <section className="breakdown" aria-labelledby="harness-title">
              <div className="section-heading">
                <div><h2 id="harness-title">Connected harnesses</h2></div>
                <span>{Object.keys(harnesses).length} detected</span>
              </div>
              <div className="mix-list">
                {Object.entries(harnesses).length === 0 && (
                  <p className="breakdown-empty">Harness activity will appear after the first sync.</p>
                )}
                {Object.entries(harnesses).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, tokens], index) => {
                  const percent = Math.round((tokens / harnessTotal) * 100);
                  const brand = harnessBrand(name);
                  return (
                    <div className="mix-row" key={name}>
                      <span className="source-index">{String(index + 1).padStart(2, "0")}</span>
                      <span className="mix-mark">
                        {brand.logo
                          ? <Image src={brand.logo} alt="" width={17} height={17} />
                          : <em style={{ background: brand.color }} />}
                      </span>
                      <div><b>{harnessLabels[name] ?? name}</b><span>{formatTokens(tokens)} tokens</span></div>
                      <div className="mix-track"><i style={{ width: `${percent}%`, background: brand.color }} /></div>
                      <strong>{percent}%</strong>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
          {profile.show_models && (
            <section className="breakdown models" aria-labelledby="models-title">
              <div className="section-heading">
                <div><h2 id="models-title">Most used models</h2></div>
              </div>
              {Object.entries(models).length === 0 ? (
                <p className="breakdown-empty">Model usage will appear after the first sync.</p>
              ) : (
                (() => {
                  const ranked = Object.entries(models).sort((a, b) => b[1] - a[1]).slice(0, 10);
                  return (
                    <div
                      className="model-chart"
                      role="img"
                      aria-label={`Token volume by model: ${ranked.map(([name, tokens]) => `${name} ${compactTokens(tokens)}, ${Math.round((tokens / modelTotal) * 100)} percent`).join("; ")}`}
                    >
                      {ranked.map(([name, tokens]) => {
                        const brand = modelBrand(name);
                        return (
                          <div className="model-column" key={name}>
                            <span className="model-value">{compactTokens(tokens)}</span>
                            <span className="model-bar-wrap">
                              <i className="model-bar" style={{ height: `${Math.max((tokens / ranked[0][1]) * 100, 2)}%`, background: brand.color }} />
                            </span>
                            <span className="model-mark">
                              {brand.logo
                                ? <Image src={brand.logo} alt="" width={15} height={15} />
                                : <em style={{ background: brand.color }} />}
                            </span>
                            <span className="model-name">{name}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </section>
          )}
        </div>

        {data.sharedSessions.length > 0 && (
          <section className="breakdown shared-sessions" aria-labelledby="sessions-title">
            <div className="section-heading">
              <div>
                <h2 id="sessions-title">Shared sessions</h2>
                <p>Full transcripts {profile.display_name.split(" ")[0]} chose to publish.</p>
              </div>
              <span>{data.sharedSessions.length} published</span>
            </div>
            <div className="shared-session-list">
              {data.sharedSessions.map((session) => (
                <Link className="shared-session" key={session.id} href={`/s/${session.slug}`}>
                  <span className="shared-session-harness">
                    {harnessLabels[session.harness_id] ?? session.harness_id}
                  </span>
                  <b>{session.title}</b>
                  <span className="shared-session-meta">
                    {session.turn_count} turns · {formatTokens(Number(session.total_tokens))} tokens ·{" "}
                    {new Date(session.published_at).toLocaleDateString("en", {
                      day: "numeric",
                      month: "short",
                      year: "numeric"
                    })}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <aside className="trust-note">
          <div className="trust-icon"><span /><span /><span /></div>
          <div>
            <b>Synced from {Object.keys(harnesses).length} connected harnesses</b>
            <p>
              The numbers above are metadata only—never prompts, responses, source code,
              repository names, or file paths.
              {data.sharedSessions.length > 0
                ? " Shared sessions are separate: each one was published deliberately, one session at a time, after local redaction."
                : ""}
            </p>
          </div>
          <Link href="/privacy">How it works <ExternalLink size={13} /></Link>
        </aside>
      </div>
    </main>
  );
}
