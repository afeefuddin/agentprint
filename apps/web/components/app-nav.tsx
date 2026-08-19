"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/friends", label: "Friends" },
  { href: "/sessions", label: "Sessions" },
  { href: "/settings", label: "Settings" }
];

export function AppNav({ handle }: { handle: string }) {
  const pathname = usePathname();
  const profileHref = `/${handle}`;
  const currentIf = (active: boolean) => (active ? ("page" as const) : undefined);
  return (
    <>
      <Link className="nav-link" href={profileHref} aria-current={currentIf(pathname === profileHref)}>
        Profile
      </Link>
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          className="nav-link"
          href={tab.href}
          aria-current={currentIf(pathname === tab.href || pathname.startsWith(`${tab.href}/`))}
        >
          {tab.label}
        </Link>
      ))}
    </>
  );
}
