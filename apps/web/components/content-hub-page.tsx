import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Boxes,
  FileCode2,
  Fingerprint,
  Route,
  ShieldCheck,
  Terminal
} from "lucide-react";
import { viewer } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { buttonClass } from "@/lib/ui";

type HubItem = {
  href: string;
  title: string;
  description: string;
  label: string;
  mark?: string;
  tone?: "blue" | "cream" | "ink";
};

export type ContentHubPageProps = {
  eyebrow: string;
  title: string;
  intro: string;
  items: HubItem[];
  featured: HubItem;
  footnote: string;
};

const iconByLabel = {
  Integration: Boxes,
  Guide: BookOpen,
  Documentation: Terminal,
  Methodology: Fingerprint,
  Security: ShieldCheck,
  "Use case": Route
};

function ItemIcon({ item }: { item: HubItem }) {
  if (item.mark) {
    return <Image src={item.mark} alt="" width={24} height={24} className="size-6 object-contain" />;
  }
  const Icon = iconByLabel[item.label as keyof typeof iconByLabel] ?? FileCode2;
  return <Icon size={21} aria-hidden="true" />;
}

function LibraryMap({ items }: { items: HubItem[] }) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-white/60 bg-[#8fc1ff] p-6 shadow-[0_34px_90px_rgb(33_86_170_/_0.18)] before:pointer-events-none before:absolute before:inset-0 before:opacity-25 before:[background-image:radial-gradient(rgb(255_255_255_/_0.9)_0.7px,transparent_0.7px)] before:[background-size:5px_5px] before:content-[''] max-tablet:p-4" role="img" aria-label="Agentprint resource library map">
      <div className="relative z-[1] grid grid-cols-2 gap-2 max-tablet:grid-cols-1">
        {items.slice(0, 4).map((item, index) => (
          <div key={item.href} className={`rounded-sm border bg-white px-4 py-3 shadow-[0_8px_24px_rgb(28_60_110_/_0.1)] ${index === 0 ? "border-accent" : "border-white/75"}`}>
            <span className="mb-5 grid size-9 place-items-center rounded-sm bg-canvas-deep text-accent"><ItemIcon item={item} /></span>
            <b className="block text-sm font-semibold text-ink-strong">{item.title}</b>
            <span className="mt-1 block text-xs text-muted">{item.label}</span>
          </div>
        ))}
      </div>
      <div className="relative z-[1] mx-auto my-4 h-9 w-px border-l border-dashed border-[#557da7]" aria-hidden="true" />
      <div className="relative z-[1] mx-auto flex max-w-[430px] items-center gap-3 rounded-md border border-[#aebfd4] bg-white px-5 py-4 shadow-[0_14px_32px_rgb(28_60_110_/_0.13)]">
        <span className="grid size-10 place-items-center rounded-sm bg-accent-soft text-accent"><Route size={19} aria-hidden="true" /></span>
        <div><b className="block text-sm font-semibold text-ink-strong">One connected learning path</b><span className="text-xs text-muted">Discover → understand → connect</span></div>
      </div>
    </div>
  );
}

