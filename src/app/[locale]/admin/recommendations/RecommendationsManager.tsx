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
    return <p className="text-gray-500">{t("empty")}</p>;
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 pr-4 font-medium">{t("providerName")}</th>
              <th className="py-2 pr-4 font-medium">{t("category")}</th>
              <th className="py-2 pr-4 font-medium">{t("whatsapp")}</th>
              <th className="py-2 pr-4 font-medium">{t("bairro")}</th>
              <th className="py-2 pr-4 font-medium">{t("description")}</th>
              <th className="py-2 pr-4 font-medium">{t("submitter")}</th>
              <th className="py-2 pr-4 font-medium">{t("date")}</th>
              <th className="py-2 font-medium">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {recommendations.map((rec) => (
              <tr key={rec.id} className="border-b">
                <td className="py-2 pr-4 font-medium">{rec.provider_name}</td>
                <td className="py-2 pr-4">{rec.categories?.name_pt ?? "—"}</td>
                <td className="py-2 pr-4">{rec.whatsapp ?? "—"}</td>
                <td className="py-2 pr-4">{rec.bairros?.name ?? "—"}</td>
                <td className="py-2 pr-4 max-w-xs truncate">{rec.description ?? "—"}</td>
                <td className="py-2 pr-4">{rec.profiles?.full_name ?? "—"}</td>
                <td className="py-2 pr-4">
                  {new Date(rec.created_at).toLocaleDateString()}
                </td>
                <td className="py-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(rec.id)}
                      disabled={isPending}
                      className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 disabled:opacity-50"
                    >
                      {t("approve")}
                    </button>
                    <button
                      onClick={() => handleReject(rec.id)}
                      disabled={isPending}
                      className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700 disabled:opacity-50"
                    >
                      {t("reject")}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
