"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  moveCategoryUp,
  moveCategoryDown,
} from "./actions";
import { toSlug } from "@/lib/slug";

interface Category {
  id: string;
  name_pt: string;
  name_en: string | null;
  slug: string;
  icon: string | null;
  sort_order: number;
}

const emptyForm = {
  name_pt: "",
  name_en: "",
  slug: "",
  icon: "",
  sort_order: "0",
};

const inputClass =
  "w-full px-3 py-1.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-background text-primary";

function FormFields({
  form,
  onChange,
  labels,
}: {
  form: typeof emptyForm;
  onChange: (field: string, value: string) => void;
  labels: {
    namePt: string;
    nameEn: string;
    icon: string;
    sortOrder: string;
    slug: string;
  };
}) {
  return (
    <div className="grid grid-cols-6 gap-3">
      <div className="col-span-2">
        <label className="block text-xs font-medium text-muted mb-1">
          {labels.namePt}
        </label>
        <input
          type="text"
          value={form.name_pt}
          onChange={(e) => onChange("name_pt", e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="col-span-2">
        <label className="block text-xs font-medium text-muted mb-1">
          {labels.nameEn}
        </label>
        <input
          type="text"
          value={form.name_en}
          onChange={(e) => onChange("name_en", e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="col-span-1">
        <label className="block text-xs font-medium text-muted mb-1">
          {labels.icon}
        </label>
        <input
          type="text"
          value={form.icon}
          onChange={(e) => onChange("icon", e.target.value)}
          className={inputClass}
          maxLength={4}
        />
      </div>
      <div className="col-span-1">
        <label className="block text-xs font-medium text-muted mb-1">
          {labels.sortOrder}
        </label>
        <input
          type="number"
          value={form.sort_order}
          onChange={(e) => onChange("sort_order", e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="col-span-6">
        <label className="block text-xs font-medium text-muted mb-1">
          {labels.slug}
        </label>
        <input
          type="text"
          value={form.slug}
          onChange={(e) => onChange("slug", e.target.value)}
          className={`${inputClass} font-mono`}
        />
      </div>
    </div>
  );
}

export default function CategoriesManager({
  categories,
}: {
  categories: Category[];
}) {
  const t = useTranslations("adminCategories");
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [addForm, setAddForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);

  const fieldLabels = {
    namePt: t("namePt"),
    nameEn: t("nameEn"),
    icon: t("icon"),
    sortOrder: t("sortOrder"),
    slug: t("slug"),
  };

  function handleEditStart(c: Category) {
    setEditId(c.id);
    setEditForm({
      name_pt: c.name_pt,
      name_en: c.name_en ?? "",
      slug: c.slug,
      icon: c.icon ?? "",
      sort_order: String(c.sort_order),
    });
    setShowAdd(false);
    setError(null);
  }

  function handleAddNamePt(value: string) {
    setAddForm((f) => ({
      ...f,
      name_pt: value,
      slug: f.slug === "" || f.slug === toSlug(f.name_pt) ? toSlug(value) : f.slug,
    }));
  }

  function handleCreate() {
    startTransition(async () => {
      const fd = new FormData();
      Object.entries(addForm).forEach(([k, v]) => fd.set(k, v));
      const result = await createCategory(fd);
      if ("error" in result && result.error) {
        setError(result.error);
      } else {
        setShowAdd(false);
        setAddForm(emptyForm);
        setError(null);
      }
    });
  }

  function handleUpdate() {
    if (!editId) return;
    startTransition(async () => {
      const fd = new FormData();
      Object.entries(editForm).forEach(([k, v]) => fd.set(k, v));
      const result = await updateCategory(editId, fd);
      if ("error" in result && result.error) {
        setError(result.error);
      } else {
        setEditId(null);
        setError(null);
      }
    });
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`${t("deleteConfirm")} "${name}"?`)) return;
    startTransition(async () => {
      const result = await deleteCategory(id);
      if ("error" in result && result.error) setError(result.error);
    });
  }

  function handleMoveUp(id: string, order: number) {
    startTransition(async () => {
      await moveCategoryUp(id, order);
    });
  }

  function handleMoveDown(id: string, order: number) {
    startTransition(async () => {
      await moveCategoryDown(id, order);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary">{t("title")}</h1>
        {!showAdd && (
          <button
            type="button"
            onClick={() => {
              setShowAdd(true);
              setEditId(null);
              setError(null);
            }}
            className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
          >
            + {t("add")}
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {showAdd && (
        <div className="bg-surface rounded-xl border border-border p-5">
          <h3 className="font-semibold text-primary mb-4">{t("addCategory")}</h3>
          <FormFields
            form={addForm}
            labels={fieldLabels}
            onChange={(field, value) => {
              if (field === "name_pt") {
                handleAddNamePt(value);
              } else {
                setAddForm((f) => ({ ...f, [field]: value }));
              }
            }}
          />
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={!addForm.name_pt || isPending}
              className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
            >
              {t("save")}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAdd(false);
                setAddForm(emptyForm);
              }}
              className="px-4 py-2 bg-background border border-border text-muted rounded-lg text-sm font-medium hover:border-accent hover:text-accent transition-colors"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}

      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        {categories.length === 0 ? (
          <div className="py-16 text-center text-muted text-sm">
            {t("empty")}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-background border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider w-10">
                  {t("icon")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                  {t("namePt")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                  {t("nameEn")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                  {t("slug")}
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted uppercase tracking-wider w-16">
                  {t("sortOrder")}
                </th>
                <th className="px-4 py-3 w-40" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {categories.map((cat) =>
                editId === cat.id ? (
                  <tr key={cat.id} className="bg-accent/5">
                    <td colSpan={5} className="px-4 py-3">
                      <FormFields
                        form={editForm}
                        labels={fieldLabels}
                        onChange={(field, value) =>
                          setEditForm((f) => ({ ...f, [field]: value }))
                        }
                      />
                    </td>
                    <td className="px-4 py-3 text-right space-x-2 align-top pt-6">
                      <button
                        type="button"
                        onClick={handleUpdate}
                        disabled={isPending}
                        className="px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
                      >
                        {t("save")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditId(null)}
                        className="px-3 py-1.5 bg-background border border-border text-muted rounded-lg text-xs font-medium hover:border-accent hover:text-accent transition-colors"
                      >
                        {t("cancel")}
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={cat.id} className="hover:bg-background transition-colors">
                    <td className="px-4 py-3 text-xl text-center">
                      {cat.icon}
                    </td>
                    <td className="px-4 py-3 text-sm text-primary font-medium">
                      {cat.name_pt}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted">
                      {cat.name_en}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted font-mono">
                      {cat.slug}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted text-center">
                      {cat.sort_order}
                    </td>
                    <td className="px-4 py-3 text-right space-x-1">
                      <button
                        type="button"
                        onClick={() => handleMoveUp(cat.id, cat.sort_order)}
                        disabled={isPending}
                        className="px-2 py-1.5 bg-background border border-border text-muted rounded-lg text-xs font-medium hover:border-accent hover:text-accent disabled:opacity-50 transition-colors"
                      >
                        {t("moveUp")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveDown(cat.id, cat.sort_order)}
                        disabled={isPending}
                        className="px-2 py-1.5 bg-background border border-border text-muted rounded-lg text-xs font-medium hover:border-accent hover:text-accent disabled:opacity-50 transition-colors"
                      >
                        {t("moveDown")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEditStart(cat)}
                        disabled={isPending}
                        className="px-3 py-1.5 bg-background border border-border text-primary rounded-lg text-xs font-medium hover:border-accent hover:text-accent disabled:opacity-50 transition-colors"
                      >
                        {t("edit")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(cat.id, cat.name_pt)}
                        disabled={isPending}
                        className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 disabled:opacity-50 transition-colors"
                      >
                        {t("delete")}
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
