"use client";

import { useState, useTransition } from "react";
import { CollectedData, collectedDataToFormData } from "@/app/api/onboarding/chat/types";
import { createOwnProvider } from "../actions";

interface Category {
  id: string;
  name_pt: string;
}

interface Bairro {
  id: string;
  name: string;
}

interface Props {
  data: CollectedData;
  categories: Category[];
  bairros: Bairro[];
  onCorrect: () => void;
}

const DAY_LABELS: Record<string, string> = {
  mon: "Seg",
  tue: "Ter",
  wed: "Qua",
  thu: "Qui",
  fri: "Sex",
  sat: "Sáb",
  sun: "Dom",
};

function formatWorkingHours(hours: Record<string, string>): string {
  const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const entries = days
    .filter((d) => hours[d])
    .map((d) => `${DAY_LABELS[d]} ${hours[d]}`);
  return entries.join(" · ");
}

export default function ProfilePreviewCard({
  data,
  categories,
  bairros,
  onCorrect,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const providerCategories = categories.filter((c) =>
    (data.category_ids ?? []).includes(c.id)
  );
  const providerBairros = bairros.filter((b) =>
    (data.service_area_ids ?? []).includes(b.id)
  );

  function handlePublish() {
    setSubmitError(null);
    startTransition(async () => {
      const fd = collectedDataToFormData(data);
      const result = await createOwnProvider(fd);
      // createOwnProvider redirects on success — result only present on error
      if (result?.error) {
        setSubmitError(
          `Erro ao publicar: ${result.error}. Tente novamente.`
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Preview header */}
      <div className="text-center space-y-1">
        <p className="text-sm text-muted">É assim que seu perfil vai aparecer</p>
        <h2 className="text-xl font-bold text-primary">{data.name}</h2>
      </div>

      {/* Preview card — looks like the public listing */}
      <div className="bg-surface rounded-2xl border border-border p-5 space-y-4">

        {/* Category pills */}
        {(data.category_ids?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-2">
            {providerCategories.map((c) => (
              <span
                key={c.id}
                className="px-3 py-1 bg-accent/10 text-accent rounded-full text-xs font-medium"
              >
                {c.name_pt}
              </span>
            ))}
          </div>
        )}

        {/* Description */}
        {data.description_pt && (
          <p className="text-sm text-primary leading-relaxed">
            {data.description_pt}
          </p>
        )}

        {/* Service areas */}
        {providerBairros.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted uppercase tracking-wider">
              Atende em
            </p>
            <div className="flex flex-wrap gap-1.5">
              {providerBairros.map((b) => (
                <span
                  key={b.id}
                  className="px-2 py-0.5 bg-background border border-border rounded text-xs text-primary"
                >
                  {b.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Working hours */}
        {data.working_hours && Object.keys(data.working_hours).length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted uppercase tracking-wider">
              Horários
            </p>
            <p className="text-sm text-primary">
              {formatWorkingHours(data.working_hours)}
            </p>
          </div>
        )}

        {/* WhatsApp (visual only, disabled) */}
        {data.whatsapp && (
          <div className="pt-1">
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-accent/10 text-accent rounded-lg text-sm font-medium opacity-60 cursor-default">
              WhatsApp {data.whatsapp}
            </span>
          </div>
        )}

        {/* Photo placeholder */}
        <div className="h-24 bg-background border border-border rounded-xl flex items-center justify-center">
          <p className="text-xs text-muted">📸 Adicione fotos depois de publicar</p>
        </div>
      </div>

      {/* Error */}
      {submitError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {submitError}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={handlePublish}
          disabled={isPending}
          className="w-full py-3 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Publicando..." : "Publicar meu perfil"}
        </button>
        <button
          type="button"
          onClick={onCorrect}
          disabled={isPending}
          className="w-full py-2.5 text-sm text-muted hover:text-primary transition-colors"
        >
          Quero corrigir algo
        </button>
      </div>
    </div>
  );
}
