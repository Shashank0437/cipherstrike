"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";

/**
 * Sidebar chrome aligned with Stitch agentic workspace (MD3 tokens, Material Symbols).
 * Main app shell for dashboard routes under `(app)`.
 */
const nav: {
  href: string;
  label: string;
  icon: string;
}[] = [
  { href: "/history", label: "Sessions", icon: "history" },
  { href: "/analytics", label: "Analytics", icon: "analytics" },
  { href: "/tools", label: "Tools", icon: "construction" },
];

const USER_ROLE = "L3 Security Engineer";
const PROFILE_IMAGE = "/profile-avatar.png";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const operatorName = user?.email
    ? user.email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Operator";

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  return (
    <div className="flex min-h-screen items-start bg-background font-sans text-on-surface">
      <aside className="sticky top-0 flex h-[100dvh] max-h-[100dvh] w-64 min-w-64 max-w-64 shrink-0 flex-col overflow-hidden border-r border-outline-variant bg-surface-container-low">
        <div className="shrink-0 px-6 pb-2 pt-6">
          <Link href="/history" className="flex items-center gap-3 rounded-lg transition hover:opacity-95">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
              <span
                className="material-symbols-outlined text-lg text-on-primary"
                style={{ fontVariationSettings: "'FILL' 1, 'wght' 400" }}
              >
                shield
              </span>
            </div>
            <div className="min-w-0 text-left">
              <h2 className="leading-none font-black tracking-tighter text-on-surface">CipherStrike</h2>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-outline">
                Offensive Security
              </p>
            </div>
          </Link>
        </div>

        <div className="shrink-0 px-6 pb-4 pt-2">
          <Link
            href="/run-scan"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-bold text-on-primary shadow-sm transition hover:opacity-90 active:scale-[0.99]"
          >
            <span className="material-symbols-outlined text-base">add</span>
            Run Scan
          </Link>
        </div>

        <nav
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-0 pb-2"
          aria-label="Main"
        >
          <div className="flex flex-col">
            {nav.map((item) => {
              const active =
                pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href + "/"));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    active
                      ? "flex items-center gap-3 border-r-4 border-primary bg-primary-container px-6 py-3 text-sm font-semibold text-on-primary-container transition-colors"
                      : "flex items-center gap-3 px-6 py-3 text-sm text-on-surface-variant transition-colors hover:bg-surface-container"
                  }
                >
                  <span className="material-symbols-outlined text-xl">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="shrink-0 space-y-0 border-t border-outline-variant px-2 pb-3 pt-3">
          <Link
            href="/docs"
            className={
              pathname === "/docs" || pathname?.startsWith("/docs/")
                ? "flex items-center gap-3 rounded-lg bg-primary-container px-4 py-2 text-xs font-medium text-on-primary-container transition-colors"
                : "flex items-center gap-3 rounded-lg px-4 py-2 text-xs font-medium text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
            }
          >
            <span className="material-symbols-outlined scale-90 text-lg">menu_book</span>
            Documentation
          </Link>
          <Link
            href="/support"
            className={
              pathname === "/support" || pathname?.startsWith("/support/")
                ? "mt-0.5 flex items-center gap-3 rounded-lg bg-primary-container px-4 py-2 text-xs font-medium text-on-primary-container transition-colors"
                : "mt-0.5 flex items-center gap-3 rounded-lg px-4 py-2 text-xs font-medium text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
            }
          >
            <span className="material-symbols-outlined scale-90 text-lg">help</span>
            Support
          </Link>
        </div>
      </aside>
      <div className="flex min-h-screen min-w-0 flex-1 flex-col bg-background">
        <header className="sticky top-0 z-40 flex items-center justify-end border-b border-outline-variant bg-background/90 px-6 py-3 backdrop-blur-sm">
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-outline-variant bg-surface-container-lowest shadow-sm ring-2 ring-surface-container-lowest transition hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              aria-expanded={menuOpen}
              aria-haspopup="true"
              aria-label="User menu"
            >
              <Image
                src={PROFILE_IMAGE}
                alt=""
                width={40}
                height={40}
                className="h-10 w-10 object-cover"
                priority
              />
            </button>
            {menuOpen ? (
              <div
                className="absolute right-0 top-[calc(100%+0.5rem)] w-[min(100vw-1.5rem,18rem)] rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-lg"
                role="menu"
                aria-label="Account"
              >
                <div className="flex items-start gap-3">
                  <Image
                    src={PROFILE_IMAGE}
                    alt=""
                    width={48}
                    height={48}
                    className="h-12 w-12 shrink-0 rounded-full object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-on-surface">{operatorName}</p>
                    <p className="mt-0.5 text-xs text-on-surface-variant">{USER_ROLE}</p>
                  </div>
                </div>
                <div className="mt-3 border-t border-outline-variant pt-3">
                  <button
                    type="button"
                    className="w-full rounded-lg py-2 text-left text-sm font-semibold text-primary transition hover:bg-surface-container"
                    onClick={() => {
                      setMenuOpen(false);
                      void logout();
                    }}
                  >
                    Sign out
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </header>
        <main className="min-h-full flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
