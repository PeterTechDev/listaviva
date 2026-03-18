"use client";

import { useRouter, usePathname } from "@/i18n/navigation";

interface Bairro {
  id: string;
  name: string;
  slug: string;
}

export default function BairroFilter({
  bairros,
  currentBairro,
  allLabel,
}: {
  bairros: Bairro[];
  currentBairro: string;
  allLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const pillBase = "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors";
  const pillActive = `${pillBase} bg-accent text-white`;
  const pillInactive = `${pillBase} bg-surface border border-border text-muted hover:border-accent hover:text-accent`;

  function handleSelect(slug: string) {
    if (slug) {
      router.push(`${pathname}?bairro=${slug}`);
    } else {
      router.push(pathname);
    }
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap scrollbar-none">
      <button
        onClick={() => handleSelect("")}
        className={currentBairro ? pillInactive : pillActive}
      >
        {allLabel}
      </button>
      {bairros.map((b) => (
        <button
          key={b.id}
          onClick={() => handleSelect(b.slug)}
          className={currentBairro === b.slug ? pillActive : pillInactive}
        >
          {b.name}
        </button>
      ))}
    </div>
  );
}
