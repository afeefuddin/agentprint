"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/friends", label: "Friends" },
  { href: "/sessions", label: "Sessions" },
  { href: "/settings", label: "Settings" }
];

const LINK =
  "rounded-full px-2.5 py-2 text-sm text-muted hover:text-ink-strong aria-[current=page]:bg-canvas-deep aria-[current=page]:text-ink-strong max-desktop:whitespace-nowrap max-desktop:px-[7px]";

export function AppNav({ handle }: { handle: string }) {
  const pathname = usePathname();
  const profileHref = `/${handle}`;
  const currentIf = (active: boolean) => (active ? ("page" as const) : undefined);
  return (
    <>
      <Link className={LINK} href={profileHref} aria-current={currentIf(pathname === profileHref)}>
        Profile
      </Link>
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          className={LINK}
          href={tab.href}
          aria-current={currentIf(pathname === tab.href || pathname.startsWith(`${tab.href}/`))}
        >
          {tab.label}
        </Link>
      ))}
    </>
  );
}
