"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function approveClaim(claimId: string) {
  const supabase = await createClient();

  // Fetch the claim
  const { data: claim, error: fetchError } = await supabase
    .from("claim_requests")
    .select("id, provider_id, user_id")
    .eq("id", claimId)
    .eq("status", "pending")
    .single();

  if (fetchError || !claim) return { error: "Claim not found" };

  // Set provider owner
  const { error: providerError } = await supabase
    .from("providers")
    .update({ user_id: claim.user_id })
    .eq("id", claim.provider_id);

  if (providerError) return { error: providerError.message };

  // Upgrade claimant role
  await supabase
    .from("profiles")
    .update({ role: "provider" })
    .eq("id", claim.user_id);

  // Approve this claim
  await supabase
    .from("claim_requests")
    .update({ status: "approved" })
    .eq("id", claimId);

  // Reject all other pending claims for this provider
  await supabase
    .from("claim_requests")
    .update({ status: "rejected" })
    .eq("provider_id", claim.provider_id)
    .eq("status", "pending")
    .neq("id", claimId);

  revalidatePath("/[locale]/admin/claims", "page");
}

export async function rejectClaim(claimId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("claim_requests")
    .update({ status: "rejected" })
    .eq("id", claimId);

  if (error) return { error: error.message };

  revalidatePath("/[locale]/admin/claims", "page");
}
