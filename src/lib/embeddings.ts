import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function embedText(text: string): Promise<number[]> {
  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text.slice(0, 8192),
  });
  return response.data[0].embedding;
}

export function buildProviderText(
  name: string,
  descriptionPt: string | null,
  categoryNames: string[]
): string {
  return [name, descriptionPt ?? "", categoryNames.join(" ")]
    .filter(Boolean)
    .join(" ");
}
