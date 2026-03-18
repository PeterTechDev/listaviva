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
  Cell,
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

const STAT_CARDS = [
  { key: "activeProviders" as const, color: "emerald", icon: "✓" },
  { key: "pendingProviders" as const, color: "amber", icon: "⏳" },
  { key: "totalSearches" as const, color: "indigo", icon: "🔍" },
  { key: "pendingActions" as const, color: "rose", icon: "!" },
];

const COLOR_MAP: Record<string, { bg: string; text: string; ring: string; dot: string }> = {
  emerald: { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200", dot: "bg-emerald-500" },
  amber:   { bg: "bg-amber-50",   text: "text-amber-700",   ring: "ring-amber-200",   dot: "bg-amber-500"   },
  indigo:  { bg: "bg-indigo-50",  text: "text-indigo-700",  ring: "ring-indigo-200",  dot: "bg-indigo-500"  },
  rose:    { bg: "bg-rose-50",    text: "text-rose-700",    ring: "ring-rose-200",    dot: "bg-rose-500"    },
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

  const statValues = {
    activeProviders: stats.active,
    pendingProviders: stats.pending,
    totalSearches,
    pendingActions: pendingActions.total,
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: t("overview") },
    { id: "search",   label: t("searchAnalytics") },
    { id: "supply",   label: t("supplyDemand") },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">{t("title")}</h1>
          <p className="text-xs text-gray-400 mt-0.5">Listaviva · Linhares, ES</p>
        </div>
        {pendingActions.total > 0 && (
          <span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-700 ring-1 ring-rose-200 text-xs font-semibold px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            {pendingActions.total} {t("pendingActions").toLowerCase()}
          </span>
        )}
      </div>

      {/* Tab bar */}
      <div role="tablist" className="flex gap-px bg-gray-200 rounded-lg p-0.5 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
              activeTab === tab.id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Overview ─────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div role="tabpanel" className="space-y-5">
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {STAT_CARDS.map(({ key, color, icon }) => {
              const c = COLOR_MAP[color];
              return (
                <div
                  key={key}
                  className={`${c.bg} ring-1 ${c.ring} rounded-xl p-4 flex items-start gap-3`}
                >
                  <span className={`mt-0.5 flex-shrink-0 w-7 h-7 rounded-lg ${c.dot} text-white flex items-center justify-center text-xs font-bold`}>
                    {icon}
                  </span>
                  <div>
                    <div className={`text-2xl font-bold ${c.text} leading-none`}>
                      {statValues[key]}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 leading-tight">
                      {t(key)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <ChartCard title={t("byCategory")} className="lg:col-span-2" noData={byCategory.length === 0} noDataLabel={t("noData")}>
              <ResponsiveContainer width="100%" height={Math.max(byCategory.length * 32, 120)}>
                <BarChart layout="vertical" data={byCategory} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name_pt" type="category" width={110} tick={{ fontSize: 12, fill: "#374151" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: "#f3f4f6" }}
                    contentStyle={{ border: "none", borderRadius: 8, boxShadow: "0 4px 6px -1px rgb(0 0 0 / .1)", fontSize: 12 }}
                  />
                  <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={t("byBairro")} noData={byBairro.length === 0} noDataLabel={t("noData")}>
              <ResponsiveContainer width="100%" height={Math.max(byBairro.length * 32, 120)}>
                <BarChart layout="vertical" data={byBairro} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 12, fill: "#374151" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: "#f3f4f6" }}
                    contentStyle={{ border: "none", borderRadius: 8, boxShadow: "0 4px 6px -1px rgb(0 0 0 / .1)", fontSize: 12 }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20}>
                    {byBairro.map((_, i) => (
                      <Cell key={i} fill={`hsl(${160 + i * 8}, 60%, ${45 + i * 2}%)`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </div>
      )}

      {/* ── Tab: Search Analytics ──────────────────────────────────── */}
      {activeTab === "search" && (
        <div role="tabpanel" className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DataCard title={t("topQueries")}>
            {topQueries.length === 0 ? (
              <EmptyState label={t("noData")} />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                    <th className="text-left pb-2 font-medium">{t("query")}</th>
                    <th className="text-right pb-2 font-medium">{t("count")}</th>
                    <th className="text-right pb-2 font-medium">{t("avgResults")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {topQueries.map((row, i) => (
                    <tr key={row.query_text} className="hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 flex items-center gap-2">
                        <span className="text-xs text-gray-300 font-mono w-4">{i + 1}</span>
                        <span className="font-medium text-gray-800">{row.query_text}</span>
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-gray-600">{Number(row.search_count)}</td>
                      <td className="py-2.5 text-right tabular-nums text-gray-500">{Number(row.avg_results).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </DataCard>

          <DataCard title={t("zeroResults")} titleClass="text-rose-600">
            {zeroQueries.length === 0 ? (
              <EmptyState label={t("noData")} />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                    <th className="text-left pb-2 font-medium">{t("query")}</th>
                    <th className="text-right pb-2 font-medium">{t("searches")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {zeroQueries.map((row, i) => (
                    <tr key={row.query_text} className="hover:bg-rose-50/50 transition-colors">
                      <td className="py-2.5 flex items-center gap-2">
                        <span className="text-xs text-gray-300 font-mono w-4">{i + 1}</span>
                        <span className="font-medium text-gray-800">{row.query_text}</span>
                      </td>
                      <td className="py-2.5 text-right tabular-nums">
                        <span className="bg-rose-50 text-rose-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                          {Number(row.search_count)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </DataCard>
        </div>
      )}

      {/* ── Tab: Supply & Demand ───────────────────────────────────── */}
      {activeTab === "supply" && (
        <div role="tabpanel">
          <DataCard title={t("supplyDemand")}>
            {supplyDemand.length === 0 ? (
              <EmptyState label={t("noData")} />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                    <th className="text-left pb-2 font-medium">{t("category")}</th>
                    <th className="text-right pb-2 font-medium">{t("providers")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {supplyDemand.map((row) => {
                    const count = Number(row.provider_count);
                    const isEmpty = count === 0;
                    return (
                      <tr key={row.name_pt} className="hover:bg-gray-50 transition-colors">
                        <td className="py-2.5 font-medium text-gray-800">{row.name_pt}</td>
                        <td className="py-2.5 text-right">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full tabular-nums ${
                            isEmpty
                              ? "bg-rose-50 text-rose-700"
                              : count <= 2
                              ? "bg-amber-50 text-amber-700"
                              : "bg-gray-100 text-gray-600"
                          }`}>
                            {count}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </DataCard>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ChartCard({
  title,
  children,
  noData,
  noDataLabel,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  noData: boolean;
  noDataLabel: string;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-xl border border-gray-100 shadow-sm p-5 ${className}`}>
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">{title}</h2>
      {noData ? <EmptyState label={noDataLabel} /> : children}
    </div>
  );
}

function DataCard({
  title,
  titleClass = "text-gray-800",
  children,
}: {
  title: string;
  titleClass?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <h2 className={`text-sm font-semibold mb-4 ${titleClass}`}>{title}</h2>
      {children}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-gray-300">
      <span className="text-3xl mb-2">—</span>
      <span className="text-xs">{label}</span>
    </div>
  );
}
