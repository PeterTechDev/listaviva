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

  const inputClass =
    "w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";

  function FormFields({
    form,
    onChange,
  }: {
    form: typeof emptyForm;
    onChange: (field: string, value: string) => void;
  }) {
    return (
      <div className="grid grid-cols-6 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {t("namePt")}
          </label>
          <input
            type="text"
            value={form.name_pt}
            onChange={(e) => onChange("name_pt", e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {t("nameEn")}
          </label>
          <input
            type="text"
            value={form.name_en}
            onChange={(e) => onChange("name_en", e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="col-span-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {t("icon")}
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
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {t("sortOrder")}
          </label>
          <input
            type="number"
            value={form.sort_order}
            onChange={(e) => onChange("sort_order", e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="col-span-6">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {t("slug")}
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
        {!showAdd && (
          <button
            onClick={() => {
              setShowAdd(true);
              setEditId(null);
              setError(null);
            }}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
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
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4">{t("addCategory")}</h3>
          <FormFields
            form={addForm}
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
              onClick={handleCreate}
              disabled={!addForm.name_pt || isPending}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {t("save")}
            </button>
            <button
              onClick={() => {
                setShowAdd(false);
                setAddForm(emptyForm);
              }}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {categories.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            {t("empty")}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-10">
                  {t("icon")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {t("namePt")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {t("nameEn")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {t("slug")}
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">
                  {t("sortOrder")}
                </th>
                <th className="px-4 py-3 w-40" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {categories.map((cat) =>
                editId === cat.id ? (
                  <tr key={cat.id} className="bg-emerald-50">
                    <td colSpan={5} className="px-4 py-3">
                      <FormFields
                        form={editForm}
                        onChange={(field, value) =>
                          setEditForm((f) => ({ ...f, [field]: value }))
                        }
                      />
                    </td>
                    <td className="px-4 py-3 text-right space-x-2 align-top pt-6">
                      <button
                        onClick={handleUpdate}
                        disabled={isPending}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                      >
                        {t("save")}
                      </button>
                      <button
                        onClick={() => setEditId(null)}
                        className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors"
                      >
                        {t("cancel")}
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={cat.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xl text-center">
                      {cat.icon}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                      {cat.name_pt}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {cat.name_en}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                      {cat.slug}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 text-center">
                      {cat.sort_order}
                    </td>
                    <td className="px-4 py-3 text-right space-x-1">
                      <button
                        onClick={() => handleMoveUp(cat.id, cat.sort_order)}
                        disabled={isPending}
                        title={t("moveUp")}
                        className="px-2 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 disabled:opacity-50 transition-colors"
                      >
                        {t("moveUp")}
                      </button>
                      <button
                        onClick={() => handleMoveDown(cat.id, cat.sort_order)}
                        disabled={isPending}
                        title={t("moveDown")}
                        className="px-2 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 disabled:opacity-50 transition-colors"
                      >
                        {t("moveDown")}
                      </button>
                      <button
                        onClick={() => handleEditStart(cat)}
                        disabled={isPending}
                        className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 disabled:opacity-50 transition-colors"
                      >
                        {t("edit")}
                      </button>
                      <button
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
