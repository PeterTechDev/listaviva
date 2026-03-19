"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { approveRecommendation, rejectRecommendation } from "./actions";

type Recommendation = {
  id: string;
  provider_name: string;
  whatsapp: string | null;
  description: string | null;
  created_at: string;
  category_id: string | null;
  categories: { name_pt: string } | null;
  bairros: { name: string } | null;
  profiles: { full_name: string | null } | null;
};

export default function RecommendationsManager({
  recommendations,
}: {
  recommendations: Recommendation[];
}) {
  const t = useTranslations("recommendations");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleApprove(id: string) {
    startTransition(async () => {
      const result = await approveRecommendation(id);
      if (result?.error) setError(result.error);
    });
  }

  function handleReject(id: string) {
    startTransition(async () => {
      const result = await rejectRecommendation(id);
      if (result?.error) setError(result.error);
    });
  }

  if (recommendations.length === 0) {
    return (
      <div className="py-16 text-center text-muted text-sm">{t("empty")}</div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-background border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                {t("providerName")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                {t("category")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                {t("whatsapp")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                {t("bairro")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                {t("description")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                {t("submitter")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                {t("date")}
              </th>
              <th className="px-4 py-3 w-36" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {recommendations.map((rec) => (
              <tr key={rec.id} className="hover:bg-background transition-colors">
                <td className="px-4 py-3 font-medium text-primary">{rec.provider_name}</td>
                <td className="px-4 py-3 text-muted">{rec.categories?.name_pt ?? "—"}</td>
                <td className="px-4 py-3 text-muted">{rec.whatsapp ?? "—"}</td>
                <td className="px-4 py-3 text-muted">{rec.bairros?.name ?? "—"}</td>
                <td className="px-4 py-3 text-muted max-w-xs truncate">{rec.description ?? "—"}</td>
                <td className="px-4 py-3 text-muted">{rec.profiles?.full_name ?? "—"}</td>
                <td className="px-4 py-3 text-muted">
                  {new Date(rec.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button
                    type="button"
                    onClick={() => handleApprove(rec.id)}
                    disabled={isPending}
                    className="px-3 py-1.5 bg-accent/10 text-accent rounded-lg text-xs font-medium hover:bg-accent/20 disabled:opacity-50 transition-colors"
                  >
                    {t("approve")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReject(rec.id)}
                    disabled={isPending}
                    className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 disabled:opacity-50 transition-colors"
                  >
                    {t("reject")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
