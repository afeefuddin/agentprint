import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, ChevronDown, CircleCheck, EyeOff, FileSearch, ShieldCheck, Terminal } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { buttonClass, cx } from "@/lib/ui";
import { viewer } from "@/lib/auth";

export type SeoPageStep = {
  title: string;
  body: string;
  command?: string;
};

export type SeoPageFaq = { question: string; answer: string };

export type SeoPageLink = { href: string; label: string; detail: string };

export type SeoContentPageProps = {
  eyebrow: string;
  title: string;
  intro: string;
  qualifier?: string;
  agent: "codex" | "claude" | "kimi" | "opencode" | "agentprint";
  mode: "sharing" | "tracking" | "setup";
  outcomeTitle: string;
  outcomeBody: string;
  steps: SeoPageStep[];
  principles: Array<{ title: string; body: string }>;
  faqs: SeoPageFaq[];
  related: SeoPageLink[];
};

const brand = {
  codex: { name: "Codex", src: "/brands/codex.svg", color: "#171914" },
  claude: { name: "Claude Code", src: "/brands/claude.svg", color: "#d97757" },
  kimi: { name: "Kimi Code", src: "/brands/kimi.svg", color: "#171914" },
  opencode: { name: "OpenCode", src: "/brands/opencode.svg", color: "#211e1e" },
  agentprint: { name: "Agentprint", src: "/brand/agentprint-mark.svg", color: "#2868f6" }
};

