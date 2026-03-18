"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function submitRecommendation(
  _prev: { error: string | null } | null,
  formData: FormData
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const provider_name = (formData.get("provider_name") as string)?.trim();
  if (!provider_name) return { error: "Name is required" };

  const category_id = (formData.get("category_id") as string) || null;
  const whatsapp = (formData.get("whatsapp") as string)?.trim() || null;
  const bairro_id = (formData.get("bairro_id") as string) || null;
  const description = (formData.get("description") as string)?.trim() || null;

  const { error } = await supabase.from("recommendations").insert({
    submitted_by: user.id,
    provider_name,
    category_id,
    whatsapp,
    bairro_id,
    description,
    status: "pending",
  });

  if (error) return { error: error.message };

  redirect("/account");
}
