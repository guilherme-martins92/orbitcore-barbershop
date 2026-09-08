"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "agenda", label: "Agenda" },
  { href: "services", label: "Serviços" },
  { href: "professionals", label: "Profissionais" },
];

export function AdminNav({ barbershopSlug }: { barbershopSlug: string }) {
  const pathname = usePathname();

  return (
    <nav className="mb-10 flex gap-6 border-b border-brass/20 pb-4">
      {LINKS.map((link) => {
        const href = `/${barbershopSlug}/${link.href}`;
        const isActive = pathname === href;
        return (
          <Link
            key={link.href}
            href={href}
            className={`font-sans text-sm transition-colors ${
              isActive ? "text-brass" : "text-paper/60 hover:text-paper"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
