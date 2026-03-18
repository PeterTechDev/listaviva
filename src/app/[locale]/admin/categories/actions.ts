"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { toSlug } from "@/lib/slug";

export async function createCategory(formData: FormData) {
  const name_pt = (formData.get("name_pt") as string).trim();
  const name_en = ((formData.get("name_en") as string) || "").trim();
  const slug = ((formData.get("slug") as string) || toSlug(name_pt)).trim();
  const icon = ((formData.get("icon") as string) || "").trim();
  const sort_order = parseInt((formData.get("sort_order") as string) || "0", 10);

  if (!name_pt || !slug) return { error: "Name (PT) and slug are required" };

  const supabase = await createClient();
  const { error } = await supabase.from("categories").insert({
    name_pt,
    name_en: name_en || null,
    slug,
    icon: icon || null,
    sort_order,
  });

  if (error) return { error: error.message };

  revalidatePath("/[locale]/admin/categories", "page");
  revalidatePath("/[locale]", "page");
  return { success: true };
}

export async function updateCategory(id: string, formData: FormData) {
  const name_pt = (formData.get("name_pt") as string).trim();
  const name_en = ((formData.get("name_en") as string) || "").trim();
  const slug = (formData.get("slug") as string).trim();
  const icon = ((formData.get("icon") as string) || "").trim();
  const sort_order = parseInt((formData.get("sort_order") as string) || "0", 10);

  if (!name_pt || !slug) return { error: "Name (PT) and slug are required" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({
      name_pt,
      name_en: name_en || null,
      slug,
      icon: icon || null,
      sort_order,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/[locale]/admin/categories", "page");
  revalidatePath("/[locale]", "page");
  return { success: true };
}

export async function deleteCategory(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/[locale]/admin/categories", "page");
  revalidatePath("/[locale]", "page");
  return { success: true };
}

export async function moveCategoryUp(id: string, currentOrder: number) {
  const supabase = await createClient();

  const { data: above } = await supabase
    .from("categories")
    .select("id, sort_order")
    .lt("sort_order", currentOrder)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!above) return { success: true };

  await supabase
    .from("categories")
    .update({ sort_order: above.sort_order })
    .eq("id", id);
  await supabase
    .from("categories")
    .update({ sort_order: currentOrder })
    .eq("id", above.id);

  revalidatePath("/[locale]/admin/categories", "page");
  return { success: true };
}

export async function moveCategoryDown(id: string, currentOrder: number) {
  const supabase = await createClient();

  const { data: below } = await supabase
    .from("categories")
    .select("id, sort_order")
    .gt("sort_order", currentOrder)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!below) return { success: true };

  await supabase
    .from("categories")
    .update({ sort_order: below.sort_order })
    .eq("id", id);
  await supabase
    .from("categories")
    .update({ sort_order: currentOrder })
    .eq("id", below.id);

  revalidatePath("/[locale]/admin/categories", "page");
  return { success: true };
}
