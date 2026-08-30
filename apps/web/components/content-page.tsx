import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  Check,
  ChevronDown,
  CircleCheck,
  EyeOff,
  FileCode2,
  Fingerprint,
  Globe2,
  LockKeyhole,
  MonitorCheck,
  ShieldCheck,
  Terminal,
  Users
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { buttonClass, cx } from "@/lib/ui";
import { viewer } from "@/lib/auth";

export type SeoPageStep = { title: string; body: string; command?: string };
export type SeoPageFaq = { question: string; answer: string };
export type SeoPageLink = { href: string; label: string; detail: string };
export type SeoPageProof = { value: string; label: string };

type PageMode = "sharing" | "tracking" | "setup" | "boundary" | "profile";
type Agent = "codex" | "claude" | "kimi" | "opencode" | "agentprint";

export type ContentPageProps = {
  eyebrow: string;
  title: string;
  intro: string;
  qualifier?: string;
  agent: Agent;
  mode: PageMode;
  parent?: { href: string; label: string } | null;
  secondaryCtaLabel?: string;
  sectionEyebrow?: string;
  principlesEyebrow?: string;
  principlesTitle?: string;
  heroVariant?: "default" | "product";
  proof?: SeoPageProof[];
  outcomeTitle: string;
  outcomeBody: string;
  steps: SeoPageStep[];
  principles: Array<{ title: string; body: string }>;
  faqs: SeoPageFaq[];
  related: SeoPageLink[];
};

const brand = {
  codex: { name: "Codex", src: "/brands/codex.svg" },
  claude: { name: "Claude Code", src: "/brands/claude.svg" },
  kimi: { name: "Kimi Code", src: "/brands/kimi.svg" },
  opencode: { name: "OpenCode", src: "/brands/opencode.svg" },
  agentprint: { name: "Agentprint", src: "/brand/agentprint-mark.svg" }
};

const agentSources = [
  { name: "Claude Code", src: "/brands/claude.svg" },
  { name: "Codex", src: "/brands/codex.svg" },
  { name: "OpenCode", src: "/brands/opencode.svg" },
  { name: "Kimi Code", src: "/brands/kimi.svg" }
];

const visualShell =
  "relative overflow-hidden rounded-lg border border-white/55 bg-[#8fc1ff] p-7 shadow-[0_34px_90px_rgb(33_86_170_/_0.2)] before:pointer-events-none before:absolute before:inset-0 before:opacity-25 before:[background-image:radial-gradient(rgb(255_255_255_/_0.8)_0.7px,transparent_0.7px)] before:[background-size:5px_5px] before:content-[''] max-tablet:p-4";
const visualCard =
  "relative z-[1] rounded-md border border-[#b7c8df] bg-[rgb(255_255_253_/_0.96)] shadow-[0_12px_30px_rgb(28_60_110_/_0.12)]";

function AgentMark({ agent, size = 34 }: { agent: Agent; size?: number }) {
  const identity = brand[agent];
  return (
    <span className="grid shrink-0 place-items-center rounded-sm border border-line bg-white" style={{ width: size, height: size }}>
      <Image src={identity.src} alt="" width={size - 12} height={size - 12} className="object-contain" />
    </span>
  );
}

function FlowArrow() {
  return (
    <div className="relative z-[1] grid h-12 place-items-center text-[#426994]" aria-hidden="true">
      <span className="absolute h-full border-l border-dashed border-[#5f83ac]" />
      <ArrowDown className="relative mt-6 bg-[#8fc1ff]" size={17} />
    </div>
  );
}

function ActivityCells() {
  return (
    <div className="grid grid-flow-col grid-rows-4 gap-1" aria-hidden="true">
      {Array.from({ length: 28 }, (_, index) => (
        <i
          key={index}
          className={cx(
            "size-2.5 rounded-[3px]",
            index % 7 === 0 ? "bg-[#2868f6]" : index % 4 === 0 ? "bg-[#7898db]" : index % 3 === 0 ? "bg-[#aec2ea]" : "bg-[#e5ebf5]"
          )}
        />
      ))}
    </div>
  );
}

