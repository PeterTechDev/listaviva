"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { deleteProvider } from "./actions";

interface Provider {
  id: string;
  name: string;
  slug: string;
  status: string;
  tier: string;
  created_at: string;
  home_bairro: { name: string } | { name: string }[] | null;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  pending: "bg-yellow-100 text-yellow-700",
  inactive: "bg-gray-100 text-gray-600",
};

export default function ProvidersClient({
  providers,
  currentQ,
  currentStatus,
}: {
  providers: Provider[];
  currentQ: string;
  currentStatus: string;
}) {
  const t = useTranslations("adminProviders");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState(currentQ);
  const [status, setStatus] = useState(currentStatus);

  function applyFilters(newQ: string, newStatus: string) {
    const params = new URLSearchParams();
    if (newQ) params.set("q", newQ);
    if (newStatus && newStatus !== "all") params.set("status", newStatus);
    router.push(`/admin/providers?${params.toString()}`);
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`${t("deleteConfirm")} "${name}"?`)) return;
    startTransition(async () => {
      const result = await deleteProvider(id);
      if ("error" in result && result.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && applyFilters(q, status)}
          placeholder={t("searchPlaceholder")}
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            applyFilters(q, e.target.value);
          }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="all">{t("allStatuses")}</option>
          <option value="active">{t("statusActive")}</option>
          <option value="pending">{t("statusPending")}</option>
          <option value="inactive">{t("statusInactive")}</option>
        </select>
        <button
          onClick={() => applyFilters(q, status)}
          className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900 transition-colors"
        >
          Filtrar
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {providers.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            {t("empty")}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {t("name")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {t("homeBairro")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {t("status")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {t("tier")}
                </th>
                <th className="px-4 py-3 w-32" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {providers.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {p.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {(Array.isArray(p.home_bairro) ? p.home_bairro[0]?.name : p.home_bairro?.name) ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[p.status] ?? ""}`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{p.tier}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <a
                      href={`./providers/${p.id}/edit`}
                      className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors inline-block"
                    >
                      {t("edit")}
                    </a>
                    <button
                      onClick={() => handleDelete(p.id, p.name)}
                      disabled={isPending}
                      className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 disabled:opacity-50 transition-colors"
                    >
                      {t("delete")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
