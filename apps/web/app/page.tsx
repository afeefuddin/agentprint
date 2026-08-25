import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Check, Code2, Globe2, Link2, MessagesSquare, RefreshCw, ShieldCheck } from "lucide-react";
import { viewer } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { LandingPreview } from "@/components/landing-preview";
import { LandingInstallCommand } from "@/components/landing-install-command";
import { ShareGlobe } from "@/components/share-globe";
import { SiteFooter } from "@/components/site-footer";
import { cx, eyebrowClass } from "@/lib/ui";
import type { Metadata } from "next";
import { absoluteUrl, SITE_DESCRIPTION } from "@/lib/site";
import { assetUrl } from "@/lib/assets";

export const metadata: Metadata = {
  title: { absolute: "Agentprint – Coding agent activity tracker" },
  description: SITE_DESCRIPTION,
  alternates: { canonical: absoluteUrl("/") }
};

function sampleActivityLevel(index: number) {
  let value = Math.imul(index + 23, 0x45d9f3b);
  value ^= value >>> 16;
  return Math.abs(value) % 5;
}

const FEATURE_CARD =
  "relative min-h-[470px] overflow-hidden rounded-md border border-line-strong bg-[#f1f2ee] text-ink shadow-[inset_0_1px_rgb(255_255_255_/_0.8),0_18px_50px_rgb(39_49_38_/_0.045)] after:pointer-events-none after:absolute after:inset-x-0 after:bottom-[-20%] after:top-auto after:h-[65%] after:rounded-[50%] after:bg-[radial-gradient(ellipse_at_center,rgb(81_112_210_/_0.16),rgb(81_112_210_/_0)_72%)] after:content-[''] max-tablet:min-h-[430px]";
const FEATURE_CARD_WIDE = "col-span-full min-h-[510px] max-tablet:col-auto max-tablet:min-h-[430px]";
const FEATURE_COPY = "relative z-[4] px-[30px] pt-7 max-tablet:px-[22px] max-tablet:pt-[23px]";
const FEATURE_TITLE = "mb-[7px] text-2xl font-bold tracking-[-.045em] text-ink-strong max-tablet:text-xl";
const FEATURE_LEAD = "m-0 max-w-[540px] text-xs leading-[1.55] text-muted";
const WINDOW_BAR = "flex h-[37px] items-center gap-[5px] border-b border-line px-3 text-faint";
const WINDOW_DOT = "size-[7px] rounded-full bg-line-strong";
const FLOATING_PANEL =
  "absolute inset-x-7 z-[2] rounded-t-md border border-line-strong bg-[rgb(255_255_253_/_0.97)] shadow-[0_24px_55px_rgb(47_55_43_/_0.13)] max-tablet:inset-x-4";
const MINI_CELL =
  "aspect-square rounded-[3px] bg-canvas-deep data-[level=1]:bg-steel-1 data-[level=2]:bg-steel-2 data-[level=3]:bg-steel-3 data-[level=4]:bg-steel-4 data-[level=4]:shadow-[0_0_7px_rgb(69_107_193_/_0.18)]";
const BENEFIT_ICON =
  "mb-[17px] inline-grid size-[54px] place-items-center rounded-full border border-line bg-white/70 text-accent-strong shadow-[0_12px_32px_rgb(58_71_99_/_0.06)] max-tablet:mb-[13px] max-tablet:size-[46px]";
const BENEFIT_TITLE = "mb-2 text-base font-bold tracking-[-.025em] text-ink-strong max-tablet:text-sm";
const BENEFIT_COPY = "m-0 text-xs leading-[1.6] text-muted";
const harnesses = [
  { src: assetUrl("/brands/opencode.svg"), label: "OpenCode" },
  { src: assetUrl("/brands/claude.svg"), label: "Claude Code" },
  { src: assetUrl("/brands/codex.svg"), label: "Codex" },
  { src: assetUrl("/brands/kimi.svg"), label: "Kimi Code" }
];

const collectorSources = [
  { src: assetUrl("/brands/codex.svg"), label: "Codex" },
  { src: assetUrl("/brands/claude.svg"), label: "Claude" },
  { src: assetUrl("/brands/opencode.svg"), label: "OpenCode" },
  { src: assetUrl("/brands/kimi.svg"), label: "Kimi" }
];

const boundaryRows = [
  { label: "Token counts", verdict: "accepted", safe: true },
  { label: "Agent + model", verdict: "accepted", safe: true },
  { label: "Prompt text", verdict: "never", safe: false },
  { label: "Source code", verdict: "never", safe: false },
  { label: "Repository paths", verdict: "never", safe: false }
];

