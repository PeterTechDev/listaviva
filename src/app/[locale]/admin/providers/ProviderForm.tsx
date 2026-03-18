"use client";

import { useState, useTransition, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { toSlug } from "@/lib/slug";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
type Day = (typeof DAYS)[number];

interface Bairro {
  id: string;
  name: string;
}
interface Category {
  id: string;
  name_pt: string;
  name_en: string | null;
  icon: string | null;
}
interface Photo {
  url: string;
}

interface ProviderData {
  id?: string;
  name?: string;
  slug?: string;
  description_pt?: string | null;
  description_en?: string | null;
  whatsapp?: string | null;
  phone?: string | null;
  home_bairro_id?: string | null;
  status?: string;
  tier?: string;
  working_hours?: Record<string, string>;
  categoryIds?: string[];
  serviceAreaIds?: string[];
  photos?: Photo[];
}

interface ProviderFormProps {
  bairros: Bairro[];
  categories: Category[];
  initialData?: ProviderData;
  mode: "create" | "edit";
  action: (formData: FormData) => Promise<{ error?: string } | unknown>;
  redirectTo: string;
  selfService?: boolean;
}

export default function ProviderForm({
  bairros,
  categories,
  initialData = {},
  mode,
  action,
  redirectTo,
  selfService = false,
}: ProviderFormProps) {
  const t = useTranslations("adminProviders");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const wh = (initialData.working_hours ?? {}) as Record<Day, string>;

  const [name, setName] = useState(initialData.name ?? "");
  const [slug, setSlug] = useState(initialData.slug ?? "");
  const [descPt, setDescPt] = useState(initialData.description_pt ?? "");
  const [descEn, setDescEn] = useState(initialData.description_en ?? "");
  const [whatsapp, setWhatsapp] = useState(initialData.whatsapp ?? "");
  const [phone, setPhone] = useState(initialData.phone ?? "");
  const [homeBairroId, setHomeBairroId] = useState(
    initialData.home_bairro_id ?? ""
  );
  const [status, setStatus] = useState(initialData.status ?? "active");
  const [tier, setTier] = useState(initialData.tier ?? "free");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    initialData.categoryIds ?? []
  );
  const [selectedAreas, setSelectedAreas] = useState<string[]>(
    initialData.serviceAreaIds ?? []
  );
  const [hours, setHours] = useState<Record<Day, string>>(
    Object.fromEntries(DAYS.map((d) => [d, wh[d] ?? ""])) as Record<Day, string>
  );
  const [photos, setPhotos] = useState<string[]>(
    initialData.photos?.map((p) => p.url) ?? []
  );

  async function handlePhotoUpload(file: File) {
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    setUploading(true);
    const { data, error: uploadError } = await supabase.storage
      .from("provider-photos")
      .upload(path, file, { upsert: false });
    setUploading(false);
    if (uploadError || !data) {
      setError(`Upload failed: ${uploadError?.message}`);
      return;
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from("provider-photos").getPublicUrl(data.path);
    setPhotos((prev) => [...prev, publicUrl]);
  }

  function toggleCategory(id: string) {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleArea(id: string) {
    setSelectedAreas((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function removePhoto(url: string) {
    setPhotos((prev) => prev.filter((p) => p !== url));
  }

  function buildFormData() {
    const fd = new FormData();
    fd.set("name", name);
    fd.set("slug", slug || toSlug(name));
    fd.set("description_pt", descPt);
    fd.set("description_en", descEn);
    fd.set("whatsapp", whatsapp);
    fd.set("phone", phone);
    fd.set("home_bairro_id", homeBairroId);
    fd.set("status", status);
    fd.set("tier", tier);
    selectedCategories.forEach((id) => fd.append("category_ids", id));
    selectedAreas.forEach((id) => fd.append("service_area_ids", id));
    photos.forEach((url) => fd.append("photo_urls", url));
    DAYS.forEach((d) => fd.set(`hours_${d}`, hours[d]));
    return fd;
  }

  function handleSubmit() {
    startTransition(async () => {
      const result = await action(buildFormData());
      if (result && typeof result === "object" && "error" in result && (result as { error?: string }).error) {
        setError((result as { error?: string }).error!);
        return;
      }
      router.push(redirectTo);
    });
  }

  const inputClass =
    "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="max-w-3xl space-y-8">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Basic info */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">Informações básicas</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>{t("name")} *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!initialData.id) setSlug(toSlug(e.target.value));
              }}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{t("slug")} *</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className={`${inputClass} font-mono`}
            />
          </div>
        </div>
        <div>
          <label className={labelClass}>{t("descriptionPt")}</label>
          <textarea
            value={descPt}
            onChange={(e) => setDescPt(e.target.value)}
            rows={3}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>{t("descriptionEn")}</label>
          <textarea
            value={descEn}
            onChange={(e) => setDescEn(e.target.value)}
            rows={3}
            className={inputClass}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>{t("whatsapp")}</label>
            <input
              type="text"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="+55 27 99999-9999"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{t("phone")}</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
        {selfService && (
          <div>
            <label className={labelClass}>{t("homeBairro")}</label>
            <select
              value={homeBairroId}
              onChange={(e) => setHomeBairroId(e.target.value)}
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
        )}
        {!selfService && (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>{t("homeBairro")}</label>
              <select
                value={homeBairroId}
                onChange={(e) => setHomeBairroId(e.target.value)}
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
              <label className={labelClass}>{t("status")}</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={inputClass}
              >
                <option value="active">{t("statusActive")}</option>
                <option value="pending">{t("statusPending")}</option>
                <option value="inactive">{t("statusInactive")}</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>{t("tier")}</label>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value)}
                className={inputClass}
              >
                <option value="free">{t("tierFree")}</option>
                <option value="premium">{t("tierPremium")}</option>
              </select>
            </div>
          </div>
        )}
      </section>

      {/* Categories */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800 mb-4">{t("categories")}</h2>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <label
              key={cat.id}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors ${
                selectedCategories.includes(cat.id)
                  ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                  : "bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={selectedCategories.includes(cat.id)}
                onChange={() => toggleCategory(cat.id)}
              />
              {cat.icon && <span>{cat.icon}</span>}
              <span>{locale === "en" ? (cat.name_en ?? cat.name_pt) : cat.name_pt}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Service areas */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800 mb-4">{t("serviceAreas")}</h2>
        <div className="flex flex-wrap gap-2">
          {bairros.map((b) => (
            <label
              key={b.id}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors ${
                selectedAreas.includes(b.id)
                  ? "bg-blue-50 border-blue-300 text-blue-700"
                  : "bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={selectedAreas.includes(b.id)}
                onChange={() => toggleArea(b.id)}
              />
              {b.name}
            </label>
          ))}
        </div>
      </section>

      {/* Working hours */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800 mb-4">{t("workingHours")}</h2>
        <div className="space-y-2">
          {DAYS.map((day) => (
            <div key={day} className="flex items-center gap-4">
              <span className="w-24 text-sm text-gray-600 font-medium">
                {t(day)}
              </span>
              <input
                type="text"
                value={hours[day]}
                onChange={(e) =>
                  setHours((h) => ({ ...h, [day]: e.target.value }))
                }
                placeholder={t("closed")}
                className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-400">
          Ex: 08:00–18:00 · {t("closed")}: deixe em branco
        </p>
      </section>

      {/* Photos */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800 mb-4">{t("photos")}</h2>
        <div className="flex flex-wrap gap-3">
          {photos.map((url) => (
            <div key={url} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                className="w-24 h-24 object-cover rounded-lg border border-gray-200"
              />
              <button
                type="button"
                onClick={() => removePhoto(url)}
                className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs hidden group-hover:flex items-center justify-center"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-24 h-24 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg text-gray-400 hover:border-emerald-400 hover:text-emerald-500 transition-colors disabled:opacity-50"
          >
            <span className="text-2xl">+</span>
            <span className="text-xs mt-1">
              {uploading ? t("uploadingPhoto") : t("addPhoto")}
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handlePhotoUpload(file);
              e.target.value = "";
            }}
          />
        </div>
      </section>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={!name || isPending}
          className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? t("uploadingPhoto") : t("save")}
        </button>
        <button
          onClick={() => router.push(redirectTo)}
          className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}
