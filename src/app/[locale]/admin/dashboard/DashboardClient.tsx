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
import { CheckCircle, Clock, Search, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import type {
  ProviderStats,
  PendingActions,
  CategoryCount,
  BairroCount,
  TopQuery,
  ZeroResultQuery,
  SupplyDemandRow,
} from "@/lib/dashboard";

// ── Brand palette constants ──────────────────────────────────────────────────
const TERRACOTTA = "#C85C38";
const WARM = "#E8A040";

// ── Types ────────────────────────────────────────────────────────────────────

type Props = {
  stats: ProviderStats;
  pendingActions: PendingActions;
  byCategory: CategoryCount[];
  byBairro: BairroCount[];
  topQueries: TopQuery[];
  zeroQueries: ZeroResultQuery[];
  supplyDemand: SupplyDemandRow[];
};

// ── Stat card config ─────────────────────────────────────────────────────────

type StatConfig = {
  key: "activeProviders" | "pendingProviders" | "totalSearches" | "pendingActions";
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  iconStyle: React.CSSProperties;
  pulse?: boolean;
};

const STAT_CARDS: StatConfig[] = [
  { key: "activeProviders", icon: CheckCircle, iconStyle: { color: TERRACOTTA } },
  { key: "pendingProviders", icon: Clock, iconStyle: { color: "#F59E0B" } },
  { key: "totalSearches", icon: Search, iconStyle: { color: "#3B82F6" } },
  { key: "pendingActions", icon: AlertCircle, iconStyle: { color: "#F43F5E" }, pulse: true },
];

// ── Chart shared styles ──────────────────────────────────────────────────────

const CHART_TICK_STYLE = { fontSize: 11, fill: "#71717a" }; // zinc-500
const CHART_TOOLTIP_STYLE = {
  background: "#27272a",
  border: "1px solid #3f3f46",
  borderRadius: 8,
  fontSize: 12,
  color: "#f4f4f5",
};
const CHART_CURSOR_FILL = "rgba(255,255,255,0.04)";

// ── Component ────────────────────────────────────────────────────────────────

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
  const [activeTab, setActiveTab] = useState<"overview" | "search" | "supply">("overview");

  const totalSearches =
    topQueries.reduce((s, r) => s + r.search_count, 0) +
    zeroQueries.reduce((s, r) => s + r.search_count, 0);

  const statValues = {
    activeProviders: stats.active ?? 0,
    pendingProviders: stats.pending ?? 0,
    totalSearches,
    pendingActions: pendingActions.total ?? 0,
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight">{t("title")}</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Listaviva · Linhares, ES</p>
        </div>
        {pendingActions.total > 0 && (
          <span className="inline-flex items-center gap-1.5 bg-rose-950/60 text-rose-400 ring-1 ring-rose-800 text-xs font-semibold px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            {pendingActions.total} {t("pendingActions").toLowerCase()}
          </span>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="overview" className="data-active:bg-zinc-800 data-active:text-zinc-100 text-zinc-400">
            {t("overview")}
          </TabsTrigger>
          <TabsTrigger value="search" className="data-active:bg-zinc-800 data-active:text-zinc-100 text-zinc-400">
            {t("searchAnalytics")}
          </TabsTrigger>
          <TabsTrigger value="supply" className="data-active:bg-zinc-800 data-active:text-zinc-100 text-zinc-400">
            {t("supplyDemand")}
          </TabsTrigger>
        </TabsList>

        {/* ── Overview tab ─────────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-5 mt-4">
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {STAT_CARDS.map(({ key, icon: Icon, iconStyle, pulse }) => {
              const value = statValues[key];
              const showPulse = pulse && value > 0;
              return (
                <Card
                  key={key}
                  className="bg-zinc-900 border-zinc-800 ring-0 gap-3"
                >
                  <CardHeader className="pb-0 border-b-0">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                        {t(key)}
                      </CardTitle>
                      <div className="relative">
                        {showPulse && (
                          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                        )}
                        <Icon className="size-4" style={iconStyle} />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-mono font-bold text-zinc-100 leading-none tabular-nums">
                      {value}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <DarkChartCard
              title={t("byCategory")}
              className="lg:col-span-2"
              noData={byCategory.length === 0}
              noDataLabel={t("noData")}
            >
              <ResponsiveContainer width="100%" height={Math.max(byCategory.length * 32, 120)}>
                <BarChart layout="vertical" data={byCategory} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                  <XAxis type="number" tick={CHART_TICK_STYLE} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name_pt" type="category" width={110} tick={{ ...CHART_TICK_STYLE, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: CHART_CURSOR_FILL }}
                    contentStyle={CHART_TOOLTIP_STYLE}
                  />
                  <Bar dataKey="count" fill={TERRACOTTA} radius={[0, 4, 4, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </DarkChartCard>

            <DarkChartCard
              title={t("byBairro")}
              noData={byBairro.length === 0}
              noDataLabel={t("noData")}
            >
              <ResponsiveContainer width="100%" height={Math.max(byBairro.length * 32, 120)}>
                <BarChart layout="vertical" data={byBairro} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                  <XAxis type="number" tick={CHART_TICK_STYLE} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" width={90} tick={{ ...CHART_TICK_STYLE, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: CHART_CURSOR_FILL }}
                    contentStyle={CHART_TOOLTIP_STYLE}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20}>
                    {byBairro.map((_, i) => (
                      <Cell
                        key={i}
                        fill={i % 2 === 0 ? TERRACOTTA : WARM}
                        opacity={Math.max(1 - i * 0.06, 0.25)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </DarkChartCard>
          </div>
        </TabsContent>

        {/* ── Search Analytics tab ──────────────────────────────────────── */}
        <TabsContent value="search" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DarkDataCard title={t("topQueries")}>
              {topQueries.length === 0 ? (
                <DarkEmptyState label={t("noData")} />
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-zinc-500 uppercase tracking-wide border-b border-zinc-800">
                      <th className="text-left pb-2 font-medium">{t("query")}</th>
                      <th className="text-right pb-2 font-medium">{t("count")}</th>
                      <th className="text-right pb-2 font-medium">{t("avgResults")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {topQueries.map((row, i) => (
                      <tr key={row.query_text} className="hover:bg-zinc-800/40 transition-colors">
                        <td className="py-2.5 flex items-center gap-2">
                          <span className="text-xs text-zinc-600 font-mono w-4">{i + 1}</span>
                          <span className="font-medium text-zinc-200">{row.query_text}</span>
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-zinc-400">{row.search_count}</td>
                        <td className="py-2.5 text-right tabular-nums text-zinc-500">{row.avg_results.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </DarkDataCard>

            <DarkDataCard title={t("zeroResults")} titleClass="text-rose-400">
              {zeroQueries.length === 0 ? (
                <DarkEmptyState label={t("noData")} />
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-zinc-500 uppercase tracking-wide border-b border-zinc-800">
                      <th className="text-left pb-2 font-medium">{t("query")}</th>
                      <th className="text-right pb-2 font-medium">{t("searches")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {zeroQueries.map((row, i) => (
                      <tr key={row.query_text} className="hover:bg-rose-950/20 transition-colors">
                        <td className="py-2.5 flex items-center gap-2">
                          <span className="text-xs text-zinc-600 font-mono w-4">{i + 1}</span>
                          <span className="font-medium text-zinc-200">{row.query_text}</span>
                        </td>
                        <td className="py-2.5 text-right tabular-nums">
                          <Badge className="bg-rose-950/60 text-rose-400 border-rose-800 border text-xs font-semibold px-2 py-0.5 rounded-full">
                            {row.search_count}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </DarkDataCard>
          </div>
        </TabsContent>

        {/* ── Supply & Demand tab ───────────────────────────────────────── */}
        <TabsContent value="supply" className="mt-4">
          <DarkDataCard title={t("supplyDemand")}>
            {supplyDemand.length === 0 ? (
              <DarkEmptyState label={t("noData")} />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-zinc-500 uppercase tracking-wide border-b border-zinc-800">
                    <th className="text-left pb-2 font-medium">{t("category")}</th>
                    <th className="text-right pb-2 font-medium">{t("providers")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {supplyDemand.map((row) => {
                    const count = row.provider_count;
                    const isEmpty = count === 0;
                    return (
                      <tr key={row.name_pt} className="hover:bg-zinc-800/40 transition-colors">
                        <td className="py-2.5 font-medium text-zinc-200">{row.name_pt}</td>
                        <td className="py-2.5 text-right">
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full tabular-nums border ${
                              isEmpty
                                ? "bg-rose-950/60 text-rose-400 border-rose-800"
                                : count <= 2
                                ? "bg-amber-950/60 text-amber-400 border-amber-800"
                                : "bg-zinc-800 text-zinc-400 border-zinc-700"
                            }`}
                          >
                            {count}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </DarkDataCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DarkChartCard({
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
    <div className={`bg-zinc-900 rounded-xl border border-zinc-800 p-5 ${className}`}>
      <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-4">{title}</h2>
      {noData ? <DarkEmptyState label={noDataLabel} /> : children}
    </div>
  );
}

function DarkDataCard({
  title,
  titleClass = "text-zinc-200",
  children,
}: {
  title: string;
  titleClass?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
      <h2 className={`text-sm font-semibold mb-4 ${titleClass}`}>{title}</h2>
      {children}
    </div>
  );
}

function DarkEmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-zinc-700">
      <span className="text-3xl mb-2">—</span>
      <span className="text-xs">{label}</span>
    </div>
  );
}
