# Conversational Provider Onboarding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the multi-field `ProviderForm` on `/account/create` with an AI-powered chat interface that collects provider data through a natural conversation.

**Architecture:** A Route Handler at `/api/onboarding/chat` orchestrates OpenAI `gpt-4o-mini` with tool calling to extract structured data from free-text responses. The client (`OnboardingChat`) handles local state and shows a typing indicator; after all fields are collected, `ProfilePreviewCard` shows a read-only preview and submits via the existing `createOwnProvider` Server Action.

**Tech Stack:** Next.js 16 App Router, `openai` v6 (already installed), Supabase (auth + data), Tailwind CSS v4 with project design tokens, Vitest for unit tests.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/app/api/onboarding/chat/types.ts` | Create | Shared types + pure utility functions |
| `src/app/api/onboarding/chat/types.test.ts` | Create | Unit tests for pure utilities |
| `src/app/api/onboarding/chat/route.ts` | Create | LLM orchestration, auth, tool-call loop |
| `src/app/[locale]/account/create/OnboardingChat.tsx` | Create | Chat UI client component |
| `src/app/[locale]/account/create/ProfilePreviewCard.tsx` | Create | Preview + submission client component |
| `src/app/[locale]/account/create/page.tsx` | Modify | Swap ProviderForm for OnboardingChat |

---

## Task 1: Shared Types and Pure Utilities

**Files:**
- Create: `src/app/api/onboarding/chat/types.ts`
- Create: `src/app/api/onboarding/chat/types.test.ts`

These pure functions have no external dependencies — they are the ideal candidates for unit tests. Everything else (route handler, UI components) depends on this file.

- [ ] **Step 1: Write the failing tests**

Create `src/app/api/onboarding/chat/types.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  isValidWorkingHours,
  isOnboardingComplete,
  collectedDataToFormData,
  VALID_DAYS,
} from "./types";

describe("isValidWorkingHours", () => {
  it("accepts a valid object with canonical day keys", () => {
    expect(isValidWorkingHours({ mon: "8h-18h", fri: "8h-12h" })).toBe(true);
  });

  it("rejects a plain string", () => {
    expect(isValidWorkingHours("segunda a sexta")).toBe(false);
  });

  it("rejects null", () => {
    expect(isValidWorkingHours(null)).toBe(false);
  });

  it("rejects an array", () => {
    expect(isValidWorkingHours([])).toBe(false);
  });

  it("rejects an empty object", () => {
    expect(isValidWorkingHours({})).toBe(false);
  });

  it("rejects an object with non-canonical keys (e.g. Portuguese day names)", () => {
    expect(isValidWorkingHours({ segunda: "8h-18h" })).toBe(false);
  });

  it("rejects an object with a mix of valid and invalid keys", () => {
    expect(isValidWorkingHours({ mon: "8h-18h", segunda: "8h-18h" })).toBe(false);
  });
});

describe("isOnboardingComplete", () => {
  const base = {
    name: "Maria",
    slug: "maria",
    category_ids: ["cat-1"],
    description_pt: "Faço faxina",
    whatsapp: "+5527999999999",
    service_area_ids: ["b-1"],
    working_hours: { mon: "8h-18h" },
  };

  it("returns true when all required fields are present", () => {
    expect(isOnboardingComplete(base)).toBe(true);
  });

  it("returns false when name is missing", () => {
    expect(isOnboardingComplete({ ...base, name: undefined })).toBe(false);
  });

  it("returns false when category_ids is empty", () => {
    expect(isOnboardingComplete({ ...base, category_ids: [] })).toBe(false);
  });

  it("returns false when service_area_ids is empty", () => {
    expect(isOnboardingComplete({ ...base, service_area_ids: [] })).toBe(false);
  });

  it("returns false when working_hours is a string (LLM mistake)", () => {
    expect(isOnboardingComplete({ ...base, working_hours: "seg-sex" as never })).toBe(false);
  });
});