function TrackingVisual({ agent }: { agent: Agent }) {
  const identity = brand[agent];
  const sources = agent === "agentprint" ? agentSources : [
    { name: identity.name, src: identity.src },
    ...agentSources.filter((source) => source.name !== identity.name).slice(0, 2)
  ];
  return (
    <div className={visualShell} role="img" aria-label={`${identity.name} activity flowing through Agentprint into a private profile`}>
      <div className="relative z-[1] flex flex-wrap justify-center gap-2">
        {sources.map((source, index) => (
          <span key={source.name} className={cx("flex items-center gap-2 rounded-sm border bg-white px-3 py-2 text-xs font-semibold shadow-sm", index === 0 ? "border-accent text-ink-strong" : "border-white/70 text-muted opacity-75")}>
            <Image src={source.src} alt="" width={18} height={18} className="size-[18px] object-contain" />
            {source.name}
          </span>
        ))}
      </div>
      <FlowArrow />
      <div className={cx(visualCard, "mx-auto max-w-[430px] p-5")}>
        <div className="flex items-center gap-3">
          <AgentMark agent="agentprint" />
          <div><b className="block text-sm font-semibold text-ink-strong">Local activity collector</b><span className="text-xs text-muted">Normalizes numbers, not conversations</span></div>
          <CircleCheck className="ml-auto text-accent" size={20} aria-hidden="true" />
        </div>
        <div className="mt-4 grid grid-cols-3 border-t border-line pt-4 text-xs text-muted">
          <span><b className="block text-sm text-ink-strong">Dates</b>kept</span>
          <span><b className="block text-sm text-ink-strong">Tokens</b>counted</span>
          <span><b className="block text-sm text-ink-strong">Content</b>excluded</span>
        </div>
      </div>
      <FlowArrow />
      <div className={cx(visualCard, "mx-auto flex max-w-[500px] items-center gap-5 p-5 max-tablet:items-start")}>
        <div className="min-w-0 flex-1">
          <span className="text-xs font-semibold text-accent-strong">Your Agentprint</span>
          <b className="mt-1 block text-lg font-semibold text-ink-strong">A living activity history</b>
          <span className="mt-1 block text-xs text-muted">Private until you choose otherwise</span>
        </div>
        <ActivityCells />
      </div>
    </div>
  );
}

