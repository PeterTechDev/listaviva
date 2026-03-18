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
      className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? "..." : t("submit")}
    </button>
  );
}

type Category = { id: string; name_pt: string };
type Bairro = { id: string; name: string };

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
        <label className="block text-sm font-medium mb-1">{t("providerName")} *</label>
        <input
          name="provider_name"
          type="text"
          required
          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">{t("category")}</label>
        <select
          name="category_id"
          required
          defaultValue=""
          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        <label className="block text-sm font-medium mb-1">{t("whatsapp")}</label>
        <input
          name="whatsapp"
          type="text"
          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">{t("bairro")}</label>
        <select
          name="bairro_id"
          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        <label className="block text-sm font-medium mb-1">{t("description")}</label>
        <textarea
          name="description"
          rows={3}
          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <SubmitButton />
    </form>
  );
}
