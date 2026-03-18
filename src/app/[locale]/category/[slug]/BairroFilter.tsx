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
  filterLabel,
  allLabel,
}: {
  bairros: Bairro[];
  currentBairro: string;
  filterLabel: string;
  allLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function handleChange(value: string) {
    if (value) {
      router.push(`${pathname}?bairro=${value}`);
    } else {
      router.push(pathname);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-gray-500 whitespace-nowrap">
        {filterLabel}:
      </label>
      <select
        value={currentBairro}
        onChange={(e) => handleChange(e.target.value)}
        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
      >
        <option value="">{allLabel}</option>
        {bairros.map((b) => (
          <option key={b.id} value={b.slug}>
            {b.name}
          </option>
        ))}
      </select>
    </div>
  );
}
