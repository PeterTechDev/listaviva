import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * OAuth callback handler — Supabase redirects here after Google login.
 * Exchanges the code for a session, then redirects to the intended page.
 *
 * To configure Google OAuth in Supabase:
 * 1. Supabase Dashboard → Authentication → Providers → Google → Enable
 * 2. Add your Google OAuth credentials (Client ID + Secret)
 *    from: https://console.cloud.google.com → APIs & Services → Credentials
 * 3. Add this URL to Google's Authorized Redirect URIs:
 *    https://<your-project>.supabase.co/auth/v1/callback
 * 4. Add your site URL to Supabase → Authentication → URL Configuration
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const locale = searchParams.get("locale") ?? "pt-BR";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Redirect to the intended page with the correct locale
      const redirectTo = next.startsWith("/") ? next : `/${locale}`;
      return NextResponse.redirect(new URL(redirectTo, origin));
    }
  }

  // On error, redirect to login with error param
  return NextResponse.redirect(
    new URL(`/${locale}/login?error=auth_failed`, origin)
  );
}
