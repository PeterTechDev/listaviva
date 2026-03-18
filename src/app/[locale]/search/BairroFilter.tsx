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

  const pillBase = "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors";
  const pillActive = `${pillBase} bg-accent text-white`;
  const pillInactive = `${pillBase} bg-surface border border-border text-muted hover:border-accent hover:text-accent`;

  function handleSelect(id: string) {
    const params = new URLSearchParams({ q: query });
    if (id) params.set("bairro_id", id);
    router.push(`/search?${params.toString()}`);
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap scrollbar-none">
      <button
        onClick={() => handleSelect("")}
        className={currentBairroId ? pillInactive : pillActive}
      >
        {allLabel}
      </button>
      {bairros.map((b) => (
        <button
          key={b.id}
          onClick={() => handleSelect(b.id)}
          className={currentBairroId === b.id ? pillActive : pillInactive}
        >
          {b.name}
        </button>
      ))}
    </div>
  );
}
