import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

export default async function proxy(request: NextRequest) {
  // Start with a base response (may be overridden by intl or redirects)
  let response = NextResponse.next({ request });

  // Create Supabase client to refresh session cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — must be called before checking user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Protect /admin routes
  if (pathname.includes("/admin")) {
    if (!user) {
      const locale = pathname.startsWith("/en") ? "en" : "pt-BR";
      return NextResponse.redirect(
        new URL(`/${locale}/login?next=${pathname}`, request.url)
      );
    }

    // Verify admin role in DB
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return new NextResponse(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { "content-type": "application/json" } }
      );
    }
  }

  // Run next-intl middleware for locale routing
  const intlResponse = intlMiddleware(request);

  // Carry over any session cookies set above onto the intl response
  if (intlResponse) {
    response.cookies.getAll().forEach(({ name, value }) => {
      intlResponse.cookies.set(name, value);
    });
    return intlResponse;
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/(pt-BR|en)/:path*",
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};
