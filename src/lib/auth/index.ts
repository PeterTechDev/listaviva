import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type UserRole = "consumer" | "provider" | "admin";

export interface UserProfile {
  id: string;
  role: UserRole;
  full_name: string | null;
  avatar_url: string | null;
  locale: string;
}

/** Returns the current user's profile, or null if not logged in. */
export async function getCurrentUser(): Promise<UserProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role, full_name, avatar_url, locale")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("[auth] profile fetch failed", {
      userId: user.id,
      code: error.code,
      message: error.message,
    });
  }

  return profile ?? null;
}

/** Redirects to login if not authenticated. Returns the profile. */
export async function requireAuth(locale = "pt-BR"): Promise<UserProfile> {
  const profile = await getCurrentUser();
  if (!profile) redirect(`/${locale}/login`);
  return profile;
}

/** Redirects to 403 if not admin. Returns the profile. */
export async function requireAdmin(locale = "pt-BR"): Promise<UserProfile> {
  const profile = await requireAuth(locale);
  if (profile.role !== "admin") {
    redirect(`/${locale}/403`);
  }
  return profile;
}

/** Sign out and redirect to homepage. */
export async function signOut(locale = "pt-BR") {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${locale}`);
}