export async function ContentHubPage(props: ContentHubPageProps) {
  const current = await viewer();
  const ctaHref = current?.onboarding_complete ? `/${current.handle}` : current ? "/onboarding" : "/login";
  return (
    <>
      <SiteHeader current={current} variant="marketing" />
      <main id="main" className="bg-canvas">
        <section className="relative overflow-hidden border-b border-[#bfd0e3] bg-[#dcecff] py-[clamp(70px,9vw,120px)]">
          <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(rgb(255_255_255_/_0.45)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255_/_0.45)_1px,transparent_1px)] [background-size:42px_42px]" aria-hidden="true" />
          <div className="shell relative grid grid-cols-[minmax(0,.9fr)_minmax(460px,1.1fr)] items-center gap-[clamp(48px,7vw,100px)] max-desktop:grid-cols-1">
            <div className="max-w-[660px]">
              <p className="mb-4 text-sm font-semibold text-accent-strong">{props.eyebrow}</p>
              <h1 className="m-0 text-6xl font-semibold leading-[.98] tracking-[-.052em] text-ink-strong text-balance max-tablet:text-5xl">{props.title}</h1>
              <p className="mt-6 max-w-[610px] text-lg font-medium leading-[1.65] text-[#4f6278] max-tablet:text-base">{props.intro}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link className={buttonClass({ variant: "signal" })} href={ctaHref}>Start with Agentprint <ArrowRight size={16} aria-hidden="true" /></Link>
                <Link className={`${buttonClass({ variant: "secondary" })} border-[#9fb8d4] bg-white/30 hover:bg-white/60`} href="#library">Browse the library</Link>
              </div>
            </div>
            <LibraryMap items={props.items} />
          </div>
        </section>

        <section className="shell py-[clamp(76px,9vw,116px)]" id="library">
          <div className="grid grid-cols-[.72fr_1.28fr] gap-[clamp(52px,8vw,116px)] max-desktop:grid-cols-1">
            <div className="max-w-[430px] self-start desktop:sticky desktop:top-[calc(var(--header-h)+44px)]">
              <span className="text-sm font-semibold text-accent-strong">Explore by intent</span>
              <h2 className="mb-0 mt-4 text-5xl font-semibold leading-[1.03] tracking-[-.045em] text-ink-strong text-balance max-tablet:text-4xl">Find the page that answers your next question.</h2>
              <p className="mt-5 text-base leading-[1.7] text-muted">{props.footnote}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 max-tablet:grid-cols-1">
              {props.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex min-h-[240px] flex-col rounded-md border p-6 shadow-[0_14px_36px_rgb(39_49_38_/_0.04)] transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_22px_46px_rgb(39_49_38_/_0.08)] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent ${item.tone === "ink" ? "border-[#2c3029] bg-[#1b1e19] text-white" : item.tone === "blue" ? "border-[#bfd0e3] bg-[#eaf3ff] text-ink-strong" : "border-line-strong bg-panel-raised text-ink-strong"}`}
                >
                  <div className="flex items-start justify-between">
                    <span className={`grid size-11 place-items-center rounded-sm border ${item.tone === "ink" ? "border-white/10 bg-white/[.07] text-signal" : "border-line bg-white text-accent"}`}><ItemIcon item={item} /></span>
                    <span className={`text-xs font-semibold ${item.tone === "ink" ? "text-[#b7bdb1]" : "text-accent-strong"}`}>{item.label}</span>
                  </div>
                  <div className="mt-auto pt-10">
                    <h3 className="m-0 text-xl font-semibold tracking-[-.03em]">{item.title}</h3>
                    <p className={`mb-0 mt-3 text-base leading-[1.6] ${item.tone === "ink" ? "text-[#b7bdb1]" : "text-muted"}`}>{item.description}</p>
                    <span className={`mt-5 inline-flex items-center gap-2 text-sm font-semibold ${item.tone === "ink" ? "text-signal" : "text-accent-strong"}`}>Open page <ArrowRight className="transition-transform group-hover:translate-x-1" size={15} aria-hidden="true" /></span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="shell pb-[clamp(82px,10vw,126px)]">
          <div className="grid grid-cols-[1fr_auto] items-center gap-10 rounded-lg border border-line-strong bg-panel-raised p-[clamp(28px,5vw,58px)] shadow-[0_20px_62px_rgb(39_49_38_/_0.07)] max-tablet:grid-cols-1">
            <div className="max-w-[700px]">
              <span className="text-sm font-semibold text-accent-strong">Recommended next</span>
              <h2 className="mb-0 mt-4 text-4xl font-semibold tracking-[-.04em] text-ink-strong max-tablet:text-3xl">{props.featured.title}</h2>
              <p className="mb-0 mt-4 text-base leading-[1.65] text-muted">{props.featured.description}</p>
            </div>
            <Link className={buttonClass({ variant: "primary" })} href={props.featured.href}>Read next <ArrowRight size={16} aria-hidden="true" /></Link>
          </div>
        </section>
      </main>
      <SiteFooter current={current} />
    </>
  );
}
