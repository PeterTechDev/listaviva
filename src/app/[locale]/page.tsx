"use client";

import { useTranslations } from "next-intl";
import { Header } from "@/components/header";

export default function HomePage() {
  const t = useTranslations();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* Hero */}
      <main className="flex-1">
        <section className="max-w-5xl mx-auto px-4 pt-16 pb-12 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight">
            {t("home.hero")}
          </h2>
          <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
            {t("home.subtitle")}
          </p>

          {/* Search bar */}
          <div className="mt-8 max-w-xl mx-auto">
            <div className="relative">
              <input
                type="text"
                placeholder={t("common.searchPlaceholder")}
                className="w-full h-12 pl-4 pr-12 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
              />
              <button className="absolute right-2 top-2 h-8 px-4 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors">
                {t("common.search")}
              </button>
            </div>
          </div>

          {/* CTA buttons */}
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <button className="px-6 py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors shadow-sm">
              {t("home.ctaSearch")}
            </button>
            <button className="px-6 py-3 bg-white text-emerald-600 border border-emerald-200 rounded-xl font-medium hover:bg-emerald-50 transition-colors">
              {t("home.ctaBrowse")}
            </button>
          </div>
        </section>

        {/* How it works */}
        <section className="bg-gray-50 py-16">
          <div className="max-w-5xl mx-auto px-4">
            <h3 className="text-2xl font-bold text-center text-gray-900 mb-12">
              {t("home.howItWorks")}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              {[
                {
                  step: "1",
                  title: t("home.step1Title"),
                  desc: t("home.step1Desc"),
                },
                {
                  step: "2",
                  title: t("home.step2Title"),
                  desc: t("home.step2Desc"),
                },
                {
                  step: "3",
                  title: t("home.step3Title"),
                  desc: t("home.step3Desc"),
                },
              ].map(({ step, title, desc }) => (
                <div key={step} className="text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 font-bold text-xl flex items-center justify-center mx-auto">
                    {step}
                  </div>
                  <h4 className="mt-4 text-lg font-semibold text-gray-900">
                    {title}
                  </h4>
                  <p className="mt-2 text-gray-500">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm text-gray-400">
          {t("common.appName")} &mdash; {t("common.tagline")}
        </div>
      </footer>
    </div>
  );
}
