import { createClient } from "@/lib/supabase/server";
import CategoriesManager from "./CategoriesManager";

export default async function CategoriesPage() {
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name_pt, name_en, slug, icon, sort_order")
    .order("sort_order");

  return <CategoriesManager categories={categories ?? []} />;
}
