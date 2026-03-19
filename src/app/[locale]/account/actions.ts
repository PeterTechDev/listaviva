"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { toSlug } from "@/lib/slug";
import { buildProviderText, embedText } from "@/lib/embeddings";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export async function createOwnProvider(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const name = (formData.get("name") as string).trim();
  const slug = ((formData.get("slug") as string) || toSlug(name)).trim();
  const description_pt = (formData.get("description_pt") as string)?.trim() || null;
  const description_en = (formData.get("description_en") as string)?.trim() || null;
  const whatsapp = (formData.get("whatsapp") as string)?.trim() || null;
  const phone = (formData.get("phone") as string)?.trim() || null;
  const home_bairro_id = (formData.get("home_bairro_id") as string) || null;
  const category_ids = formData.getAll("category_ids") as string[];
  const service_area_ids = formData.getAll("service_area_ids") as string[];
  const photo_urls = formData.getAll("photo_urls") as string[];

  const working_hours: Record<string, string> = {};
  for (const day of DAYS) {
    const val = (formData.get(`hours_${day}`) as string)?.trim();
    if (val) working_hours[day] = val;
  }

  if (!name || !slug) return { error: "Name is required" };

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
      status: "pending",
      tier: "free",
      working_hours,
      user_id: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const providerId = provider.id;

  if (category_ids.length > 0) {
    await supabase
      .from("provider_categories")
      .insert(category_ids.map((cid) => ({ provider_id: providerId, category_id: cid })));
  }

  if (service_area_ids.length > 0) {
    await supabase
      .from("provider_service_areas")
      .insert(service_area_ids.map((bid) => ({ provider_id: providerId, bairro_id: bid })));
  }

  if (photo_urls.length > 0) {
    await supabase
      .from("provider_photos")
      .insert(photo_urls.map((url, i) => ({ provider_id: providerId, url, sort_order: i })));
  }

  // Upgrade role to provider
  await supabase
    .from("profiles")
    .update({ role: "provider" })
    .eq("id", user.id);

  // Generate embedding for semantic search
  try {
    const { data: cats } = await supabase
      .from("provider_categories")
      .select("categories(name_pt)")
      .eq("provider_id", providerId);
    const catNames = (cats ?? []).flatMap((c) => {
      const cat = c.categories;
      return Array.isArray(cat)
        ? cat.map((x) => x.name_pt)
        : cat
        ? [(cat as { name_pt: string }).name_pt]
        : [];
    });
    const text = buildProviderText(name, description_pt ?? null, catNames);
    const embedding = await embedText(text);
    await supabase
      .from("providers")
      .update({ embedding: JSON.stringify(embedding) })
      .eq("id", providerId);
  } catch (err) {
    console.error("Embedding update failed (createOwnProvider):", err);
  }

  redirect("/account");
}

export async function updateOwnProvider(
  providerId: string,
  formData: FormData
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const name = (formData.get("name") as string).trim();
  const slug = ((formData.get("slug") as string) || toSlug(name)).trim();
  const description_pt = (formData.get("description_pt") as string)?.trim() || null;
  const description_en = (formData.get("description_en") as string)?.trim() || null;
  const whatsapp = (formData.get("whatsapp") as string)?.trim() || null;
  const phone = (formData.get("phone") as string)?.trim() || null;
  const home_bairro_id = (formData.get("home_bairro_id") as string) || null;
  const category_ids = formData.getAll("category_ids") as string[];
  const service_area_ids = formData.getAll("service_area_ids") as string[];
  const photo_urls = formData.getAll("photo_urls") as string[];

  const working_hours: Record<string, string> = {};
  for (const day of DAYS) {
    const val = (formData.get(`hours_${day}`) as string)?.trim();
    if (val) working_hours[day] = val;
  }

  if (!name || !slug) return { error: "Name is required" };

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
      working_hours,
    })
    .eq("id", providerId)
    .eq("user_id", user.id); // RLS also enforces this

  if (error) return { error: error.message };

  // Replace categories
  await supabase.from("provider_categories").delete().eq("provider_id", providerId);
  if (category_ids.length > 0) {
    await supabase
      .from("provider_categories")
      .insert(category_ids.map((cid) => ({ provider_id: providerId, category_id: cid })));
  }

  // Replace service areas
  await supabase.from("provider_service_areas").delete().eq("provider_id", providerId);
  if (service_area_ids.length > 0) {
    await supabase
      .from("provider_service_areas")
      .insert(service_area_ids.map((bid) => ({ provider_id: providerId, bairro_id: bid })));
  }

  // Replace photos
  await supabase.from("provider_photos").delete().eq("provider_id", providerId);
  if (photo_urls.length > 0) {
    await supabase
      .from("provider_photos")
      .insert(photo_urls.map((url, i) => ({ provider_id: providerId, url, sort_order: i })));
  }

  // Generate embedding for semantic search
  try {
    const { data: cats } = await supabase
      .from("provider_categories")
      .select("categories(name_pt)")
      .eq("provider_id", providerId);
    const catNames = (cats ?? []).flatMap((c) => {
      const cat = c.categories;
      return Array.isArray(cat)
        ? cat.map((x) => x.name_pt)
        : cat
        ? [(cat as { name_pt: string }).name_pt]
        : [];
    });
    const text = buildProviderText(name, description_pt ?? null, catNames);
    const embedding = await embedText(text);
    await supabase
      .from("providers")
      .update({ embedding: JSON.stringify(embedding) })
      .eq("id", providerId);
  } catch (err) {
    console.error("Embedding update failed (updateOwnProvider):", err);
  }

  revalidatePath("/[locale]/provider/[slug]", "page");
}

export async function submitClaim(providerId: string, message?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Check provider is unowned
  const { data: provider } = await supabase
    .from("providers")
    .select("user_id")
    .eq("id", providerId)
    .single();

  if (!provider) return { error: "Provider not found" };
  if (provider.user_id) return { error: "owned" };

  // Check no existing pending claim from this user
  const { data: existing } = await supabase
    .from("claim_requests")
    .select("id")
    .eq("provider_id", providerId)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) return { error: "duplicate" };

  const { error } = await supabase.from("claim_requests").insert({
    provider_id: providerId,
    user_id: user.id,
    message: message || null,
  });

  if (error) return { error: error.message };
  return { success: true };
}

export async function searchUnownedProviders(query: string) {
  const supabase = await createClient();
  const q = query.trim();
  if (!q) return [];

  const { data, error } = await supabase
    .from("providers")
    .select("id, name, whatsapp, home_bairro:home_bairro_id(name)")
    .is("user_id", null)
    .or(`name.ilike.%${q}%,whatsapp.ilike.%${q}%`)
    .limit(10);

  if (error) throw new Error(error.message);
  return data ?? [];
}
