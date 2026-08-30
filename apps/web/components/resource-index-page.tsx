import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  FileCode2,
  Fingerprint,
  Route,
  ShieldCheck,
  Terminal
} from "lucide-react";
import { viewer } from "@/lib/auth";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export type ResourceItem = {
  href: string;
  title: string;
  description: string;
  label: string;
  mark?: string;
};

type ResourceIndexPageProps = {
  title: string;
  intro: string;
  items: ResourceItem[];
};

const iconByLabel = {
  Integration: Route,
  Guide: BookOpen,
  Product: Terminal,
  "Start here": Terminal,
  Methodology: Fingerprint,
  Security: ShieldCheck
};

function ResourceIcon({ item }: { item: ResourceItem }) {
  if (item.mark) {
    return <Image src={item.mark} alt="" width={26} height={26} className="size-7 object-contain" />;
  }

  const Icon = iconByLabel[item.label as keyof typeof iconByLabel] ?? FileCode2;
  return <Icon size={22} aria-hidden="true" />;
}

export async function ResourceIndexPage({ title, intro, items }: ResourceIndexPageProps) {
  const current = await viewer();

  return (
    <>
      <SiteHeader current={current} variant="marketing" />
      <main id="main" className="min-h-screen bg-canvas">
        <div className="shell pb-[clamp(72px,9vw,112px)] pt-[calc(var(--header-h)+clamp(56px,7vw,88px))]">
          <header className="max-w-[720px] border-b border-line-strong pb-10">
            <h1 className="m-0 text-5xl font-semibold leading-tight text-ink-strong max-tablet:text-4xl">{title}</h1>
            <p className="mb-0 mt-5 max-w-[650px] text-lg leading-relaxed text-muted max-tablet:text-base">{intro}</p>
          </header>

          <div className="mt-10 grid grid-cols-2 gap-4 max-tablet:grid-cols-1">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex min-h-[220px] flex-col rounded-md border border-line-strong bg-panel-raised p-7 shadow-[0_10px_28px_rgb(39_49_38_/_0.035)] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-[#aeb8a8] hover:shadow-[0_16px_34px_rgb(39_49_38_/_0.07)] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent max-tablet:min-h-0 max-tablet:p-6"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="grid size-11 place-items-center rounded-sm border border-line bg-canvas text-accent">
                    <ResourceIcon item={item} />
                  </span>
                  <span className="text-xs font-semibold text-muted">{item.label}</span>
                </div>

                <div className="mt-auto pt-9 max-tablet:pt-7">
                  <h2 className="m-0 text-2xl font-semibold leading-snug text-ink-strong max-tablet:text-xl">{item.title}</h2>
                  <p className="mb-0 mt-3 text-base leading-relaxed text-muted">{item.description}</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-accent-strong">
                    Read more
                    <ArrowRight className="transition-transform group-hover:translate-x-1" size={15} aria-hidden="true" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter current={current} />
    </>
  );
}
