import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import withPWAInit from "@ducanh2912/next-pwa";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  cacheOnFrontEndNav: true,
  fallbacks: {
    document: "/offline",
  },
  workboxOptions: {
    runtimeCaching: [
      {
        // Catalog pages and provider profiles (both locales)
        urlPattern: /\/(pt-BR|en)(\/(?:categories|category|provider).*)?$/,
        handler: "StaleWhileRevalidate" as const,
        options: {
          cacheName: "pages-cache",
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          },
        },
      },
      {
        // Next.js image optimization endpoint
        urlPattern: /\/_next\/image/,
        handler: "CacheFirst" as const,
        options: {
          cacheName: "image-cache",
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          },
        },
      },
      {
        // Supabase Storage provider photos
        urlPattern:
          /^https:\/\/eglgafwlzcgkdjfynitp\.supabase\.co\/storage\//,
        handler: "CacheFirst" as const,
        options: {
          cacheName: "supabase-photos-cache",
          expiration: {
            maxEntries: 150,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          },
        },
      },
    ],
  },
});

const nextConfig: NextConfig = {};

export default withPWA(withNextIntl(nextConfig));
