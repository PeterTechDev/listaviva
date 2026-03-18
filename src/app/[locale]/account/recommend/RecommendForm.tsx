"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { submitRecommendation } from "./actions";

function SubmitButton() {
  const t = useTranslations("recommendations");
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-accent text-white py-2 px-4 rounded-lg hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
    >
      {pending ? "..." : t("submit")}
    </button>
  );
}

type Category = { id: string; name_pt: string };
type Bairro = { id: string; name: string };

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2 bg-background text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent";
const labelClass = "block text-sm font-medium text-primary mb-1";

export default function RecommendForm({
  categories,
  bairros,
}: {
  categories: Category[];
  bairros: Bairro[];
}) {
  const t = useTranslations("recommendations");
  const [state, formAction] = useActionState(submitRecommendation, { error: null });

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p className="text-red-600 text-sm">{state.error}</p>
      )}

      <div>
        <label className={labelClass}>{t("providerName")} *</label>
        <input
          name="provider_name"
          type="text"
          required
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>{t("category")}</label>
        <select
          name="category_id"
          required
          defaultValue=""
          className={inputClass}
        >
          <option value="" disabled>—</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name_pt}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>{t("whatsapp")}</label>
        <input
          name="whatsapp"
          type="text"
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>{t("bairro")}</label>
        <select
          name="bairro_id"
          className={inputClass}
        >
          <option value="">—</option>
          {bairros.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>{t("description")}</label>
        <textarea
          name="description"
          rows={3}
          className={inputClass}
        />
      </div>

      <SubmitButton />
    </form>
  );
}
