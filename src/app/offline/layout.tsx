import type { Viewport } from "next";
import { Fraunces, DM_Sans } from "next/font/google";
import "../globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
  axes: ["SOFT", "WONK", "opsz"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dm-sans",
});

export const metadata = { title: "Sem conexão — Listaviva" };

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#C85C38",
};

export default function OfflineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${fraunces.variable} ${dmSans.variable}`}>
      {/* lang is intentionally hardcoded: offline page is Portuguese-only per spec */}
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className="font-sans bg-background text-primary antialiased">
        {children}
      </body>
    </html>
  );
}