function SharingVisual({ agent }: { agent: Agent }) {
  const identity = brand[agent];
  return (
    <div className={visualShell} role="img" aria-label={`${identity.name} session moving through local preview and redaction before an unlisted link is created`}>
      <div className={cx(visualCard, "mx-auto max-w-[430px] p-4")}>
        <div className="flex items-center gap-3">
          <AgentMark agent={agent} />
          <div><span className="block text-xs text-muted">Selected local session</span><b className="text-sm font-semibold text-ink-strong">Fix retry behavior on 429</b></div>
          <FileCode2 className="ml-auto text-muted" size={19} aria-hidden="true" />
        </div>
      </div>
      <FlowArrow />
      <div className={cx(visualCard, "mx-auto max-w-[500px] overflow-hidden")}>
        <div className="flex items-center border-b border-line px-5 py-4">
          <ShieldCheck className="mr-3 text-accent" size={18} aria-hidden="true" />
          <b className="text-sm font-semibold text-ink-strong">Local preview</b>
          <span className="ml-auto rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-strong">Nothing uploaded</span>
        </div>
        <div className="grid grid-cols-2 gap-px bg-line max-tablet:grid-cols-1">
          {[
            ["Credentials", "replaced"],
            ["Local paths", "rewritten"],
            ["Images", "removed"],
            ["Long output", "trimmed"]
          ].map(([label, state]) => (
            <span key={label} className="flex items-center bg-white px-4 py-3 text-xs text-muted"><Check className="mr-2 text-accent" size={14} aria-hidden="true" />{label}<b className="ml-auto font-semibold text-ink-strong">{state}</b></span>
          ))}
        </div>
      </div>
      <FlowArrow />
      <div className="relative z-[1] grid grid-cols-3 gap-2 max-tablet:grid-cols-1">
        {[
          { icon: LockKeyhole, title: "Unlisted", detail: "Default" },
          { icon: Users, title: "Friends", detail: "Accepted people" },
          { icon: Globe2, title: "Public", detail: "Profile + search" }
        ].map(({ icon: Icon, title, detail }, index) => (
          <div key={title} className={cx(visualCard, "p-3.5", index === 0 && "ring-2 ring-accent")}>
            <Icon className="mb-3 text-accent" size={17} aria-hidden="true" />
            <b className="block text-sm font-semibold text-ink-strong">{title}</b>
            <span className="text-xs text-muted">{detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BoundaryVisual() {
  const rows = [
    ["Activity date", "Collected", true],
    ["Token totals", "Collected", true],
    ["Coding tool + model", "Collected", true],
    ["Prompts + replies", "Never", false],
    ["Source code + paths", "Never", false]
  ] as const;
  return (
    <div className={visualShell} role="img" aria-label="Agentprint privacy boundary separating numeric activity from conversation and project content">
      <div className={cx(visualCard, "mx-auto max-w-[510px] overflow-hidden")}>
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <span className="grid size-9 place-items-center rounded-full bg-accent-soft text-accent"><Fingerprint size={18} aria-hidden="true" /></span>
          <div><b className="block text-sm font-semibold text-ink-strong">Automatic activity boundary</b><span className="text-xs text-muted">Applied before sync</span></div>
          <ShieldCheck className="ml-auto text-accent" size={20} aria-hidden="true" />
        </div>
        {rows.map(([label, verdict, allowed]) => (
          <div key={label} className="flex min-h-12 items-center border-b border-line px-5 text-sm last:border-b-0">
            <span className="text-ink">{label}</span>
            <span className={cx("ml-auto rounded-full px-3 py-1 text-xs font-semibold", allowed ? "bg-accent-soft text-accent-strong" : "bg-[#f4ece9] text-[#9f503d]")}>
              {allowed ? <Check className="mr-1 inline" size={12} aria-hidden="true" /> : <EyeOff className="mr-1 inline" size={12} aria-hidden="true" />}{verdict}
            </span>
          </div>
        ))}
      </div>
      <div className="relative z-[1] mx-auto mt-5 flex max-w-[510px] items-center justify-between rounded-md border border-white/60 bg-white/55 px-5 py-3 text-xs text-[#355d88] max-tablet:items-start max-tablet:gap-4">
        <span className="flex items-center gap-2"><MonitorCheck size={15} aria-hidden="true" /> Enforced locally</span>
        <span className="flex items-center gap-2"><ShieldCheck size={15} aria-hidden="true" /> Unknown fields rejected</span>
      </div>
    </div>
  );
}

function ProfileVisual() {
  return (
    <div className={visualShell} role="img" aria-label="Coding-agent activity becoming an Agentprint developer profile and shareable profile card">
      <div className="relative z-[1] grid grid-cols-2 gap-2 max-tablet:grid-cols-1">
        {["Token history", "Agent mix", "Model ranking", "Streaks"].map((item, index) => (
          <span key={item} className={cx("flex items-center gap-2 rounded-sm border bg-white px-3 py-2.5 text-xs font-semibold", index === 0 ? "border-accent" : "border-white/70")}>
            <Check className="text-accent" size={14} aria-hidden="true" />{item}
          </span>
        ))}
      </div>
      <FlowArrow />
      <div className={cx(visualCard, "mx-auto max-w-[500px] p-5")}>
        <div className="flex items-center gap-3 border-b border-line pb-4">
          <span className="grid size-11 place-items-center rounded-full bg-accent text-base font-semibold text-white">AP</span>
          <div><b className="block text-base font-semibold text-ink-strong">Your agent work</b><span className="text-xs text-muted">One profile across supported tools</span></div>
          <span className="ml-auto rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-strong">Synced</span>
        </div>
        <div className="mt-4 flex items-center justify-between gap-5">
          <div><b className="block text-2xl font-semibold text-ink-strong">48.2M</b><span className="text-xs text-muted">lifetime tokens</span></div>
          <ActivityCells />
        </div>
      </div>
      <FlowArrow />
      <div className="relative z-[1] flex justify-center gap-2">
        {["GitHub", "Portfolio", "Social"].map((destination) => <span key={destination} className="rounded-full border border-white/70 bg-white/80 px-4 py-2 text-xs font-semibold text-ink">{destination}</span>)}
      </div>
    </div>
  );
}

function ProductArtifact({ agent, mode }: Pick<ContentPageProps, "agent" | "mode">) {
  if (mode === "sharing") return <SharingVisual agent={agent} />;
  if (mode === "boundary") return <BoundaryVisual />;
  if (mode === "profile") return <ProfileVisual />;
  return <TrackingVisual agent={agent} />;
}

function parentFor(mode: PageMode) {
  if (mode === "sharing") return { href: "/product/session-sharing", label: "Session sharing" };
  if (mode === "tracking") return { href: "/integrations", label: "Integrations" };
  if (mode === "setup") return { href: "/product", label: "Product" };
  if (mode === "profile") return { href: "/use-cases/ai-coding-activity-tracker", label: "Use cases" };
  return { href: "/privacy", label: "Privacy" };
}

export async function ContentPage(props: ContentPageProps) {
  const current = await viewer();
  const ctaHref = current?.onboarding_complete ? `/${current.handle}` : current ? "/onboarding" : "/login";
  const parent = props.parent === undefined ? parentFor(props.mode) : props.parent;
  const isIntegrationPage = props.mode === "tracking" && props.agent !== "agentprint";
  const proof = props.proof ?? [
    { value: "Local first", label: "Activity is read on your machine" },
    { value: "Private", label: "Profiles begin hidden" },
    { value: "Explicit", label: "Session sharing is separate" }
  ];
  const productHero = props.heroVariant === "product";
  const breadcrumbItems = isIntegrationPage || !parent
    ? [
        { "@type": "ListItem", position: 1, name: "Agentprint", item: "https://www.agentprint.tech/" },
        { "@type": "ListItem", position: 2, name: props.eyebrow }
      ]
    : [
        { "@type": "ListItem", position: 1, name: "Agentprint", item: "https://www.agentprint.tech/" },
        { "@type": "ListItem", position: 2, name: parent.label, item: `https://www.agentprint.tech${parent.href}` },
        { "@type": "ListItem", position: 3, name: props.eyebrow }
      ];
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: breadcrumbItems
      },
      {
        "@type": "FAQPage",
        mainEntity: props.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer }
        }))
      }
    ]
  };

  return (
    <>
      <SiteHeader current={current} variant="marketing" />
      <main id="main" className="overflow-hidden bg-canvas">
        <section className={cx(
          "relative border-b py-[clamp(68px,8vw,112px)]",
          productHero
            ? "overflow-hidden border-line bg-[radial-gradient(circle_at_50%_12%,rgb(220_236_255_/_0.82),transparent_42%),var(--color-canvas)]"
            : "border-[#bfd0e3] bg-[#dcecff]"
        )}>
          {productHero ? (
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" aria-hidden="true" />
          ) : (
            <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(rgb(255_255_255_/_0.45)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255_/_0.45)_1px,transparent_1px)] [background-size:42px_42px]" aria-hidden="true" />
          )}
          <div className={cx(
            "shell relative",
            productHero
              ? "grid justify-items-center"
              : "grid grid-cols-[minmax(0,.92fr)_minmax(460px,1.08fr)] items-center gap-[clamp(48px,7vw,96px)] max-desktop:grid-cols-1"
          )}>
            <div className={cx(productHero ? "max-w-[880px] text-center" : "max-w-[650px]")}>
              <p className="mb-4 text-sm font-semibold text-accent-strong">{props.eyebrow}</p>
              <h1 className={cx(
                "m-0 font-semibold leading-[.98] text-ink-strong text-balance",
                productHero ? "text-7xl tracking-[-.06em] max-tablet:text-5xl" : "text-6xl tracking-[-.052em] max-tablet:text-5xl"
              )}>{props.title}</h1>
              <p className={cx(
                "mt-6 text-lg font-medium leading-[1.6] text-[#4f6278] max-tablet:text-base",
                productHero ? "mx-auto max-w-[720px]" : "max-w-[610px]"
              )}>{props.intro}</p>
              {props.qualifier ? (
                <p className={cx(
                  "mt-6 flex max-w-[610px] items-start gap-3 rounded-sm border border-[#b9cde3] bg-white/65 px-4 py-3.5 text-left text-sm leading-[1.55] text-[#51667d]",
                  productHero && "mx-auto"
                )}>
                  <ShieldCheck size={17} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" /> {props.qualifier}
                </p>
              ) : null}
              <div className={cx("mt-8 flex flex-wrap gap-3", productHero && "justify-center")}>
                <Link className={cx(buttonClass({ variant: "signal" }), "min-h-12 px-5")} href={ctaHref}>Start with Agentprint <ArrowRight size={16} aria-hidden="true" /></Link>
                <Link className={cx(buttonClass({ variant: "secondary" }), "min-h-12 border-[#9fb8d4] bg-white/55 px-5 hover:bg-white/80")} href="#how-it-works">{props.secondaryCtaLabel ?? "See how it works"}</Link>
              </div>
            </div>
            <div className={cx(productHero && "mt-14 w-full max-w-[860px] max-tablet:mt-10")}>
              <ProductArtifact agent={props.agent} mode={props.mode} />
            </div>
          </div>
        </section>

        <section className="border-b border-line bg-panel">
          <div className="shell grid grid-cols-3 divide-x divide-line max-tablet:grid-cols-1 max-tablet:divide-x-0 max-tablet:divide-y">
            {proof.map((item) => (
              <div key={item.label} className="px-7 py-7 first:pl-0 last:pr-0 max-tablet:px-0">
                <b className="block text-lg font-semibold text-ink-strong">{item.value}</b>
                <span className="mt-1 block text-sm text-muted">{item.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="shell grid grid-cols-[.72fr_1.28fr] gap-[clamp(58px,8vw,120px)] py-[clamp(82px,10vw,132px)] max-desktop:grid-cols-1" id="how-it-works">
          <div className="max-w-[430px] self-start desktop:sticky desktop:top-[calc(var(--header-h)+44px)]">
            <span className="text-sm font-semibold text-accent-strong">{props.sectionEyebrow ?? "The useful outcome"}</span>
            <h2 className="mb-0 mt-4 text-5xl font-semibold leading-[1.03] tracking-[-.045em] text-ink-strong text-balance max-tablet:text-4xl">{props.outcomeTitle}</h2>
            <p className="mt-5 text-base font-medium leading-[1.7] text-muted">{props.outcomeBody}</p>
          </div>
          <ol className="m-0 grid list-none gap-4 p-0">
            {props.steps.map((step, index) => (
              <li key={step.title} className="grid grid-cols-[52px_1fr] gap-5 rounded-md border border-line-strong bg-panel-raised p-6 shadow-[0_14px_36px_rgb(39_49_38_/_0.045)] max-tablet:grid-cols-[40px_1fr] max-tablet:p-5">
                <span className="grid size-11 place-items-center rounded-full bg-ink-strong text-sm font-bold text-signal max-tablet:size-9">{index + 1}</span>
                <div className="min-w-0">
                  <h3 className="m-0 text-xl font-semibold tracking-[-.025em] text-ink-strong">{step.title}</h3>
                  <p className="mb-0 mt-2 text-base font-medium leading-[1.65] text-muted">{step.body}</p>
                  {step.command ? <code className="mt-5 block overflow-x-auto rounded-sm bg-[#1b1e19] px-4 py-3.5 text-sm text-[#e8ebe3]"><span className="mr-2 text-signal" aria-hidden="true">$</span>{step.command}</code> : null}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-y border-line bg-[#edefe9] py-[clamp(76px,9vw,112px)]">
          <div className="shell">
            <div className="max-w-[720px]">
              <span className="text-sm font-semibold text-accent-strong">{props.principlesEyebrow ?? "Built into the workflow"}</span>
              <h2 className="mb-0 mt-4 text-5xl font-semibold leading-[1.04] tracking-[-.045em] text-ink-strong text-balance max-tablet:text-4xl">{props.principlesTitle ?? "Useful by design, clear about the boundary."}</h2>
            </div>
            <div className="mt-12 grid grid-cols-3 gap-3 max-desktop:grid-cols-1">
              {props.principles.map((principle, index) => (
                <article key={principle.title} className="flex min-h-[250px] flex-col rounded-md border border-line-strong bg-[#f9faf6] p-7 shadow-[inset_0_1px_rgb(255_255_255_/_0.8)]">
                  <span className="grid size-11 place-items-center rounded-full border border-line bg-white text-accent">{index === 0 ? <ShieldCheck size={18} aria-hidden="true" /> : index === 1 ? <MonitorCheck size={18} aria-hidden="true" /> : <Check size={18} aria-hidden="true" />}</span>
                  <div className="mt-auto pt-10">
                    <h3 className="m-0 text-xl font-semibold tracking-[-.03em] text-ink-strong">{principle.title}</h3>
                    <p className="mb-0 mt-3 text-base font-medium leading-[1.65] text-muted">{principle.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="shell py-[clamp(82px,10vw,128px)]">
          <div className="mx-auto max-w-[980px]">
            <header>
              <h2 className="m-0 text-4xl font-semibold leading-tight text-ink-strong text-balance max-tablet:text-3xl">Frequently asked questions</h2>
            </header>
            <div className="mt-8 grid gap-3">
              {props.faqs.map((faq, index) => (
                <details key={faq.question} open={index === 0} className="group overflow-hidden rounded-lg border border-line-strong bg-panel-raised px-8 shadow-[0_8px_24px_rgb(39_49_38_/_0.04)] transition-[border-color,box-shadow] open:border-[#b8c8da] open:shadow-[0_14px_34px_rgb(39_49_38_/_0.07)] max-tablet:px-5">
                  <summary className="grid min-h-[88px] cursor-pointer list-none grid-cols-[1fr_auto] items-center gap-4 py-5 text-lg font-semibold leading-snug text-ink-strong [&::-webkit-details-marker]:hidden max-tablet:gap-3 max-tablet:text-base">
                    <span>{faq.question}</span>
                    <span className="grid size-8 place-items-center rounded-full border border-line bg-canvas text-muted transition-colors group-open:border-accent group-open:text-accent-strong">
                      <ChevronDown className="transition-transform group-open:rotate-180" size={16} aria-hidden="true" />
                    </span>
                  </summary>
                  <p className="mb-0 mt-0 max-w-[760px] pb-7 pr-12 text-base font-medium leading-[1.7] text-muted max-tablet:pr-2">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="shell pb-[clamp(82px,10vw,126px)]">
          <div className="overflow-hidden rounded-lg bg-[#1b1e19] p-[clamp(28px,5vw,62px)] text-white shadow-[0_24px_70px_rgb(25_28_23_/_0.14)]">
            <div className="grid grid-cols-[.8fr_1.2fr] gap-14 max-desktop:grid-cols-1">
              <div>
                <Terminal className="text-signal" size={26} aria-hidden="true" />
                <h2 className="mb-0 mt-6 text-4xl font-semibold leading-[1.04] tracking-[-.04em] max-tablet:text-3xl">Keep exploring.</h2>
                <p className="mb-0 mt-4 max-w-[420px] text-base leading-[1.65] text-[#b7bdb1]">Follow the product from the question you have now to the exact workflow that answers it.</p>
              </div>
              <div className="grid gap-2">
                {props.related.map((link) => (
                  <Link key={link.href} href={link.href} className="group flex items-center gap-5 rounded-md border border-white/10 bg-white/[.045] px-5 py-4 transition-colors hover:bg-white/[.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">
                    <div className="min-w-0"><b className="block text-base font-semibold">{link.label}</b><span className="mt-1 block text-sm text-[#aeb4a9]">{link.detail}</span></div>
                    <ArrowRight className="ml-auto shrink-0 transition-transform group-hover:translate-x-1" size={18} aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter current={current} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    </>
  );
}
