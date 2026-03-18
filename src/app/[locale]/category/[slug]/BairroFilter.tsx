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
        className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
          !currentBairro
            ? "bg-accent text-white"
            : "bg-surface border border-border text-muted hover:border-accent hover:text-accent"
        }`}
      >
        {allLabel}
      </button>
      {bairros.map((b) => (
        <button
          key={b.id}
          onClick={() => handleSelect(b.slug)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
            currentBairro === b.slug
              ? "bg-accent text-white"
              : "bg-surface border border-border text-muted hover:border-accent hover:text-accent"
          }`}
        >
          {b.name}
        </button>
      ))}
    </div>
  );
}
