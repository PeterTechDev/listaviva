"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createBairro, updateBairro, deleteBairro } from "./actions";
import { toSlug } from "@/lib/slug";

interface Bairro {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

const inputClass =
  "w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-background text-primary";

const inlineInputClass =
  "w-full px-3 py-1.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-background text-primary";

export default function BairrosManager({ bairros }: { bairros: Bairro[] }) {
  const t = useTranslations("adminBairros");
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [addName, setAddName] = useState("");
  const [addSlug, setAddSlug] = useState("");
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");

  function handleEditStart(b: Bairro) {
    setEditId(b.id);
    setEditName(b.name);
    setEditSlug(b.slug);
    setShowAdd(false);
    setError(null);
  }

  function handleCreate() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("name", addName);
      fd.set("slug", addSlug || toSlug(addName));
      const result = await createBairro(fd);
      if ("error" in result && result.error) {
        setError(result.error);
      } else {
        setShowAdd(false);
        setAddName("");
        setAddSlug("");
        setError(null);
      }
    });
  }

  function handleUpdate() {
    if (!editId) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("name", editName);
      fd.set("slug", editSlug);
      const result = await updateBairro(editId, fd);
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
      const result = await deleteBairro(id);
      if ("error" in result && result.error) setError(result.error);
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
          <h3 className="font-semibold text-primary mb-4">{t("addBairro")}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary mb-1">
                {t("name")}
              </label>
              <input
                type="text"
                value={addName}
                onChange={(e) => {
                  setAddName(e.target.value);
                  setAddSlug(toSlug(e.target.value));
                }}
                placeholder={t("namePlaceholder")}
                className={inputClass}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">
                {t("slug")}
              </label>
              <input
                type="text"
                value={addSlug}
                onChange={(e) => setAddSlug(e.target.value)}
                className={`${inputClass} font-mono`}
              />
              <p className="mt-1 text-xs text-muted">{t("slugHint")}</p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={!addName || isPending}
              className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
            >
              {t("save")}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAdd(false);
                setAddName("");
                setAddSlug("");
              }}
              className="px-4 py-2 bg-background border border-border text-muted rounded-lg text-sm font-medium hover:border-accent hover:text-accent transition-colors"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}

      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        {bairros.length === 0 ? (
          <div className="py-16 text-center text-muted text-sm">
            {t("empty")}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-background border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                  {t("name")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                  {t("slug")}
                </th>
                <th className="px-4 py-3 w-32" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {bairros.map((bairro) =>
                editId === bairro.id ? (
                  <tr key={bairro.id} className="bg-accent/5">
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className={inlineInputClass}
                        autoFocus
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={editSlug}
                        onChange={(e) => setEditSlug(e.target.value)}
                        className={`${inlineInputClass} font-mono`}
                      />
                    </td>
                    <td className="px-4 py-2 text-right space-x-2">
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
                  <tr key={bairro.id} className="hover:bg-background transition-colors">
                    <td className="px-4 py-3 text-sm text-primary font-medium">
                      {bairro.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted font-mono">
                      {bairro.slug}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => handleEditStart(bairro)}
                        disabled={isPending}
                        className="px-3 py-1.5 bg-background border border-border text-primary rounded-lg text-xs font-medium hover:border-accent hover:text-accent disabled:opacity-50 transition-colors"
                      >
                        {t("edit")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(bairro.id, bairro.name)}
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
