"use client";

import Link from "next/link";
import { ChevronDown, Menu, MessagesSquare, ShieldCheck, UserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: typeof UserRound;
};

const products: NavItem[] = [
  { href: "/product/profile", label: "Profile", description: "One public home for your coding-agent activity.", icon: UserRound },
  { href: "/product/session-sharing", label: "Session sharing", description: "Publish one reviewed session as a controlled link.", icon: MessagesSquare }
];

const guides: NavItem[] = [
  { href: "/guides/share-claude-code-session", label: "Claude Code", description: "Preview and share a Claude Code session.", icon: ShieldCheck },
  { href: "/guides/share-codex-session", label: "Codex", description: "Preview and share a Codex session.", icon: ShieldCheck },
  { href: "/guides/share-kimi-code-session", label: "Kimi Code", description: "Preview and share a Kimi Code session.", icon: ShieldCheck }
];

const triggerClass = "group inline-flex min-h-[39px] items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-muted outline-none transition-colors hover:bg-panel hover:text-ink-strong focus-visible:bg-panel focus-visible:text-ink-strong data-[state=open]:bg-panel data-[state=open]:text-ink-strong";

function MenuItems({ items }: { items: NavItem[] }) {
  return items.map(({ href, label, description, icon: Icon }) => (
    <DropdownMenuItem key={href} asChild className="rounded-sm p-0 focus:bg-canvas-deep">
      <Link href={href} className="grid grid-cols-[38px_1fr] gap-3 px-3 py-3">
        <span className="grid size-[38px] place-items-center rounded-sm border border-line bg-canvas text-accent">
          <Icon size={17} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <b className="block text-sm font-semibold text-ink-strong">{label}</b>
          <span className="mt-0.5 block text-xs leading-snug text-muted">{description}</span>
        </span>
      </Link>
    </DropdownMenuItem>
  ));
}

function NavDropdown({ label, items }: { label: string; items: NavItem[] }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button type="button" className={triggerClass}>
          {label}
          <ChevronDown size={14} className="transition-transform group-data-[state=open]:rotate-180" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-[360px] rounded-md border-line-strong bg-panel-raised p-2">
        <DropdownMenuLabel className="px-3 pb-2 pt-1 text-xs font-semibold text-faint">{label}</DropdownMenuLabel>
        <MenuItems items={items} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MarketingNav() {
  return (
    <>
      <div className="mr-2 flex items-center gap-1 max-tablet:hidden">
        <NavDropdown label="Product" items={products} />
        <NavDropdown label="Guides" items={guides} />
      </div>

      <div className="mr-1 hidden max-tablet:block">
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button type="button" className={triggerClass} aria-label="Open navigation menu">
              <Menu size={16} aria-hidden="true" />
              Menu
              <ChevronDown size={14} className="transition-transform group-data-[state=open]:rotate-180" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="w-[min(360px,calc(100vw-24px))] rounded-md border-line-strong bg-panel-raised p-2">
            <DropdownMenuLabel className="px-3 pb-2 pt-1 text-xs font-semibold text-faint">Product</DropdownMenuLabel>
            <MenuItems items={products} />
            <div className="my-2 border-t border-line" />
            <DropdownMenuLabel className="px-3 pb-2 pt-1 text-xs font-semibold text-faint">Guides</DropdownMenuLabel>
            <MenuItems items={guides} />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}
