import { createClient } from "@supabase/supabase-js";
import { embedText, buildProviderText } from "@/lib/embeddings";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (authHeader !== `Bearer ${serviceKey}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey
  );

  const { data: providers } = await supabase
    .from("providers")
    .select("id, name, description_pt, provider_categories(categories(name_pt))")
    .eq("status", "active")
    .is("embedding", null);

  let processed = 0;
  let errors = 0;

  // Sequential — avoid overwhelming the OpenAI rate limit
  for (const provider of providers ?? []) {
    try {
      const catNames = (provider.provider_categories ?? []).flatMap(
        (pc: { categories: unknown }) =>
          Array.isArray(pc.categories)
            ? (pc.categories as { name_pt: string }[]).map((c) => c.name_pt)
            : pc.categories
            ? [(pc.categories as { name_pt: string }).name_pt]
            : []
      );
      const text = buildProviderText(provider.name, provider.description_pt ?? null, catNames);
      const embedding = await embedText(text);
      await supabase
        .from("providers")
        .update({ embedding: JSON.stringify(embedding) })
        .eq("id", provider.id);
      processed++;
    } catch {
      errors++;
    }
  }

  return Response.json({ processed, errors });
}
