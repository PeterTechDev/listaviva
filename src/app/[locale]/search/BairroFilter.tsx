"use client";

import { useRouter } from "@/i18n/navigation";

interface Bairro {
  id: string;
  name: string;
}

export default function SearchBairroFilter({
  bairros,
  currentBairroId,
  query,
  allLabel,
}: {
  bairros: Bairro[];
  currentBairroId: string;
  query: string;
  allLabel: string;
}) {
  const router = useRouter();

  function handleSelect(id: string) {
    const params = new URLSearchParams({ q: query });
    if (id) params.set("bairro_id", id);
    router.push(`/search?${params.toString()}`);
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap scrollbar-none">
      <button
        onClick={() => handleSelect("")}
        className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
          !currentBairroId
            ? "bg-accent text-white"
            : "bg-surface border border-border text-muted hover:border-accent hover:text-accent"
        }`}
      >
        {allLabel}
      </button>
      {bairros.map((b) => (
        <button
          key={b.id}
          onClick={() => handleSelect(b.id)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
            currentBairroId === b.id
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
