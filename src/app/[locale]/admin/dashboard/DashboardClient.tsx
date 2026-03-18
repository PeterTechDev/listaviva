"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type {
  ProviderStats,
  PendingActions,
  CategoryCount,
  BairroCount,
  TopQuery,
  ZeroResultQuery,
  SupplyDemandRow,
} from "@/lib/dashboard";

type Tab = "overview" | "search" | "supply";

type Props = {
  stats: ProviderStats;
  pendingActions: PendingActions;
  byCategory: CategoryCount[];
  byBairro: BairroCount[];
  topQueries: TopQuery[];
  zeroQueries: ZeroResultQuery[];
  supplyDemand: SupplyDemandRow[];
};

export default function DashboardClient({
  stats,
  pendingActions,
  byCategory,
  byBairro,
  topQueries,
  zeroQueries,
  supplyDemand,
}: Props) {
  const t = useTranslations("dashboard");
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const totalSearches =
    topQueries.reduce((s, r) => s + Number(r.search_count), 0) +
    zeroQueries.reduce((s, r) => s + Number(r.search_count), 0);

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: t("overview") },
    { id: "search", label: t("searchAnalytics") },
    { id: "supply", label: t("supplyDemand") },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("title")}</h1>

      {/* Tab bar */}
      <div role="tablist" className="flex gap-1 border-b border-gray-200 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === tab.id
                ? "bg-white border border-b-white border-gray-200 text-gray-900 -mb-px"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {activeTab === "overview" && (
        <div role="tabpanel" className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label={t("activeProviders")} value={stats.active} />
            <StatCard label={t("pendingProviders")} value={stats.pending} />
            <StatCard label={t("totalSearches")} value={totalSearches} />
            <StatCard label={t("pendingActions")} value={pendingActions.total} />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="col-span-2 bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-sm font-semibold mb-4">{t("byCategory")}</h2>
              {byCategory.length === 0 ? (
                <p className="text-sm text-gray-400">{t("noData")}</p>
              ) : (
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(byCategory.length * 28, 100)}
                >
                  <BarChart layout="vertical" data={byCategory}>
                    <XAxis type="number" />
                    <YAxis dataKey="name_pt" type="category" width={100} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#6366f1" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-sm font-semibold mb-4">{t("byBairro")}</h2>
              {byBairro.length === 0 ? (
                <p className="text-sm text-gray-400">{t("noData")}</p>
              ) : (
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(byBairro.length * 28, 100)}
                >
                  <BarChart layout="vertical" data={byBairro}>
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#10b981" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Search Analytics */}
      {activeTab === "search" && (
        <div role="tabpanel" className="grid grid-cols-2 gap-4">
          {/* Top queries */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-semibold mb-4">{t("topQueries")}</h2>
            {topQueries.length === 0 ? (
              <p className="text-sm text-gray-400">{t("noData")}</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-100">
                    <th className="text-left py-2 font-medium">{t("query")}</th>
                    <th className="text-right py-2 font-medium">{t("count")}</th>
                    <th className="text-right py-2 font-medium">{t("avgResults")}</th>
                  </tr>
                </thead>
                <tbody>
                  {topQueries.map((row) => (
                    <tr key={row.query_text} className="border-b border-gray-50">
                      <td className="py-2">{row.query_text}</td>
                      <td className="py-2 text-right">{Number(row.search_count)}</td>
                      <td className="py-2 text-right">{Number(row.avg_results).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Zero-result queries */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-semibold mb-4 text-red-600">{t("zeroResults")}</h2>
            {zeroQueries.length === 0 ? (
              <p className="text-sm text-gray-400">{t("noData")}</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-100">
                    <th className="text-left py-2 font-medium">{t("query")}</th>
                    <th className="text-right py-2 font-medium">{t("searches")}</th>
                  </tr>
                </thead>
                <tbody>
                  {zeroQueries.map((row) => (
                    <tr key={row.query_text} className="border-b border-gray-50">
                      <td className="py-2">{row.query_text}</td>
                      <td className="py-2 text-right">{Number(row.search_count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab: Supply & Demand */}
      {activeTab === "supply" && (
        <div role="tabpanel" className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold mb-4">{t("supplyDemand")}</h2>
          {supplyDemand.length === 0 ? (
            <p className="text-sm text-gray-400">{t("noData")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-gray-100">
                  <th className="text-left py-2 font-medium">{t("category")}</th>
                  <th className="text-right py-2 font-medium">{t("providers")}</th>
                </tr>
              </thead>
              <tbody>
                {supplyDemand.map((row) => (
                  <tr key={row.name_pt} className="border-b border-gray-50">
                    <td className="py-2">{row.name_pt}</td>
                    <td className="py-2 text-right font-mono">{Number(row.provider_count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
      <div className="text-3xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}
