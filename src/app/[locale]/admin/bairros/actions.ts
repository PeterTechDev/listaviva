"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { toSlug } from "@/lib/slug";

export async function createBairro(formData: FormData) {
  const name = (formData.get("name") as string).trim();
  const slug = ((formData.get("slug") as string) || toSlug(name)).trim();

  if (!name || !slug) return { error: "Name and slug are required" };

  const supabase = await createClient();
  const { error } = await supabase.from("bairros").insert({ name, slug });

  if (error) return { error: error.message };

  revalidatePath("/[locale]/admin/bairros", "page");
  return { success: true };
}

export async function updateBairro(id: string, formData: FormData) {
  const name = (formData.get("name") as string).trim();
  const slug = (formData.get("slug") as string).trim();

  if (!name || !slug) return { error: "Name and slug are required" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("bairros")
    .update({ name, slug })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/[locale]/admin/bairros", "page");
  return { success: true };
}

export async function deleteBairro(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("bairros").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/[locale]/admin/bairros", "page");
  return { success: true };
}
