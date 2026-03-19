"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { approveClaim, rejectClaim } from "./actions";

interface Claim {
  id: string;
  status: string;
  message: string | null;
  created_at: string;
  providers: { name: string } | null;
  profiles: { full_name: string | null } | null;
}

export default function ClaimsManager({ claims }: { claims: Claim[] }) {
  const t = useTranslations("adminClaims");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleApprove(id: string) {
    startTransition(async () => {
      const result = await approveClaim(id);
      if (result?.error) setError(result.error);
    });
  }

  function handleReject(id: string) {
    startTransition(async () => {
      const result = await rejectClaim(id);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        {claims.length === 0 ? (
          <div className="py-16 text-center text-muted text-sm">{t("empty")}</div>
        ) : (
          <table className="w-full">
            <thead className="bg-background border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                  {t("provider")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                  {t("claimant")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                  {t("message")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                  {t("createdAt")}
                </th>
                <th className="px-4 py-3 w-40" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {claims.map((c) => (
                <tr key={c.id} className="hover:bg-background transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-primary">
                    {c.providers?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted">
                    {c.profiles?.full_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted max-w-xs truncate">
                    {c.message ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => handleApprove(c.id)}
                      disabled={isPending}
                      className="px-3 py-1.5 bg-accent/10 text-accent rounded-lg text-xs font-medium hover:bg-accent/20 disabled:opacity-50 transition-colors"
                    >
                      {t("approve")}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(c.id)}
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
        )}
      </div>
    </div>
  );
}
