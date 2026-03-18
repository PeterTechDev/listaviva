import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/header";
import { getCurrentUser } from "@/lib/auth";
import ProviderForm from "../../admin/providers/ProviderForm";
import { createOwnProvider } from "../actions";

export default async function CreateListingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const user = await getCurrentUser();

  if (!user) redirect(`/${locale}/login`);

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("providers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) redirect(`/${locale}/account`);

  const [{ data: bairros }, { data: categories }] = await Promise.all([
    supabase.from("bairros").select("id, name").order("name"),
    supabase.from("categories").select("id, name_pt, name_en, icon").order("sort_order"),
  ]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto px-4 py-8 w-full">
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/account"
            className="text-sm text-muted hover:text-primary transition-colors"
          >
            ← {t("common.back")}
          </Link>
          <h1 className="text-2xl font-bold text-primary">
            {t("account.createListing")}
          </h1>
        </div>
        <ProviderForm
          bairros={bairros ?? []}
          categories={categories ?? []}
          initialData={{}}
          mode="create"
          action={createOwnProvider}
          redirectTo="/account"
          selfService
        />
      </main>
    </div>
  );
}
