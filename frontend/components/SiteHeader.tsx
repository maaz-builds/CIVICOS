"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Camera, Home, Menu, Radar, Search, X } from "lucide-react";

const NAV_LINKS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/report", label: "Report", icon: Camera },
  { href: "/track", label: "Track", icon: Search },
  { href: "/nearby", label: "Nearby", icon: Radar },
];

/** Ashoka-chakra-inspired mark: a ringed wheel with a chakra-blue hub. */
function LogoMark() {
  return (
    <span
      aria-hidden="true"
      className="grid size-9 place-items-center rounded-xl border border-white/15 bg-navy-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
    >
      <span className="relative grid size-6 place-items-center rounded-full border-2 border-chakra-400/70">
        <span className="size-1.5 rounded-full bg-chakra-400" />
        <span className="absolute inset-[3px] rounded-full border border-chakra-400/25" />
      </span>
    </span>
  );
}

export default function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-50">
      {/* Tricolor hairline - the only literal tricolor band in the app. */}
      <div
        aria-hidden="true"
        className="h-[3px] w-full bg-gradient-to-r from-saffron-500 via-ivory-100 to-india-500"
      />
      <div className="border-b border-white/10 bg-navy-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="group flex items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chakra-400"
            aria-label="CivicFix home"
          >
            <LogoMark />
            <span className="leading-tight">
              <span className="block font-display text-lg font-semibold tracking-tight text-white">
                CivicFix
              </span>
              <span className="block text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
                Hyderabad
              </span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={`relative flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition ${
                  isActive(href)
                    ? "text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                }`}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
                {isActive(href) && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-2 -bottom-px h-px bg-gradient-to-r from-saffron-500/80 via-chakra-400/80 to-india-400/80"
                  />
                )}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 rounded-full border border-india-400/30 bg-india-500/10 px-3 py-1.5 text-xs font-semibold text-india-400 sm:inline-flex">
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-india-400 animate-civicfix-pulse"
              />
              AI Powered
            </span>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
              className="grid size-10 place-items-center rounded-lg border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10 md:hidden"
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {menuOpen && (
          <nav
            aria-label="Primary mobile"
            className="border-t border-white/10 px-4 pb-4 pt-2 md:hidden"
          >
            {NAV_LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                aria-current={isActive(href) ? "page" : undefined}
                className={`mt-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive(href)
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                }`}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}