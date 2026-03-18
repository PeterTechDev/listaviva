"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { toSlug } from "@/lib/slug";
import { buildProviderText, embedText } from "@/lib/embeddings";

export async function approveRecommendation(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: recommendation } = await supabase
    .from("recommendations")
    .select("*")
    .eq("id", id)
    .eq("status", "pending")
    .maybeSingle();
  if (!recommendation) return { error: "Not found" };

  // Slug generation with collision handling
  const baseSlug = toSlug(recommendation.provider_name);
  let slug = baseSlug;
  const { data: existing } = await supabase
    .from("providers")
    .select("slug")
    .eq("slug", baseSlug)
    .maybeSingle();
  if (existing) slug = `${baseSlug}-${Date.now().toString(36)}`;

  const { data: newProvider, error: insertError } = await supabase
    .from("providers")
    .insert({
      name: recommendation.provider_name,
      slug,
      whatsapp: recommendation.whatsapp,
      home_bairro_id: recommendation.bairro_id,
      description_pt: recommendation.description ?? null,
      status: "active",
      tier: "free",
    })
    .select("id")
    .single();
  if (insertError) return { error: insertError.message };

  if (recommendation.category_id) {
    await supabase.from("provider_categories").insert({
      provider_id: newProvider.id,
      category_id: recommendation.category_id,
    });
  }

  await supabase
    .from("recommendations")
    .update({
      status: "approved",
      reviewed_by: user.id,
      created_provider_id: newProvider.id,
    })
    .eq("id", id);

  // Generate embedding (non-blocking)
  try {
    const { data: cats } = await supabase
      .from("provider_categories")
      .select("categories(name_pt)")
      .eq("provider_id", newProvider.id);
    const catNames = (cats ?? []).flatMap((c) => {
      const cat = c.categories;
      return Array.isArray(cat)
        ? cat.map((x: { name_pt: string }) => x.name_pt)
        : cat
        ? [(cat as { name_pt: string }).name_pt]
        : [];
    });
    const text = buildProviderText(
      recommendation.provider_name,
      recommendation.description ?? null,
      catNames
    );
    const embedding = await embedText(text);
    await supabase
      .from("providers")
      .update({ embedding: JSON.stringify(embedding) })
      .eq("id", newProvider.id);
  } catch {
    // non-blocking
  }

  revalidatePath("/[locale]/admin/recommendations", "page");
  revalidatePath("/[locale]/category/[slug]", "page");
}

export async function rejectRecommendation(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  await supabase
    .from("recommendations")
    .update({ status: "rejected", reviewed_by: user.id })
    .eq("id", id);

  revalidatePath("/[locale]/admin/recommendations", "page");
}
