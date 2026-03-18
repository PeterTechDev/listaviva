import { createClient } from "@/lib/supabase/server";
import BairrosManager from "./BairrosManager";

export default async function BairrosPage() {
  const supabase = await createClient();
  const { data: bairros } = await supabase
    .from("bairros")
    .select("id, name, slug, created_at")
    .order("name");

  return <BairrosManager bairros={bairros ?? []} />;
}
