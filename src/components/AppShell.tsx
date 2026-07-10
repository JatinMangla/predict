"use client";

// Top navigation + language toggle. Wraps every authenticated page.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  const { t, lang, setLang } = useI18n();
  const pathname = usePathname();

  const nav = [
    { href: "/", label: t("dashboard") },
    { href: "/new", label: t("newProfile") },
    { href: "/settings", label: t("settings") },
  ];

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-3 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-(--color-gold) text-lg text-(--color-gold)">
            ॐ
          </span>
          <span className="text-lg font-semibold tracking-wide text-(--color-gold-soft)">
            {t("appName")}
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`rounded-md px-3 py-1.5 transition ${
                pathname === n.href
                  ? "bg-(--color-surface-3) text-(--color-gold-soft)"
                  : "text-(--color-ink-soft) hover:text-(--color-ink)"
              }`}
            >
              {n.label}
            </Link>
          ))}
          <button
            onClick={() => setLang(lang === "en" ? "hi" : "en")}
            className="ml-2 rounded-md border border-(--color-line) px-3 py-1.5 text-(--color-ink-soft) transition hover:text-(--color-gold-soft)"
            title="Language / भाषा"
          >
            {lang === "en" ? "हिंदी" : "EN"}
          </button>
          <a
            href="/api/auth/signout"
            className="rounded-md px-3 py-1.5 text-(--color-ink-soft) hover:text-(--color-ink)"
          >
            {t("signOut")}
          </a>
        </nav>
      </header>
      {children}
    </div>
  );
}
