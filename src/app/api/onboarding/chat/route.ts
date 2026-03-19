import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import {
  CollectedData,
  OnboardingRequest,
  OnboardingResponse,
  isValidWorkingHours,
  isOnboardingComplete,
} from "./types";

export const maxDuration = 30;

const openai = new OpenAI(); // reads OPENAI_API_KEY from env automatically

const COLLECT_FIELD_TOOL: OpenAI.ChatCompletionTool = {
  type: "function",
  function: {
    name: "collect_field",
    description: "Call this when you have extracted a field value with confidence.",
    parameters: {
      type: "object",
      properties: {
        field: {
          type: "string",
          // home_bairro_id is NOT here — derived server-side as service_area_ids[0]
          enum: [
            "name",
            "slug",
            "category_ids",
            "description_pt",
            "whatsapp",
            "service_area_ids",
            "working_hours",
          ],
        },
        value: {},
      },
      required: ["field", "value"],
    },
  },
};

function buildSystemPrompt(
  categories: { id: string; name_pt: string }[],
  bairros: { id: string; name: string }[],
  failingField?: string
): string {
  const categoryList = categories
    .map((c) => `  - id: "${c.id}", nome: "${c.name_pt}"`)
    .join("\n");
  const bairroList = bairros
    .map((b) => `  - id: "${b.id}", nome: "${b.name}"`)
    .join("\n");

  const failingHint = failingField
    ? `\n\nO usuário teve dificuldade em fornecer "${failingField}" duas vezes. Faça uma pergunta mais simples e direta apenas para esse valor (ex: para "whatsapp": "Pode me passar só o número com DDD?").`
    : "";

  return `Você é um assistente simpático que ajuda prestadores de serviço a criarem seu perfil no Listaviva, um catálogo local de Linhares, ES.

Tom: caloroso, informal, português brasileiro. Use "Oi", "Pode ser bem simples", "Ficou ótimo!". Nunca seja formal ou burocrático.

Seu objetivo é coletar os seguintes dados em sequência:
1. Nome do negócio ou nome do prestador → campos: name (texto), slug (versão em kebab-case do nome, ex: "maria-faxinas")
2. Tipo de serviço oferecido → campo: category_ids (array de IDs da lista abaixo)
3. Descrição do trabalho → campo: description_pt (use a resposta do usuário diretamente ou levemente editada)
4. WhatsApp → campo: whatsapp (formato brasileiro: +55 DDD número)
5. Bairros de Linhares atendidos → campo: service_area_ids (array de IDs da lista abaixo)
6. Disponibilidade/horários → campo: working_hours (objeto JSON com chaves: mon, tue, wed, thu, fri, sat, sun — use apenas os dias mencionados)

Quando extrair um valor com confiança, chame a função collect_field. Só avance para o próximo campo após confirmar o atual.

Se o usuário disser "centro todo" ou "qualquer bairro" ou "toda Linhares" para bairros, inclua TODOS os IDs da lista de bairros.

Para working_hours, use APENAS as chaves: mon, tue, wed, thu, fri, sat, sun. Exemplo: {"mon":"8h-18h","fri":"8h-18h"}. NUNCA retorne uma string simples para working_hours.

Se detectar intenção de correção (ex: "quero corrigir"), pergunte: "Claro! O que você gostaria de corrigir?" e depois re-colete o campo informado.${failingHint}

---
CATEGORIAS DISPONÍVEIS:
${categoryList}

---
BAIRROS DE LINHARES DISPONÍVEIS:
${bairroList}`;
}

function applyToolCall(
  data: CollectedData,
  field: string,
  value: unknown
): CollectedData {
  const updated = { ...data };
  switch (field) {
    case "name":
      updated.name = String(value);
      break;
    case "slug":
      updated.slug = String(value);
      break;
    case "category_ids":
      updated.category_ids = Array.isArray(value)
        ? value.map(String)
        : [String(value)];
      break;
    case "description_pt":
      updated.description_pt = String(value);
      break;
    case "whatsapp":
      updated.whatsapp = String(value);
      break;
    case "service_area_ids": {
      const ids = Array.isArray(value) ? value.map(String) : [String(value)];
      updated.service_area_ids = ids;
      // Derive home_bairro_id from first service area
      if (ids.length > 0) updated.home_bairro_id = ids[0];
      break;
    }
    case "working_hours":
      // Only accept valid working_hours objects; ignore strings/invalid values
      if (isValidWorkingHours(value)) {
        updated.working_hours = value;
      }
      break;
    default:
      console.warn("[onboarding/chat] unknown field in collect_field:", field);
      break;
  }
  return updated;
}

export async function POST(req: NextRequest) {
  // Auth guard
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: OnboardingRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { messages, collectedData: incomingData, failingField } = body;

  try {
    // Fetch reference data (small tables, fast)
    const [{ data: categories, error: catError }, { data: bairros, error: bairroError }] = await Promise.all([
      supabase.from("categories").select("id, name_pt").order("sort_order"),
      supabase.from("bairros").select("id, name").order("name"),
    ]);

    if (catError) console.error("[onboarding/chat] categories fetch error:", catError);
    if (bairroError) console.error("[onboarding/chat] bairros fetch error:", bairroError);

    const systemPrompt = buildSystemPrompt(
      categories ?? [],
      bairros ?? [],
      failingField
    );

    // Build OpenAI messages array
    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    let collectedData = { ...incomingData };

    // First call — may return tool calls
    const firstResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: openaiMessages,
      tools: [COLLECT_FIELD_TOOL],
      tool_choice: "auto",
    });

    const firstChoice = firstResponse.choices[0];
    if (!firstChoice) {
      return NextResponse.json({ error: "LLM returned empty response" }, { status: 502 });
    }
    let finalMessage: string;

    if (firstChoice.finish_reason === "tool_calls") {
      // Process all tool calls and update collectedData
      const toolCalls = firstChoice.message.tool_calls ?? [];
      for (const tc of toolCalls) {
        if ("function" in tc && tc.function.name === "collect_field") {
          let args: { field: string; value: unknown };
          try {
            args = JSON.parse(tc.function.arguments);
          } catch {
            continue; // skip malformed tool call
          }
          collectedData = applyToolCall(collectedData, args.field, args.value);
        }
      }

      // Append assistant message + synthetic tool results
      openaiMessages.push(firstChoice.message);
      for (const tc of toolCalls) {
        openaiMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: "ok",
        });
      }

      // Second call — get the next conversational question (no tools)
      const secondResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: openaiMessages,
        tool_choice: "none",
      });
      finalMessage = secondResponse.choices[0]?.message?.content ?? "";
    } else {
      finalMessage = firstChoice.message.content ?? "";
    }

    const complete = isOnboardingComplete(collectedData);

    const response: OnboardingResponse = {
      message: finalMessage,
      collectedData,
      complete,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("[onboarding/chat] handler error:", err);
    return NextResponse.json({ error: "Serviço temporariamente indisponível. Tente novamente." }, { status: 500 });
  }
}