const sessionTurns = [
  { who: "You", agent: false, body: <>Make the sync client retry on 429.</> },
  { who: "Claude Code", agent: true, body: <>Added exponential backoff with a jittered delay, capped at five attempts.</> },
  { who: "You", agent: false, body: <>Read the token from <i className="rounded-xs bg-canvas-deep px-1.5 py-px not-italic text-faint">[redacted]</i> rather than the flag.</> },
  { who: "Claude Code", agent: true, body: <>Moved it behind a loader in <i className="rounded-xs bg-canvas-deep px-1.5 py-px not-italic text-faint">[project]</i>/internal/sync.</> },
  { who: "You", agent: false, body: <>Ship it.</> }
];

export default async function Home() {
  const current = await viewer();
  return (
    <>
      <SiteHeader current={current} variant="marketing" />
      <main id="main">
        <section className="hero shell">
          <div className="hero-signal hero-signal-left" aria-hidden="true">
            {Array.from({ length: 42 }, (_, index) => <i key={index} data-level={sampleActivityLevel(index + 31)} />)}
          </div>
          <div className="hero-signal hero-signal-right" aria-hidden="true">
            {Array.from({ length: 42 }, (_, index) => <i key={index} data-level={sampleActivityLevel(index + 89)} />)}
          </div>
          <div className="hero-copy">
            <h1 className="text-7xl font-medium max-desktop:text-6xl max-tablet:text-5xl">Your agent work,<br /><em>made visible.</em></h1>
            <p className="text-base font-medium max-tablet:text-sm">One public profile for the work you do with coding agents—measured locally, shared on your terms.</p>
          </div>
          <div className="hero-conversion">
            <div className="hero-actions">
              <Link className="button hero-cta text-sm font-bold" href={current?.onboarding_complete ? `/${current.handle}` : current ? "/onboarding" : "/login"}>
                {current ? "Open your profile" : "Create your activity field"} <ArrowRight size={16} />
              </Link>
            </div>
            <div className="hero-proof text-xs font-bold">
              <span><Check size={14} /> Free in beta</span>
              <span><Check size={14} /> 60-second setup</span>
              <span><Check size={14} /> Metadata by default</span>
            </div>
          </div>
          <LandingPreview />
        </section>

        <section className="relative overflow-hidden border-y border-white/10 bg-[#131512] text-white" aria-label="Install Agentprint">
          <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(rgb(255_255_255_/_0.09)_1px,transparent_1px)] [background-size:18px_18px] [mask-image:linear-gradient(to_bottom,black,transparent_68%)]" aria-hidden="true" />
          <div className="shell relative py-16 max-tablet:py-12">
            <LandingInstallCommand />
            <div className="mt-14 border-t border-white/10 pt-8 max-tablet:mt-11 max-tablet:pt-7">
              <div className="mb-7 flex items-center justify-between gap-4 max-tablet:mb-5">
                <span className="text-sm font-semibold text-white/60">Works with</span>
                <span className="inline-flex items-center gap-1.5 text-xs text-white/35">
                  More adapters are on the way <ArrowRight size={13} />
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 max-tablet:grid-cols-2">
                {harnesses.map((harness) => (
                  <div
                    key={harness.label}
                    className="flex min-h-[74px] items-center justify-center gap-3 rounded-sm border border-white/[.09] bg-white/[.035] px-4 text-white/80 transition-colors hover:border-white/[.16] hover:bg-white/[.055] max-tablet:min-h-[66px] max-tablet:justify-start max-tablet:px-3"
                  >
                    <span className="grid size-9 flex-[0_0_36px] place-items-center rounded-sm bg-white shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.75)] max-tablet:size-8 max-tablet:flex-basis-[32px]">
                      <Image
                        className="size-[24px] object-contain max-tablet:size-[22px]"
                        src={harness.src}
                        alt=""
                        width={29}
                        height={29}
                      />
                    </span>
                    <b className="text-sm font-semibold">{harness.label}</b>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          className="mx-auto mt-24 w-[min(100%-48px,1080px)] max-desktop:mt-[70px] max-desktop:w-[min(100%-28px,1080px)]"
          aria-label="Agentprint features"
        >
          <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 max-tablet:grid-cols-[1fr]">
            <article className={cx(FEATURE_CARD, FEATURE_CARD_WIDE)}>
              <div className={FEATURE_COPY}>
                <h2 className={FEATURE_TITLE}>Connect once. Keep building.</h2>
                <p className={FEATURE_LEAD}>Agentprint finds your coding tools and keeps your activity current automatically.</p>
              </div>
              <div className="absolute inset-x-0 bottom-0 top-[110px]" aria-hidden="true">
                <div className="absolute left-[-3%] top-[4%] size-[330px] rounded-full bg-[radial-gradient(circle,rgb(69_107_193_/_0.14),rgb(69_107_193_/_0)_70%)]" />
                <div className="absolute right-[-3%] top-[4%] size-[330px] rounded-full bg-[radial-gradient(circle,rgb(69_107_193_/_0.14),rgb(69_107_193_/_0)_70%)]" />
                <div className="absolute bottom-[62px] left-1/2 z-[2] w-[min(62%,610px)] min-w-[500px] -translate-x-1/2 overflow-hidden rounded-md border border-line-strong bg-[rgb(255_255_253_/_0.96)] shadow-[0_28px_75px_rgb(47_55_43_/_0.14)] max-tablet:bottom-[60px] max-tablet:w-[calc(100%-32px)] max-tablet:min-w-0">
                  <div className={WINDOW_BAR}>
                    <span className={WINDOW_DOT} /><span className={WINDOW_DOT} /><span className={WINDOW_DOT} />
                    <b className="ml-[7px] text-xs font-semibold">Agentprint activity</b>
                    <RefreshCw size={12} className="ml-auto" />
                  </div>
                  <code className="m-[17px] block rounded-sm border border-line bg-canvas px-3.5 py-3 text-xs text-ink">
                    <i className="mr-2 not-italic text-green">$</i> agentprint login
                  </code>
                  {harnesses.map((harness) => (
                    <div
                      key={harness.label}
                      className="flex min-h-[35px] items-center justify-between border-t border-line px-[17px] text-xs text-muted"
                    >
                      <span className="flex items-center gap-2">
                        <i className="size-1.5 rounded-full bg-green shadow-[0_0_8px_rgb(40_104_246_/_0.3)]" /> {harness.label}
                      </span>
                      <b className="text-xs font-semibold text-green">connected</b>
                    </div>
                  ))}
                </div>
                <div className="absolute bottom-3.5 left-1/2 z-[3] flex -translate-x-1/2 gap-[9px]">
                  {collectorSources.map((source) => (
                    <span
                      key={source.label}
                      className="flex items-center gap-[7px] rounded-full border border-line-strong bg-[rgb(255_255_253_/_0.92)] py-[7px] pl-[7px] pr-2.5 text-xs text-muted shadow-[0_7px_18px_rgb(47_55_43_/_0.08)] max-tablet:pr-[7px]"
                    >
                      <b className="grid size-[22px] place-items-center rounded-[7px] bg-canvas-deep text-xs font-bold text-ink">
                        <Image src={source.src} alt="" width={14} height={14} className="size-3.5 object-contain" />
                      </b>
                      <span className="max-tablet:hidden">{source.label}</span>
                    </span>
                  ))}
                </div>
              </div>
            </article>

            <article className={FEATURE_CARD}>
              <div className={FEATURE_COPY}>
                <h2 className={FEATURE_TITLE}>Numbers in. Content out.</h2>
                <p className={FEATURE_LEAD}>Your prompts, code, paths, and credentials stay private.</p>
              </div>
              <div className={cx(FLOATING_PANEL, "bottom-[-16px] overflow-hidden")} aria-hidden="true">
                <div className={WINDOW_BAR}>
                  <span className={WINDOW_DOT} /><span className={WINDOW_DOT} /><span className={WINDOW_DOT} />
                  <b className="ml-[7px] text-xs font-semibold">Privacy protection</b>
                  <ShieldCheck size={12} className="ml-auto" />
                </div>
                {boundaryRows.map((row) => (
                  <div
                    key={row.label}
                    className="flex min-h-[43px] items-center justify-between border-t border-line px-[15px] text-xs text-muted first-of-type:border-t-0"
                  >
                    <span>{row.label}</span>
                    <b className={cx("text-xs font-bold", row.safe ? "text-green" : "text-red")}>{row.verdict}</b>
                  </div>
                ))}
              </div>
            </article>

            <article className={FEATURE_CARD}>
              <div className={FEATURE_COPY}>
                <h2 className={FEATURE_TITLE}>See the shape of your practice.</h2>
                <p className={FEATURE_LEAD}>A year of agent-assisted work, distilled into one clear activity field.</p>
              </div>
              <div className={cx(FLOATING_PANEL, "bottom-[-20px] min-h-[280px] p-5")} aria-hidden="true">
                <div className="flex justify-between text-xs text-faint">
                  <span>12 month trace</span><b className="font-semibold text-ink">1.28B tokens</b>
                </div>
                <div className="mt-6 grid grid-flow-col grid-rows-[repeat(7,1fr)] grid-cols-[repeat(14,1fr)] gap-[5px] max-tablet:gap-[3px]">
                  {Array.from({ length: 98 }, (_, index) => (
                    <i key={index} className={MINI_CELL} data-level={(index * 17 + Math.floor(index / 7) * 11) % 5} />
                  ))}
                </div>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <span className="rounded-sm border border-line p-3 text-xs text-faint">
                    <b className="mb-[5px] block text-base font-semibold text-ink-strong">212</b>active days
                  </span>
                  <span className="rounded-sm border border-line p-3 text-xs text-faint">
                    <b className="mb-[5px] block text-base font-semibold text-ink-strong">38</b>day streak
                  </span>
                </div>
              </div>
            </article>

            <article className={cx(FEATURE_CARD, FEATURE_CARD_WIDE, "max-tablet:min-h-[470px]")}>
              <div className={FEATURE_COPY}>
                <h2 className={FEATURE_TITLE}>Publish a whole session. On purpose.</h2>
                <p className={FEATURE_LEAD}>
                  Automatic tracking never includes conversations. Share one session deliberately—previewed on your machine with likely credentials hidden.
                </p>
              </div>
              <div className="absolute inset-x-0 bottom-0 top-[116px] max-tablet:top-[152px]" aria-hidden="true">
                <div className="absolute bottom-[-20px] left-1/2 z-[2] w-[min(72%,720px)] min-w-[560px] -translate-x-1/2 overflow-hidden rounded-t-md border border-line-strong bg-[rgb(255_255_253_/_0.97)] shadow-[0_24px_55px_rgb(47_55_43_/_0.13)] max-tablet:w-[calc(100%-32px)] max-tablet:min-w-0 max-tablet:[&>div:nth-child(n+6)]:hidden">
                  <div className={WINDOW_BAR}>
                    <span className={WINDOW_DOT} /><span className={WINDOW_DOT} /><span className={WINDOW_DOT} />
                    <b className="ml-[7px] text-xs font-semibold">agentprint share --dry-run</b>
                    <MessagesSquare size={12} className="ml-auto" />
                  </div>
                  {/* Audit sits directly under the bar so the bottom bleed never clips it. */}
                  <div className="flex min-h-[44px] items-center gap-4 border-t border-line bg-canvas px-[17px] text-xs text-faint max-tablet:gap-3 max-tablet:px-3.5">
                    <span className="flex items-center gap-1.5"><ShieldCheck size={12} className="text-accent" /> 2 secrets removed</span>
                    <span className="flex items-center gap-1.5">7 paths rewritten</span>
                    <b className="ml-auto font-semibold text-ink max-tablet:hidden">Nothing uploaded yet</b>
                  </div>
                  {sessionTurns.map((turn, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-[96px_minmax(0,1fr)] gap-3.5 border-t border-line px-[17px] py-[13px] max-tablet:grid-cols-[minmax(0,1fr)] max-tablet:gap-[3px] max-tablet:px-3.5 max-tablet:py-2.5"
                    >
                      <span className={cx("text-xs", turn.agent ? "text-accent-strong" : "text-faint")}>{turn.who}</span>
                      <p className="m-0 truncate text-xs leading-normal text-ink">{turn.body}</p>
                    </div>
                  ))}
                </div>
                <div className="absolute bottom-[42px] right-[12%] z-[3] flex items-center gap-[7px] rounded-full border border-line-strong bg-[rgb(255_255_253_/_0.94)] px-[13px] py-2 text-xs text-muted shadow-[0_7px_18px_rgb(47_55_43_/_0.08)] max-tablet:bottom-7 max-tablet:right-[8%]">
                  <Link2 size={13} /> Unlisted link
                </div>
              </div>
            </article>
          </div>
        </section>

        <section
          className="relative overflow-hidden bg-[radial-gradient(circle_at_50%_64%,rgb(222_247_238_/_0.72),transparent_27%),var(--color-canvas)] pb-[92px] pt-[145px] max-tablet:pb-[50px] max-tablet:pt-[92px]"
          aria-labelledby="global-title"
        >
          <div className="shell relative z-[2] text-center">
            <span className={eyebrowClass}>Made to travel</span>
            <h2
              id="global-title"
              className="mb-[18px] mt-[19px] text-7xl font-bold leading-[.94] tracking-[-.068em] text-ink-strong max-tablet:text-6xl"
            >
              Your Agentprint.<br /><em className="tracking-[-.06em] text-ink-strong">Out in the world.</em>
            </h2>
            <p className="mx-auto max-w-[510px] text-base leading-[1.65] text-muted max-tablet:max-w-[330px] max-tablet:text-sm">
              Turn your agent activity into one public profile—ready to share anywhere.
            </p>
          </div>
          <div className="shell mt-[35px] grid grid-cols-[minmax(180px,230px)_minmax(440px,620px)_minmax(180px,230px)] items-center justify-center gap-[clamp(22px,3.2vw,52px)] max-desktop:max-w-[720px] max-desktop:grid-cols-2 max-tablet:mt-[22px] max-tablet:gap-x-4 max-tablet:gap-y-[34px]">
            <div className="grid gap-[104px] max-desktop:gap-7 max-tablet:contents [&>article]:ml-auto [&>article]:text-right max-desktop:[&>article]:ml-0 max-desktop:[&>article]:text-left">
              <article className="max-w-[220px] max-desktop:max-w-[270px] max-tablet:max-w-none">
                <span className={BENEFIT_ICON}><Link2 size={21} /></span>
                <h3 className={BENEFIT_TITLE}>One public link</h3>
                <p className={BENEFIT_COPY}>A profile that travels anywhere your work does.</p>
              </article>
              <article className="max-w-[220px] max-desktop:max-w-[270px] max-tablet:max-w-none">
                <span className={BENEFIT_ICON}><Globe2 size={21} /></span>
                <h3 className={BENEFIT_TITLE}>Share full sessions</h3>
                <p className={BENEFIT_COPY}>Publish the work behind a result, on your terms.</p>
              </article>
            </div>
            <div className="relative aspect-square w-full [filter:drop-shadow(0_36px_42px_rgb(72_101_157_/_0.12))] after:absolute after:inset-x-[15%] after:bottom-[3%] after:h-[8%] after:rounded-[50%] after:bg-[rgb(71_103_169_/_0.13)] after:blur-[24px] after:content-[''] max-desktop:col-span-full max-desktop:row-start-1 max-desktop:mx-auto max-desktop:w-[min(100%,580px)] max-tablet:-ml-9 max-tablet:w-[calc(100%+72px)]">
              <ShareGlobe />
            </div>
            <div className="grid gap-[104px] max-desktop:gap-7 max-tablet:contents">
              <article className="max-w-[220px] max-desktop:max-w-[270px] max-tablet:max-w-none">
                <span className={BENEFIT_ICON}><Code2 size={21} /></span>
                <h3 className={BENEFIT_TITLE}>Live profile card</h3>
                <p className={BENEFIT_COPY}>Embed an always-current Agentprint anywhere.</p>
              </article>
              <article className="max-w-[220px] max-desktop:max-w-[270px] max-tablet:max-w-none">
                <span className={BENEFIT_ICON}><ShieldCheck size={21} /></span>
                <h3 className={BENEFIT_TITLE}>Share by choice</h3>
                <p className={BENEFIT_COPY}>Publish only the metrics you want seen.</p>
              </article>
            </div>
          </div>
        </section>

        <section
          className="shell pb-[52px] pt-[34px] max-tablet:w-full max-tablet:px-3.5 max-tablet:pb-[38px] max-tablet:pt-[26px]"
          aria-labelledby="open-source-title"
        >
          <a
            className="group grid min-h-[210px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-7 overflow-hidden rounded-lg border border-[#d8dcd4] bg-[#1c1e1a] bg-[radial-gradient(circle_at_88%_20%,rgb(255_255_255_/_0.13),transparent_27%)] px-[42px] py-[38px] text-white shadow-[0_22px_56px_rgb(33_37_30_/_0.1)] transition-[transform,box-shadow] duration-[220ms] hover:-translate-y-1 hover:shadow-[0_30px_68px_rgb(33_37_30_/_0.15)] focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-blue max-tablet:min-h-0 max-tablet:grid-cols-[auto_1fr] max-tablet:gap-5 max-tablet:px-6 max-tablet:py-[27px]"
            href="https://github.com/afeefuddin/agentprint"
            target="_blank"
            rel="noreferrer"
          >
            <div
              className="grid size-[82px] place-items-center rounded-md bg-white shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.4),0_14px_34px_rgb(0_0_0_/_0.2)] max-tablet:size-[58px]"
              aria-hidden="true"
            >
              <Image src={assetUrl("/brands/github.svg")} alt="" width={42} height={42} className="size-[42px] max-tablet:size-[30px]" />
            </div>
            <div>
              <span className="mb-2 block text-xs font-bold text-[#b7bdb1]">Built in the open</span>
              <h2
                id="open-source-title"
                className="m-0 text-5xl font-bold tracking-[-.05em] text-white max-tablet:text-3xl"
              >
                Agentprint is open source.
              </h2>
              <p className="mt-2.5 text-sm leading-[1.55] text-[#b7bdb1] max-tablet:text-xs">
                Inspect the code, follow development, or make it better with us.
              </p>
            </div>
            <div className="flex min-h-12 items-center gap-[9px] whitespace-nowrap rounded-sm border border-white/[.17] bg-white px-3.5 text-xs font-bold text-[#181917] max-tablet:col-span-full max-tablet:w-full max-tablet:justify-center">
              <Image src={assetUrl("/brands/github.svg")} alt="" width={18} height={18} className="size-[18px]" />
              <span>afeefuddin/agentprint</span>
              <ArrowRight size={17} className="ml-2 transition-transform duration-[180ms] group-hover:translate-x-[3px]" />
            </div>
          </a>
        </section>

        <section className="bg-canvas pb-[88px] pt-11 max-tablet:pb-14 max-tablet:pt-7" aria-labelledby="final-cta-title">
          <div className="shell">
            <div className="grid min-h-[520px] grid-cols-[1.06fr_.94fr] overflow-hidden rounded-lg border border-line bg-panel-raised p-3 shadow-[0_24px_70px_rgb(39_49_38_/_0.09)] max-desktop:grid-cols-1 max-tablet:min-h-0 max-tablet:p-2">
              <div className="relative isolate flex min-h-[496px] items-center justify-center overflow-hidden rounded-md bg-[radial-gradient(circle_at_23%_16%,rgb(255_255_255_/_0.28),transparent_29%),linear-gradient(145deg,#65a0ff_0%,#2868f6_54%,#234fbb_100%)] p-5 max-desktop:min-h-[420px] max-tablet:min-h-[285px] max-tablet:p-2">
                <div
                  className="absolute inset-0 opacity-[.13] [background-image:linear-gradient(rgb(255_255_255_/_0.2)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255_/_0.2)_1px,transparent_1px)] [background-size:42px_42px]"
                  aria-hidden="true"
                />
                <div className="absolute inset-x-[14%] bottom-[7%] h-[17%] rounded-[50%] bg-[#173c91]/35 blur-[28px]" aria-hidden="true" />
                <Image
                  src={assetUrl("/landing/sessions-to-heatmap.webp")}
                  alt="Coding-agent sessions flowing into an activity heatmap"
                  width={1536}
                  height={1024}
                  className="relative z-[1] h-auto w-[112%] max-w-none object-contain drop-shadow-[0_24px_30px_rgb(17_52_132_/_0.25)] max-tablet:w-[110%]"
                />
              </div>

              <div className="flex items-center px-[clamp(34px,5vw,66px)] py-[clamp(42px,5vw,68px)] max-tablet:px-5 max-tablet:py-9">
                <div className="max-w-[410px]">
                  <span className="text-xs font-semibold text-accent">Sessions become signal</span>
                  <h2
                    id="final-cta-title"
                    className="mb-0 mt-5 text-6xl font-semibold leading-[1.01] tracking-[-.055em] text-ink-strong max-tablet:text-4xl"
                  >
                    Every session leaves a trace.
                  </h2>
                  <p className="mb-0 mt-5 text-base leading-[1.62] text-muted max-tablet:text-sm">
                    Agentprint turns your coding activity into one living history—ready to revisit, compare, and share.
                  </p>
                  <Link
                    className="group/action mt-7 inline-flex min-h-12 items-center gap-3 rounded-sm bg-ink-strong px-5 text-sm font-semibold text-panel-raised transition-[background-color,transform] duration-150 hover:-translate-y-0.5 hover:bg-ink focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent max-tablet:w-full max-tablet:justify-center"
                    href={current?.onboarding_complete ? `/${current.handle}` : current ? "/onboarding" : "/login"}
                  >
                    Open your Agentprint
                    <ArrowRight size={17} className="transition-transform duration-[180ms] group-hover/action:translate-x-1" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter current={current} />
    </>
  );
}