function ProductArtifact({ agent, mode }: Pick<SeoContentPageProps, "agent" | "mode">) {
  const identity = brand[agent];
  const commands = mode === "setup"
    ? ["curl -fsSL agentprint.tech/install.sh | sh", "agentprint login", "agentprint status"]
    : mode === "sharing"
      ? ["agentprint sessions", "agentprint share 3 --dry-run", "agentprint share 3 --visibility unlisted"]
      : ["agentprint login", "agentprint sync", "agentprint status"];

  return (
    <div className="relative mx-auto w-full max-w-[640px]" aria-label={`${identity.name} workflow preview`} role="img">
      <div className="absolute -inset-10 rounded-full bg-[radial-gradient(circle,rgb(40_104_246_/_0.14),transparent_68%)] blur-xl" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-lg border border-white/10 bg-[#1b1e19] text-[#f6f7f2] shadow-[0_36px_90px_rgb(18_22_17_/_0.28)]">
        <div className="flex h-12 items-center gap-2 border-b border-white/10 px-4 text-[#9ca297]">
          <i className="size-2 rounded-full bg-[#f17878]" /><i className="size-2 rounded-full bg-[#e6bd62]" /><i className="size-2 rounded-full bg-[#75c18d]" />
          <span className="ml-2 text-xs">Agentprint terminal</span>
          <Image src={identity.src} alt="" width={18} height={18} className="ml-auto size-[18px] object-contain invert-[.08]" />
        </div>
        <div className="grid gap-3 px-5 py-6 font-mono text-xs max-tablet:px-4">
          {commands.map((command, index) => (
            <div key={command} className="flex items-start gap-3">
              <span className="mt-px text-[#c8ff58]">$</span>
              <code className="text-[#eef0e9]">{command}</code>
              {index === commands.length - 1 ? <CircleCheck className="ml-auto shrink-0 text-[#c8ff58]" size={15} /> : null}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 border-t border-white/10 max-tablet:grid-cols-1">
          <div className="border-r border-white/10 px-5 py-4 max-tablet:border-b max-tablet:border-r-0">
            <span className="block text-xs text-[#90978c]">Source</span>
            <b className="mt-1.5 flex items-center gap-2 text-sm font-semibold"><i className="size-2 rounded-full" style={{ background: identity.color }} />{identity.name}</b>
          </div>
          <div className="border-r border-white/10 px-5 py-4 max-tablet:border-b max-tablet:border-r-0">
            <span className="block text-xs text-[#90978c]">Content sync</span>
            <b className="mt-1.5 flex items-center gap-2 text-sm font-semibold"><EyeOff size={14} /> Off</b>
          </div>
          <div className="px-5 py-4">
            <span className="block text-xs text-[#90978c]">State</span>
            <b className="mt-1.5 flex items-center gap-2 text-sm font-semibold"><i className="size-2 rounded-full bg-[#c8ff58] shadow-[0_0_12px_#c8ff58]" /> Ready</b>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-6 -right-5 flex items-center gap-2 rounded-full border border-line-strong bg-white px-4 py-2.5 text-xs font-semibold text-ink-strong shadow-[0_12px_32px_rgb(39_49_38_/_0.12)] max-tablet:right-2">
        <ShieldCheck size={15} className="text-accent" /> Local first
      </div>
    </div>
  );
}

export async function SeoContentPage(props: SeoContentPageProps) {
  const current = await viewer();
  const ctaHref = current?.onboarding_complete ? `/${current.handle}` : current ? "/onboarding" : "/login";
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: props.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer }
    }))
  };

  return (
    <>
      <SiteHeader current={current} variant="marketing" />
      <main id="main" className="overflow-hidden">
        <section className="relative border-b border-line bg-[radial-gradient(circle_at_78%_28%,rgb(215_228_254_/_0.74),transparent_27%),linear-gradient(180deg,#fbfbf8_0%,#f2f3ee_100%)] py-[clamp(72px,9vw,132px)]">
          <div className="shell grid grid-cols-[minmax(0,.9fr)_minmax(460px,1.1fr)] items-center gap-[clamp(52px,7vw,100px)] max-desktop:grid-cols-1">
            <div className="max-w-[650px]">
              <div className="mb-7 flex items-center gap-3 text-sm font-semibold text-muted">
                <Link className="hover:text-accent" href="/">Agentprint</Link>
                <span className="text-line-strong">/</span>
                <span>{props.eyebrow}</span>
              </div>
              <h1 className="m-0 text-7xl font-semibold leading-[.98] tracking-[-.064em] text-ink-strong max-tablet:text-5xl">{props.title}</h1>
              <p className="mt-7 max-w-[610px] text-lg font-medium leading-[1.65] text-muted max-tablet:text-base">{props.intro}</p>
              {props.qualifier ? (
                <p className="mt-6 flex max-w-[610px] items-start gap-3 rounded-sm border border-line-strong bg-white/70 px-4 py-3.5 text-xs leading-[1.55] text-muted">
                  <FileSearch size={16} className="mt-0.5 shrink-0 text-accent" /> {props.qualifier}
                </p>
              ) : null}
              <div className="mt-8 flex flex-wrap gap-3">
                <Link className={cx(buttonClass({ variant: "signal" }), "min-h-12 px-5")} href={ctaHref}>Start with Agentprint <ArrowRight size={16} /></Link>
                <Link className={cx(buttonClass({ variant: "secondary" }), "min-h-12 px-5")} href="#how-it-works">See the workflow</Link>
              </div>
            </div>
            <ProductArtifact agent={props.agent} mode={props.mode} />
          </div>
        </section>

        <section className="shell grid grid-cols-[.72fr_1.28fr] gap-[clamp(60px,9vw,130px)] py-[clamp(86px,10vw,140px)] max-desktop:grid-cols-1" id="how-it-works">
          <div className="max-w-[420px]">
            <span className="text-xs font-semibold text-accent-strong">The useful outcome</span>
            <h2 className="mb-0 mt-4 text-5xl font-semibold leading-[1.02] tracking-[-.052em] text-ink-strong max-tablet:text-4xl">{props.outcomeTitle}</h2>
            <p className="mt-5 text-base font-medium leading-[1.7] text-muted">{props.outcomeBody}</p>
          </div>
          <ol className="m-0 grid list-none gap-3 p-0">
            {props.steps.map((step, index) => (
              <li key={step.title} className="grid grid-cols-[48px_1fr] gap-5 rounded-md border border-line bg-panel p-6 shadow-[0_12px_34px_rgb(39_49_38_/_0.035)] max-tablet:grid-cols-[38px_1fr] max-tablet:p-5">
                <span className="grid size-10 place-items-center rounded-full bg-ink-strong text-xs font-bold text-signal max-tablet:size-8">{index + 1}</span>
                <div>
                  <h3 className="m-0 text-lg font-semibold tracking-[-.025em] text-ink-strong">{step.title}</h3>
                  <p className="mb-0 mt-2 text-sm font-medium leading-[1.65] text-muted">{step.body}</p>
                  {step.command ? <code className="mt-4 block overflow-x-auto rounded-sm bg-[#1b1e19] px-4 py-3 text-xs text-[#e8ebe3]"><span className="mr-2 text-signal">$</span>{step.command}</code> : null}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-y border-line bg-[#edefe9] py-[clamp(76px,9vw,116px)]">
          <div className="shell">
            <div className="max-w-[620px]">
              <span className="text-xs font-semibold text-accent-strong">Designed around the boundary</span>
              <h2 className="mb-0 mt-4 text-6xl font-semibold leading-[1] tracking-[-.055em] text-ink-strong max-tablet:text-4xl">Useful signal, without casual exposure.</h2>
            </div>
            <div className="mt-12 grid grid-cols-3 gap-3 max-desktop:grid-cols-1">
              {props.principles.map((principle) => (
                <article key={principle.title} className="min-h-[240px] rounded-md border border-line-strong bg-[#f9faf6] p-7">
                  <span className="grid size-11 place-items-center rounded-full border border-line bg-white text-accent"><Check size={18} /></span>
                  <h3 className="mb-0 mt-10 text-xl font-semibold tracking-[-.035em] text-ink-strong">{principle.title}</h3>
                  <p className="mb-0 mt-3 text-sm font-medium leading-[1.65] text-muted">{principle.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="shell py-[clamp(82px,10vw,132px)]">
          <div className="grid grid-cols-[.72fr_1.28fr] gap-[clamp(60px,9vw,130px)] max-desktop:grid-cols-1">
            <div>
              <span className="text-xs font-semibold text-accent-strong">Questions, answered</span>
              <h2 className="mb-0 mt-4 text-6xl font-semibold leading-[1] tracking-[-.052em] text-ink-strong max-tablet:text-4xl">The details before you connect.</h2>
            </div>
            <div className="border-t border-line-strong">
              {props.faqs.map((faq) => (
                <details key={faq.question} className="group border-b border-line-strong">
                  <summary className="flex min-h-[78px] cursor-pointer list-none items-center gap-5 py-5 text-base font-semibold text-ink-strong [&::-webkit-details-marker]:hidden">
                    {faq.question}<ChevronDown className="ml-auto shrink-0 text-faint transition-transform group-open:rotate-180" size={17} />
                  </summary>
                  <p className="mt-0 max-w-[720px] pb-6 pr-10 text-sm font-medium leading-[1.7] text-muted">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="shell pb-[clamp(82px,10vw,130px)]">
          <div className="rounded-lg bg-[#1b1e19] p-[clamp(28px,5vw,64px)] text-white">
            <div className="grid grid-cols-[.8fr_1.2fr] gap-14 max-desktop:grid-cols-1">
              <div>
                <Terminal className="text-signal" size={26} />
                <h2 className="mb-0 mt-6 text-5xl font-semibold leading-[1.02] tracking-[-.05em] max-tablet:text-4xl">Keep exploring.</h2>
                <p className="mb-0 mt-4 max-w-[420px] text-sm leading-[1.65] text-[#aeb4a9]">Specific guides, honest product boundaries, and no padded marketing copy.</p>
              </div>
              <div className="grid gap-2">
                {props.related.map((link) => (
                  <Link key={link.href} href={link.href} className="group flex items-center gap-5 rounded-md border border-white/10 bg-white/[.045] px-5 py-4 transition-colors hover:bg-white/[.08]">
                    <div><b className="block text-sm font-semibold">{link.label}</b><span className="mt-1 block text-xs text-[#9da398]">{link.detail}</span></div>
                    <ArrowRight className="ml-auto transition-transform group-hover:translate-x-1" size={17} />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter current={current} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }} />
    </>
  );
}