describe("collectedDataToFormData", () => {
  it("maps all fields to the correct FormData keys", () => {
    const data = {
      name: "Maria",
      slug: "maria",
      description_pt: "Faxineira",
      whatsapp: "+5527999999999",
      home_bairro_id: "b-1",
      category_ids: ["cat-1", "cat-2"],
      service_area_ids: ["b-1", "b-2"],
      working_hours: { mon: "8h-18h", fri: "8h-12h" },
    };
    const fd = collectedDataToFormData(data);
    expect(fd.get("name")).toBe("Maria");
    expect(fd.get("slug")).toBe("maria");
    expect(fd.get("description_pt")).toBe("Faxineira");
    expect(fd.get("whatsapp")).toBe("+5527999999999");
    expect(fd.get("home_bairro_id")).toBe("b-1");
    expect(fd.getAll("category_ids")).toEqual(["cat-1", "cat-2"]);
    expect(fd.getAll("service_area_ids")).toEqual(["b-1", "b-2"]);
    expect(fd.get("hours_mon")).toBe("8h-18h");
    expect(fd.get("hours_fri")).toBe("8h-12h");
    expect(fd.get("hours_sat")).toBeNull(); // not set
    expect(fd.get("description_en")).toBeNull(); // intentionally omitted
    expect(fd.get("photo_urls")).toBeNull(); // intentionally omitted
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/peter/personal/listaviva
npx vitest run src/app/api/onboarding/chat/types.test.ts
```

Expected: multiple failures (module not found).

- [ ] **Step 3: Implement the types file**

Create `src/app/api/onboarding/chat/types.ts`:

```typescript
export const VALID_DAYS = new Set(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);

export type CollectedData = {
  name?: string;
  slug?: string;
  category_ids?: string[];
  description_pt?: string;
  whatsapp?: string;
  service_area_ids?: string[];
  home_bairro_id?: string;
  working_hours?: Record<string, string>;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type OnboardingRequest = {
  messages: ChatMessage[];
  collectedData: CollectedData;
  failingField?: string;
};

export type OnboardingResponse = {
  message: string;
  collectedData: CollectedData;
  complete: boolean;
};

export function isValidWorkingHours(v: unknown): v is Record<string, string> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const keys = Object.keys(v);
  return keys.length > 0 && keys.every((k) => VALID_DAYS.has(k));
}

export function isOnboardingComplete(data: CollectedData): boolean {
  return (
    !!data.name &&
    !!data.slug &&
    (data.category_ids?.length ?? 0) > 0 &&
    !!data.description_pt &&
    !!data.whatsapp &&
    (data.service_area_ids?.length ?? 0) > 0 &&
    isValidWorkingHours(data.working_hours)
  );
}

export function collectedDataToFormData(data: CollectedData): FormData {
  const fd = new FormData();
  if (data.name) fd.set("name", data.name);
  if (data.slug) fd.set("slug", data.slug);
  if (data.description_pt) fd.set("description_pt", data.description_pt);
  if (data.whatsapp) fd.set("whatsapp", data.whatsapp);
  if (data.home_bairro_id) fd.set("home_bairro_id", data.home_bairro_id);
  (data.category_ids ?? []).forEach((id) => fd.append("category_ids", id));
  (data.service_area_ids ?? []).forEach((id) =>
    fd.append("service_area_ids", id)
  );
  // photo_urls intentionally omitted — added post-creation on /account/edit
  const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
  for (const day of days) {
    const val = data.working_hours?.[day];
    if (val) fd.set(`hours_${day}`, val);
  }
  return fd;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/app/api/onboarding/chat/types.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/onboarding/chat/types.ts src/app/api/onboarding/chat/types.test.ts
git commit -m "feat: add onboarding shared types and pure utilities"
```

---

## Task 2: Route Handler

**Files:**
- Create: `src/app/api/onboarding/chat/route.ts`

The Route Handler handles auth, fetches categories and bairros from Supabase, builds the system prompt, calls OpenAI with tool calling, runs the two-call tool loop if needed, and returns a `OnboardingResponse` JSON.

No unit tests — this function requires live Supabase + OpenAI. Manual testing is defined in Task 5.

**Before starting:** Make sure `OPENAI_API_KEY` is set in `.env.local`. Check with `cat .env.local | grep OPENAI`. If missing, add it.

- [ ] **Step 1: Create the route handler**

Create `src/app/api/onboarding/chat/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import {
  CollectedData,
  OnboardingRequest,
  OnboardingResponse,
  isValidWorkingHours,
  isOnboardingComplete,
  VALID_DAYS,
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

  const body: OnboardingRequest = await req.json();
  const { messages, collectedData: incomingData, failingField } = body;

  // Fetch reference data (small tables, fast)
  const [{ data: categories }, { data: bairros }] = await Promise.all([
    supabase.from("categories").select("id, name_pt").order("sort_order"),
    supabase.from("bairros").select("id, name").order("name"),
  ]);

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
  let finalMessage: string;

  if (firstChoice.finish_reason === "tool_calls") {
    // Process all tool calls and update collectedData
    const toolCalls = firstChoice.message.tool_calls ?? [];
    for (const tc of toolCalls) {
      if (tc.function.name === "collect_field") {
        const args = JSON.parse(tc.function.arguments) as {
          field: string;
          value: unknown;
        };
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
    finalMessage = secondResponse.choices[0].message.content ?? "";
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
}
```

- [ ] **Step 2: Verify the file compiles (TypeScript check)**

```bash
cd /Users/peter/personal/listaviva
npx tsc --noEmit
```

Expected: no errors related to the new file. Fix any type errors before continuing.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/onboarding/chat/route.ts
git commit -m "feat: add /api/onboarding/chat route handler with OpenAI tool calling"
```

---

## Task 3: OnboardingChat Component

**Files:**
- Create: `src/app/[locale]/account/create/OnboardingChat.tsx`

This is a "use client" component. It manages message history, collectedData, retry logic, and calls the route handler. When `complete: true` arrives from the server, it calls the `onComplete` prop with the final `collectedData`.

Design tokens: `bg-background`, `bg-surface`, `border-border`, `text-primary`, `text-muted`, `bg-accent`, `bg-accent-hover`. For the chat bubbles: user messages right-aligned `bg-accent text-white`, assistant messages left-aligned `bg-surface`.

- [ ] **Step 1: Create the component**

Create `src/app/[locale]/account/create/OnboardingChat.tsx`:

```typescript
"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { CollectedData, ChatMessage } from "@/app/api/onboarding/chat/types";

interface Props {
  onComplete: (data: CollectedData) => void;
}

const FIELD_ORDER = [
  "name",
  "category_ids",
  "description_pt",
  "whatsapp",
  "service_area_ids",
  "working_hours",
] as const;

function getCurrentStep(
  data: CollectedData,
  correctionField: string | null
): string {
  if (correctionField) return correctionField;
  for (const field of FIELD_ORDER) {
    const val = data[field];
    if (!val || (Array.isArray(val) && val.length === 0)) return field;
    if (
      field === "working_hours" &&
      (typeof val === "string" || Object.keys(val).length === 0)
    )
      return field;
  }
  return "working_hours"; // fallback — shouldn't reach here if complete
}

export default function OnboardingChat({ onComplete }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [collectedData, setCollectedData] = useState<CollectedData>({});
  const [retryCount, setRetryCount] = useState<Record<string, number>>({});
  const [correctionField, setCorrectionField] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasStarted = useRef(false);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isPending]);

  // Send initial greeting on mount
  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    sendMessage("", {}, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendMessage(
    userText: string,
    currentData: CollectedData,
    isInitial = false
  ) {
    const newMessages: ChatMessage[] = isInitial
      ? []
      : [...messages, { role: "user" as const, content: userText }];

    if (!isInitial) {
      setMessages(newMessages);
    }
    setError(null);

    // Determine failingField
    const step = getCurrentStep(currentData, correctionField);
    const currentRetry = retryCount[step] ?? 0;
    const failingField = currentRetry >= 2 ? step : undefined;

    startTransition(async () => {
      try {
        const res = await fetch("/api/onboarding/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: newMessages,
            collectedData: currentData,
            failingField,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setError(err.error ?? "Erro ao conectar. Tente novamente.");
          return;
        }

        const data = await res.json();
        const assistantMsg: ChatMessage = {
          role: "assistant",
          content: data.message,
        };

        const updatedMessages = [...newMessages, assistantMsg];
        setMessages(updatedMessages);

        // Retry logic: check if collectedData changed
        const newData: CollectedData = data.collectedData;
        const prevData = currentData;
        const dataChanged =
          JSON.stringify(newData) !== JSON.stringify(prevData);

        if (!dataChanged && !isInitial) {
          setRetryCount((prev) => ({
            ...prev,
            [step]: (prev[step] ?? 0) + 1,
          }));
        } else {
          // Reset retry for this step on progress
          setRetryCount((prev) => ({ ...prev, [step]: 0 }));
          // Reset correctionField if we successfully updated the field
          if (correctionField && newData[correctionField as keyof CollectedData] !== prevData[correctionField as keyof CollectedData]) {
            setCorrectionField(null);
          }
        }

        setCollectedData(newData);

        if (data.complete) {
          onComplete(newData);
        }
      } catch {
        setError("Erro de conexão. Verifique sua internet e tente novamente.");
      }
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isPending) return;

    // Detect correction intent to set correctionField
    // (The actual field will be identified by the user in the next message,
    // but we set correctionField to null here so it can be updated by the
    // LLM's response path. The LLM handles the conversational correction.)
    if (
      text.toLowerCase().includes("corrigir") ||
      text.toLowerCase().includes("corrig")
    ) {
      setCorrectionField("__pending__"); // will resolve after LLM asks what to fix
    }

    setInput("");
    sendMessage(text, collectedData);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  }

  return (
    <div className="flex flex-col h-full min-h-[500px]">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-accent text-white rounded-br-sm"
                  : "bg-surface border border-border text-primary rounded-bl-sm"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isPending && (
          <div className="flex justify-start">
            <div className="bg-surface border border-border rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1 items-center h-4">
                <span className="w-2 h-2 bg-muted rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-muted rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-muted rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="text-center text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <form
        onSubmit={handleSubmit}
        className="flex gap-2 pt-3 border-t border-border"
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite sua resposta..."
          rows={1}
          disabled={isPending}
          className="flex-1 resize-none rounded-xl border border-border bg-surface px-4 py-3 text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isPending || !input.trim()}
          className="px-4 py-3 bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          →
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors. Fix any if found.

- [ ] **Step 3: Commit**

```bash
git add src/app/[locale]/account/create/OnboardingChat.tsx
git commit -m "feat: add OnboardingChat client component"
```

---

## Task 4: ProfilePreviewCard Component

**Files:**
- Create: `src/app/[locale]/account/create/ProfilePreviewCard.tsx`

This is a "use client" component. It imports `createOwnProvider` from the Server Action file and calls it via `startTransition`. It uses `collectedDataToFormData` from the shared types file.

The preview should feel like the public catalog — use the same visual design as `src/app/[locale]/provider/[slug]/page.tsx` for reference on how category pills and bairro chips look. Use design tokens throughout.

- [ ] **Step 1: Create the component**

Create `src/app/[locale]/account/create/ProfilePreviewCard.tsx`:

```typescript
"use client";

import { useState, useTransition } from "react";
import {
  CollectedData,
  collectedDataToFormData,
} from "@/app/api/onboarding/chat/types";
import { createOwnProvider } from "../actions";

const DAY_LABELS: Record<string, string> = {
  mon: "Seg",
  tue: "Ter",
  wed: "Qua",
  thu: "Qui",
  fri: "Sex",
  sat: "Sáb",
  sun: "Dom",
};

function formatWorkingHours(hours: Record<string, string>): string {
  const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const entries = days
    .filter((d) => hours[d])
    .map((d) => `${DAY_LABELS[d]} ${hours[d]}`);
  return entries.join(" · ");
}

interface Category {
  id: string;
  name_pt: string;
}

interface Bairro {
  id: string;
  name: string;
}

interface Props {
  data: CollectedData;
  categories: Category[]; // full list to look up names by id
  bairros: Bairro[];      // full list to look up names by id
  onCorrect: () => void;
}

export default function ProfilePreviewCard({
  data,
  categories,
  bairros,
  onCorrect,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const providerCategories = categories.filter((c) =>
    (data.category_ids ?? []).includes(c.id)
  );
  const providerBairros = bairros.filter((b) =>
    (data.service_area_ids ?? []).includes(b.id)
  );

  function handlePublish() {
    setSubmitError(null);
    startTransition(async () => {
      const fd = collectedDataToFormData(data);
      const result = await createOwnProvider(fd);
      // createOwnProvider redirects on success, so result is only returned on error
      if (result?.error) {
        setSubmitError(`Erro ao publicar: ${result.error}. Tente novamente.`);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Preview header */}
      <div className="text-center space-y-1">
        <p className="text-sm text-muted">É assim que seu perfil vai aparecer</p>
        <h2 className="text-xl font-bold text-primary">{data.name}</h2>
      </div>

      {/* Preview card */}
      <div className="bg-surface rounded-2xl border border-border p-5 space-y-4">
        {/* Category pills */}
        {providerCategories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {providerCategories.map((c) => (
              <span
                key={c.id}
                className="px-3 py-1 bg-accent/10 text-accent rounded-full text-xs font-medium"
              >
                {c.name_pt}
              </span>
            ))}
          </div>
        )}

        {/* Description */}
        {data.description_pt && (
          <p className="text-sm text-primary leading-relaxed">
            {data.description_pt}
          </p>
        )}

        {/* Service areas */}
        {providerBairros.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted uppercase tracking-wider">
              Atende em
            </p>
            <div className="flex flex-wrap gap-1.5">
              {providerBairros.map((b) => (
                <span
                  key={b.id}
                  className="px-2 py-0.5 bg-background border border-border rounded text-xs text-primary"
                >
                  {b.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Working hours */}
        {data.working_hours && Object.keys(data.working_hours).length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted uppercase tracking-wider">
              Horários
            </p>
            <p className="text-sm text-primary">
              {formatWorkingHours(data.working_hours)}
            </p>
          </div>
        )}

        {/* WhatsApp (visual only) */}
        {data.whatsapp && (
          <div className="pt-1">
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-accent/10 text-accent rounded-lg text-sm font-medium opacity-60 cursor-default">
              WhatsApp {data.whatsapp}
            </span>
          </div>
        )}

        {/* Photo placeholder */}
        <div className="h-24 bg-background border border-border rounded-xl flex items-center justify-center">
          <p className="text-xs text-muted">
            📸 Adicione fotos depois de publicar
          </p>
        </div>
      </div>

      {/* Error */}
      {submitError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {submitError}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={handlePublish}
          disabled={isPending}
          className="w-full py-3 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Publicando..." : "Publicar meu perfil"}
        </button>
        <button
          type="button"
          onClick={onCorrect}
          disabled={isPending}
          className="w-full py-2.5 text-sm text-muted hover:text-primary transition-colors"
        >
          Quero corrigir algo
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/[locale]/account/create/ProfilePreviewCard.tsx
git commit -m "feat: add ProfilePreviewCard with submission and correction actions"
```

---

## Task 5: Update the Create Page and Wire Everything Together

**Files:**
- Modify: `src/app/[locale]/account/create/page.tsx`

The page now:
1. Checks auth (already exists)
2. Redirects if provider already exists (already exists)
3. Fetches categories + bairros (needed to pass to ProfilePreviewCard for name lookup)
4. Renders `OnboardingChat` until complete, then `ProfilePreviewCard`

The page needs to manage a `collectedData` state and a `showPreview` flag. Since this requires state, we need a thin Client Component wrapper. The page itself stays as a Server Component that fetches the data; it renders a new `CreatePageClient` client component.

- [ ] **Step 1: Create the client wrapper**

Create `src/app/[locale]/account/create/CreatePageClient.tsx`:

```typescript
"use client";

import { useState } from "react";
import OnboardingChat from "./OnboardingChat";
import ProfilePreviewCard from "./ProfilePreviewCard";
import { CollectedData } from "@/app/api/onboarding/chat/types";

interface Category {
  id: string;
  name_pt: string;
}
interface Bairro {
  id: string;
  name: string;
}

interface Props {
  categories: Category[];
  bairros: Bairro[];
}

export default function CreatePageClient({ categories, bairros }: Props) {
  const [collectedData, setCollectedData] = useState<CollectedData | null>(null);

  if (collectedData) {
    return (
      <ProfilePreviewCard
        data={collectedData}
        categories={categories}
        bairros={bairros}
        onCorrect={() => setCollectedData(null)}
      />
    );
  }

  return <OnboardingChat onComplete={setCollectedData} />;
}
```

- [ ] **Step 2: Update the page**

Replace the contents of `src/app/[locale]/account/create/page.tsx`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { getCurrentUser } from "@/lib/auth";
import CreatePageClient from "./CreatePageClient";

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
    supabase.from("categories").select("id, name_pt").order("sort_order"),
  ]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-lg mx-auto px-4 py-8 w-full">
        <h1 className="text-xl font-bold text-primary mb-6">
          {t("account.createListing")}
        </h1>
        <CreatePageClient
          categories={categories ?? []}
          bairros={bairros ?? []}
        />
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors. Fix any import or type issues.

- [ ] **Step 4: Commit**

```bash
git add src/app/[locale]/account/create/CreatePageClient.tsx src/app/[locale]/account/create/page.tsx
git commit -m "feat: swap ProviderForm for conversational onboarding on /account/create"
```

---

## Task 6: Manual End-to-End Verification

No automated tests for LLM behavior. Run through the test cases manually on the dev server.

**Prerequisites:**
- `OPENAI_API_KEY` is set in `.env.local`
- Dev server is running: `npm run dev`
- Logged in as `petersouza@listaviva.local` (dev user) at `http://localhost:3000/pt-BR/login`
- Navigate to `http://localhost:3000/pt-BR/account/create`

- [ ] **Test 1: Happy path (mobile viewport)**

Set browser to 390×844 (iPhone 14). Complete all 6 steps:
1. Enter business name → slug is auto-confirmed
2. Enter a service type that matches a category (e.g., "faço faxina")
3. Enter a short description
4. Enter a valid WhatsApp: "27 99999-9999"
5. Enter a bairro: "centro" or "bairro Aviso"
6. Enter availability: "segunda a sexta das 8 às 18h"

Expected: preview card appears showing all data. Flow completes in under 2 minutes.

- [ ] **Test 2: Ambiguous category**

Enter "faço de tudo em casa" for service type.
Expected: LLM asks a clarifying question (does not blindly pick one category).

- [ ] **Test 3: Invalid WhatsApp**

Enter "99999" for WhatsApp.
Expected: LLM asks again with guidance. After a second failed attempt, simpler question appears.

- [ ] **Test 4: Correction flow**

Complete all steps to reach the preview card. Click "Quero corrigir algo".
Expected: returns to chat. LLM asks "O que você gostaria de corrigir?". Enter "meu WhatsApp". LLM asks for WhatsApp again. Enter a new number. Preview re-appears with updated WhatsApp.

- [ ] **Test 5: Final submission**

On the preview card, click "Publicar meu perfil".
Expected: redirected to `/account`. Provider listing appears with status "pending".

- [ ] **Test 6: Auth guard**

While logged out, call `curl -X POST http://localhost:3000/api/onboarding/chat -H "Content-Type: application/json" -d '{}'`
Expected: `{"error":"Unauthorized"}` with HTTP 401.

- [ ] **Final commit**

```bash
git add -A
git commit -m "feat: complete conversational onboarding — verified end-to-end"
```

---

## Environment Setup Reminder

Before running the dev server for Task 6, verify:

```bash
grep OPENAI_API_KEY .env.local
```

If missing, add your OpenAI API key:
```
OPENAI_API_KEY=sk-...
```
