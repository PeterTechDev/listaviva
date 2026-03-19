"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { searchUnownedProviders, submitClaim } from "../actions";

type ProviderResult = {
  id: string;
  name: string;
  whatsapp: string | null;
  home_bairro: { name: string } | { name: string }[] | null;
};

export default function ClaimSearch() {
  const t = useTranslations("account");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProviderResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [claimedId, setClaimedId] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSearch() {
    setSearchError(null);
    startTransition(async () => {
      try {
        const data = await searchUnownedProviders(query);
        setResults(data as ProviderResult[]);
        setSearched(true);
      } catch {
        setSearchError(t("claimSearchError"));
      }
    });
  }

  function handleClaim(providerId: string) {
    setClaimError(null);
    startTransition(async () => {
      const result = await submitClaim(providerId);
      if (result.error === "duplicate") {
        setClaimError(t("claimDuplicate"));
      } else if (result.error === "owned") {
        setClaimError(t("claimOwned"));
      } else if (result.error) {
        setClaimError(t("claimError"));
      } else {
        setClaimedId(providerId);
      }
    });
  }

  if (claimedId) {
    return (
      <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700">
        {t("claimSent")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder={t("claimSearch")}
          className="flex-1 px-3 py-2 border border-border rounded-lg text-sm bg-background text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <button
          onClick={handleSearch}
          disabled={!query.trim() || isPending}
          className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
        >
          {t("claimSearchButton")}
        </button>
      </div>

      {searchError && (
        <p className="text-sm text-red-600">{searchError}</p>
      )}

      {claimError && (
        <p className="text-sm text-red-600">{claimError}</p>
      )}

      {searched && results.length === 0 && (
        <p className="text-sm text-muted py-4 text-center">
          {t("claimNoResults")}
        </p>
      )}

      {results.map((p) => {
        const bairroRaw = p.home_bairro;
        const bairroName = Array.isArray(bairroRaw)
          ? bairroRaw[0]?.name
          : bairroRaw?.name;

        return (
          <div
            key={p.id}
            className="flex items-center justify-between p-4 bg-surface rounded-xl border border-border"
          >
            <div>
              <p className="font-medium text-primary">{p.name}</p>
              {bairroName && (
                <p className="text-sm text-muted">📍 {bairroName}</p>
              )}
            </div>
            <button
              onClick={() => handleClaim(p.id)}
              disabled={isPending}
              className="px-3 py-1.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
            >
              {t("claimSubmit")}
            </button>
          </div>
        );
      })}
    </div>
  );
}
