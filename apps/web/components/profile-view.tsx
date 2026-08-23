import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { Calendar, CheckCircle2, Clock3, ExternalLink, MapPin } from "lucide-react";
import { formatTokens, rankModelUsage } from "@agentprint/analytics";
import type { getProfile } from "@agentprint/database";
import { compactTokens, harnessBrand, harnessLabels, modelBrand } from "@/lib/brands";
import { cx, handleClass, modelChart, profileAvatarClass, sectionHeading } from "@/lib/ui";
import { ContributionField } from "./contribution-field";
import { ShareButton } from "./share-button";

type ProfileData = NonNullable<Awaited<ReturnType<typeof getProfile>>>;

const METRIC_CARD =
  "group relative col-span-2 min-h-[226px] overflow-hidden rounded-md border border-line bg-panel px-[25px] py-[27px] isolate after:absolute after:-right-8 after:-bottom-[54px] after:-z-[1] after:aspect-square after:w-[210px] after:rounded-full after:bg-[color-mix(in_srgb,var(--color-panel-raised)_56%,transparent)] after:content-[''] max-desktop:col-auto max-desktop:min-h-[210px] max-tablet:min-h-[174px] max-tablet:px-5 max-tablet:py-[22px]";
const METRIC_LABEL = "block text-sm font-medium text-faint";
const METRIC_VALUE =
  "mb-2 mt-[18px] block text-5xl font-medium leading-none text-ink-strong [font-variant-numeric:tabular-nums] max-desktop:text-4xl max-tablet:mb-1.5 max-tablet:mt-3.5 max-tablet:text-4xl";
const METRIC_ART =
  "pointer-events-none absolute h-auto select-none object-contain opacity-[.48] transition-opacity duration-[140ms] group-hover:opacity-100";
const MIX_ROW =
  "grid min-h-[63px] grid-cols-[30px_30px_minmax(0,190px)_minmax(0,1fr)_52px] items-center gap-[13px] border-b border-line last:border-b-0 max-tablet:grid-cols-[24px_30px_minmax(0,1fr)_46px] max-tablet:gap-2.5";
