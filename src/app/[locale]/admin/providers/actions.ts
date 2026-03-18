"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { toSlug } from "@/lib/slug";

export type WorkingHours = {
  [day in "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"]?: string;
};

export async function createProvider(formData: FormData) {
  const name = (formData.get("name") as string).trim();
  const slug = ((formData.get("slug") as string) || toSlug(name)).trim();
  const description_pt = (formData.get("description_pt") as string)?.trim() || null;
  const description_en = (formData.get("description_en") as string)?.trim() || null;
  const whatsapp = (formData.get("whatsapp") as string)?.trim() || null;
  const phone = (formData.get("phone") as string)?.trim() || null;
  const home_bairro_id = (formData.get("home_bairro_id") as string) || null;
  const status = (formData.get("status") as string) || "active";
  const tier = (formData.get("tier") as string) || "free";
  const category_ids = formData.getAll("category_ids") as string[];
  const service_area_ids = formData.getAll("service_area_ids") as string[];
  const photo_urls = formData.getAll("photo_urls") as string[];

  // Parse working hours from day fields
  const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
  const working_hours: WorkingHours = {};
  for (const day of days) {
    const val = (formData.get(`hours_${day}`) as string)?.trim();
    if (val) working_hours[day] = val;
  }

  if (!name || !slug) return { error: "Name and slug are required" };

  const supabase = await createClient();

  const { data: provider, error } = await supabase
    .from("providers")
    .insert({
      name,
      slug,
      description_pt,
      description_en,
      whatsapp,
      phone,
      home_bairro_id,
      status,
      tier,
      working_hours,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const providerId = provider.id;

  // Insert categories
  if (category_ids.length > 0) {
    await supabase.from("provider_categories").insert(
      category_ids.map((cid) => ({ provider_id: providerId, category_id: cid }))
    );
  }

  // Insert service areas
  if (service_area_ids.length > 0) {
    await supabase.from("provider_service_areas").insert(
      service_area_ids.map((bid) => ({ provider_id: providerId, bairro_id: bid }))
    );
  }

  // Insert photos
  if (photo_urls.length > 0) {
    await supabase.from("provider_photos").insert(
      photo_urls.map((url, i) => ({ provider_id: providerId, url, sort_order: i }))
    );
  }

  revalidatePath("/[locale]/admin/providers", "page");
  revalidatePath("/[locale]/category/[slug]", "page");
  return { success: true, id: providerId };
}

export async function updateProvider(id: string, formData: FormData) {
  const name = (formData.get("name") as string).trim();
  const slug = (formData.get("slug") as string).trim();
  const description_pt = (formData.get("description_pt") as string)?.trim() || null;
  const description_en = (formData.get("description_en") as string)?.trim() || null;
  const whatsapp = (formData.get("whatsapp") as string)?.trim() || null;
  const phone = (formData.get("phone") as string)?.trim() || null;
  const home_bairro_id = (formData.get("home_bairro_id") as string) || null;
  const status = (formData.get("status") as string) || "active";
  const tier = (formData.get("tier") as string) || "free";
  const category_ids = formData.getAll("category_ids") as string[];
  const service_area_ids = formData.getAll("service_area_ids") as string[];
  const photo_urls = formData.getAll("photo_urls") as string[];

  const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
  const working_hours: WorkingHours = {};
  for (const day of days) {
    const val = (formData.get(`hours_${day}`) as string)?.trim();
    if (val) working_hours[day] = val;
  }

  if (!name || !slug) return { error: "Name and slug are required" };

  const supabase = await createClient();

  const { error } = await supabase
    .from("providers")
    .update({
      name,
      slug,
      description_pt,
      description_en,
      whatsapp,
      phone,
      home_bairro_id,
      status,
      tier,
      working_hours,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  // Sync categories
  await supabase.from("provider_categories").delete().eq("provider_id", id);
  if (category_ids.length > 0) {
    await supabase.from("provider_categories").insert(
      category_ids.map((cid) => ({ provider_id: id, category_id: cid }))
    );
  }

  // Sync service areas
  await supabase.from("provider_service_areas").delete().eq("provider_id", id);
  if (service_area_ids.length > 0) {
    await supabase.from("provider_service_areas").insert(
      service_area_ids.map((bid) => ({ provider_id: id, bairro_id: bid }))
    );
  }

  // Sync photos: delete existing, re-insert
  await supabase.from("provider_photos").delete().eq("provider_id", id);
  if (photo_urls.length > 0) {
    await supabase.from("provider_photos").insert(
      photo_urls.map((url, i) => ({ provider_id: id, url, sort_order: i }))
    );
  }

  revalidatePath("/[locale]/admin/providers", "page");
  revalidatePath(`/[locale]/admin/providers/${id}/edit`, "page");
  revalidatePath("/[locale]/category/[slug]", "page");
  return { success: true };
}

export async function deleteProvider(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("providers").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/[locale]/admin/providers", "page");
  revalidatePath("/[locale]/category/[slug]", "page");
  return { success: true };
}