const BREAKDOWN_EMPTY = "m-0 py-[18px] text-sm text-faint";

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function MetricCard({
  label,
  value,
  note,
  art,
  artClass,
  cardClass
}: {
  label: string;
  value: ReactNode;
  note: string;
  art: string;
  artClass: string;
  cardClass?: string;
}) {
  return (
    <div className={cx(METRIC_CARD, cardClass)}>
      <div className="relative z-[1] w-[58%] max-tablet:w-[60%]">
        <span className={METRIC_LABEL}>{label}</span>
        <strong className={METRIC_VALUE}>{value}</strong>
        <small className={METRIC_LABEL}>{note}</small>
      </div>
      <Image className={cx(METRIC_ART, artClass)} src={art} alt="" width={512} height={512} aria-hidden="true" />
    </div>
  );
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
  const topMetricCardClass = profile.show_tokens ? "col-span-3" : "col-span-full";
  return (
    <main id="main" data-profile-main className="overflow-x-clip pb-[var(--page-bottom)]">
      <div className="shell pt-[var(--page-top)]">
        <section className="mb-9 grid grid-cols-[auto_1fr_auto] items-center gap-6 rounded-md border border-line bg-panel p-7 max-tablet:grid-cols-[auto_1fr] max-tablet:p-[22px]">
          <div className={profileAvatarClass} aria-hidden="true">{initials(profile.display_name)}</div>
          <div>
            <div className="flex items-center gap-3 max-tablet:flex-col max-tablet:items-start max-tablet:gap-[5px]">
              <h1 className="m-0 text-4xl font-medium leading-none tracking-[-.04em] text-ink-strong">
                {profile.display_name}
              </h1>
              <span className="inline-flex items-center gap-[5px] text-xs font-semibold text-blue">
                <CheckCircle2 size={13} /> Synced profile
              </span>
            </div>
            <p className={handleClass}>@{profile.handle}</p>
            <p className="m-0 text-sm text-muted">{profile.bio || "Building with agents, one trace at a time."}</p>
            <div className="mt-[11px] flex gap-[18px] text-xs text-faint max-tablet:flex-col max-tablet:gap-1">
              <span className="flex items-center gap-[5px]"><MapPin size={13} /> {profile.timezone.replaceAll("_", " ")}</span>
              <span className="flex items-center gap-[5px]">
                <Calendar size={13} /> Joined {new Date(profile.created_at).toLocaleDateString("en", { month: "long", year: "numeric" })}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 max-tablet:col-span-full max-tablet:w-full [&>*]:max-tablet:flex-1">
            {preview && (
              <Link
                className="inline-flex min-h-[39px] items-center justify-center gap-[7px] whitespace-nowrap rounded-full border border-[color-mix(in_srgb,var(--color-amber)_28%,var(--color-line))] bg-[color-mix(in_srgb,var(--color-amber)_7%,transparent)] px-[13px] text-xs font-semibold text-amber hover:border-[color-mix(in_srgb,var(--color-amber)_44%,var(--color-line))] hover:bg-[color-mix(in_srgb,var(--color-amber)_11%,transparent)]"
                href="/settings#visibility"
                aria-label="Private preview. Manage profile visibility."
              >
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
          showHarnesses={profile.show_harnesses}
        />

        <section
          className="grid grid-flow-row-dense grid-cols-[repeat(6,minmax(0,1fr))] gap-3.5 pt-9 max-desktop:grid-cols-[repeat(2,minmax(0,1fr))] max-tablet:grid-cols-[1fr] max-tablet:py-0"
          aria-label="Profile summary"
        >
          {profile.show_tokens && (
            <MetricCard
              label="Lifetime tokens"
              value={formatTokens(summary.totalTokens)}
              note="input + output"
              art="/metrics/generated/lifetime-tokens.png"
              cardClass={topMetricCardClass}
              artClass="-right-[21px] -bottom-[30px] w-[56%] max-w-[250px] max-tablet:-right-[9px] max-tablet:-bottom-[35px] max-tablet:w-[47%]"
            />
          )}
          <MetricCard
            label="Active days"
            value={summary.activeDays}
            note="trailing 12 months"
            art="/metrics/generated/active-days.png"
            cardClass={topMetricCardClass}
            artClass="-right-[21px] -bottom-[30px] w-[56%] max-w-[250px] max-tablet:-right-[9px] max-tablet:-bottom-[35px] max-tablet:w-[47%]"
          />
          {profile.show_streaks && (
            <>
              <MetricCard
                label="Current streak"
                value={<>{summary.currentStreak}<i className="text-sm not-italic text-muted"> days</i></>}
                note="local calendar"
                art="/metrics/generated/current-streak.png"
                cardClass="col-span-3 min-h-[216px]"
                artClass="right-[1px] -bottom-[54px] w-[44%] max-tablet:right-0 max-tablet:-bottom-[42px] max-tablet:w-[42%]"
              />
              <MetricCard
                label="Longest streak"
                value={<>{summary.longestStreak}<i className="text-sm not-italic text-muted"> days</i></>}
                note="all time"
                art="/metrics/generated/longest-streak.png"
                cardClass="col-span-3 min-h-[216px] max-desktop:col-span-full max-tablet:col-auto"
                artClass="-right-[3px] -bottom-[38px] w-[42%] max-tablet:right-0 max-tablet:-bottom-[42px] max-tablet:w-[42%]"
              />
            </>
          )}
        </section>

        <div className="grid grid-cols-[1fr] gap-0 pb-7 pt-9">
          {profile.show_harnesses && (
            <section
              className="min-w-0 not-first:mt-8 not-first:border-t not-first:border-line not-first:pt-8"
              aria-labelledby="harness-title"
            >
              <div className={sectionHeading.root}>
                <div><h2 id="harness-title" className={sectionHeading.title}>Connected harnesses</h2></div>
                <span className={sectionHeading.meta}>{Object.keys(harnesses).length} detected</span>
              </div>
              <div className="rounded-sm border border-line bg-panel px-[18px] py-1.5">
                {Object.entries(harnesses).length === 0 && (
                  <p className={BREAKDOWN_EMPTY}>Harness activity will appear after the first sync.</p>
                )}
                {Object.entries(harnesses).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, tokens], index) => {
                  const percent = Math.round((tokens / harnessTotal) * 100);
                  const brand = harnessBrand(name);
                  return (
                    <div className={MIX_ROW} key={name}>
                      <span className="text-xs text-faint">{String(index + 1).padStart(2, "0")}</span>
                      <span className="grid size-[30px] place-items-center rounded-xs border border-line bg-canvas">
                        {brand.logo
                          ? <Image src={brand.logo} alt="" width={17} height={17} className="size-[17px] object-contain" />
                          : <em className="size-[9px] rounded-full" style={{ background: brand.color }} />}
                      </span>
                      <div className="min-w-0">
                        <b className="block truncate text-xs font-medium">{harnessLabels[name] ?? name}</b>
                        <span className="block truncate text-xs text-faint">{formatTokens(tokens)} tokens</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-canvas-deep max-tablet:hidden">
                        <i className="block h-full rounded-full bg-blue" style={{ width: `${percent}%`, background: brand.color }} />
                      </div>
                      <strong className="text-right text-xs font-medium">{percent}%</strong>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
          {profile.show_models && (
            <section
              className="min-w-0 not-first:mt-8 not-first:border-t not-first:border-line not-first:pt-8"
              aria-labelledby="models-title"
            >
              <div className={sectionHeading.root}>
                <div><h2 id="models-title" className={sectionHeading.title}>Most used models</h2></div>
              </div>
              {Object.entries(models).length === 0 ? (
                <p className={BREAKDOWN_EMPTY}>Model usage will appear after the first sync.</p>
              ) : (
                (() => {
                  const ranked = rankModelUsage(models);
                  return (
                    <div
                      className={modelChart.root}
                      role="img"
                      aria-label={`Token volume by model: ${ranked.map(([name, tokens]) => `${name} ${compactTokens(tokens)}, ${Math.round((tokens / modelTotal) * 100)} percent`).join("; ")}`}
                    >
                      {ranked.map(([name, tokens]) => {
                        const brand = modelBrand(name);
                        return (
                          <div className={modelChart.column} key={name}>
                            <span className={modelChart.value}>{compactTokens(tokens)}</span>
                            <span className={modelChart.barWrap}>
                              <i
                                className={modelChart.bar}
                                style={{ height: `${Math.max((tokens / ranked[0][1]) * 100, 2)}%`, background: brand.color }}
                              />
                            </span>
                            <span className={modelChart.mark}>
                              {brand.logo
                                ? <Image src={brand.logo} alt="" width={15} height={15} className={modelChart.markImage} />
                                : <em className={modelChart.markDot} style={{ background: brand.color }} />}
                            </span>
                            <span className={modelChart.name}>{name}</span>
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
          <section
            className="my-9 min-w-0 rounded-md border border-line bg-panel p-7 max-tablet:p-[22px]"
            aria-labelledby="sessions-title"
          >
            <div className={sectionHeading.root}>
              <div>
                <h2 id="sessions-title" className={sectionHeading.title}>Shared sessions</h2>
                <p className="mt-1.5 max-w-[420px] text-sm text-muted">
                  Full transcripts {profile.display_name.split(" ")[0]} chose to publish.
                </p>
              </div>
              <span className={sectionHeading.meta}>{data.sharedSessions.length} published</span>
            </div>
            <div className="grid gap-2.5">
              {data.sharedSessions.map((session) => (
                <Link
                  className="block rounded-sm border border-line bg-panel px-[18px] py-[15px] transition-[border-color] duration-150 hover:border-steel-2"
                  key={session.id}
                  href={`/s/${session.slug}`}
                >
                  <span className="text-xs text-faint">
                    {harnessLabels[session.harness_id] ?? session.harness_id}
                  </span>
                  <b className="mt-1 block text-sm font-semibold text-ink-strong">{session.title}</b>
                  <span className="mt-[5px] block text-xs text-muted">
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

        <aside className="grid grid-cols-[auto_1fr_auto] items-center gap-[18px] rounded-md border border-line bg-panel p-6 max-tablet:grid-cols-[auto_1fr] max-tablet:p-5">
          <div className="flex size-[35px] items-end gap-0.5 rounded-full border border-line p-[9px]">
            <span className="h-[7px] w-[3px] bg-blue" />
            <span className="h-3.5 w-[3px] bg-blue" />
            <span className="h-2.5 w-[3px] bg-blue" />
          </div>
          <div>
            <b className="text-xs">Synced from {Object.keys(harnesses).length} connected harnesses</b>
            <p className="mt-[3px] text-xs text-faint">
              The numbers above are metadata only—never prompts, responses, source code,
              repository names, or file paths.
              {data.sharedSessions.length > 0
                ? " Shared sessions are separate: each one was published deliberately, one session at a time, after local redaction."
                : ""}
            </p>
          </div>
          <Link className="flex items-center gap-1.5 text-xs text-muted max-tablet:col-start-2" href="/privacy">
            How it works <ExternalLink size={13} />
          </Link>
        </aside>
      </div>
    </main>
  );
}
