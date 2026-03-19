# Conversational Provider Onboarding — Design Spec

**Goal:** Replace the traditional multi-field provider registration form with an AI-powered conversational chat interface, so providers can create their listing naturally on mobile without friction.

**Audience:** Service providers (prestadores) who receive a WhatsApp link and register themselves — typically non-technical, mobile-first, Brazilian Portuguese speakers.

**Portfolio angle:** Demonstrates AI-native UX thinking — forms replaced by conversation, not augmented by it.

---

## Problem

The current `/account/create` page renders a long `ProviderForm` with all fields visible at once: name, slug, description, WhatsApp, categories, bairros, working hours, photos. This is the same form used by the admin. It is intimidating on mobile and incongruent with how providers communicate in real life (WhatsApp messages).

The admin form (`/admin/providers/new`) is intentionally unchanged — it gives Peter full control for manual seeding.

---

## Architecture

Three new units, one modified route:

| Unit | Responsibility |
|---|---|
| `OnboardingChat` component | Chat UI with typing indicator, message history, field progress |
| `/api/onboarding/chat` route handler | LLM orchestration, field extraction via tool calling, JSON response |
| `ProfilePreviewCard` component | Read-only preview of the listing as consumers will see it |
| `/account/create` page | Swaps `ProviderForm` for `OnboardingChat` |

The existing `createOwnProvider` Server Action is called via a `collectedDataToFormData()` serialization helper — the action itself is unchanged.

**No streaming.** The route handler makes a standard (non-streaming) OpenAI call and returns a JSON response. The client shows a typing indicator while the request is in flight. `gpt-4o-mini` responds in ~1–2 seconds — sufficient for a chat-like feel on mobile.

---

## Conversation Flow

Six steps in sequence. The LLM uses a `collect_field` tool to signal when a field is extracted with confidence. The server accumulates fields and transitions to the next step automatically.

| Step | Question | Fields collected | Notes |
|---|---|---|---|
| 1 | "Olá! Vou te ajudar a criar seu perfil em 2 minutos. Qual é o nome do seu negócio ou seu nome?" | `name`, `slug` | Slug auto-generated from name |
| 2 | "Que tipo de serviço você oferece?" | `category_ids` | LLM maps free text to existing categories. Confirms if ambiguous: "Encontrei *Diarista* — correto?" |
| 3 | "Me conta um pouco mais sobre o seu trabalho. Pode ser bem simples." | `description_pt` | LLM uses response verbatim or lightly cleaned |
| 4 | "Qual é o seu WhatsApp?" | `whatsapp` | LLM validates Brazilian format (+55 DDD number) |
| 5 | "Quais bairros de Linhares você atende?" | `service_area_ids` | LLM maps free text to bairros. If empty (LLM could not match), field remains unset and LLM asks again. Handles "centro todo" (all bairro IDs), "qualquer bairro" (all bairro IDs). `home_bairro_id` is derived server-side as `service_area_ids[0]` — never set by the LLM. |
| 6 | "Qual é sua disponibilidade? Ex: segunda a sexta, das 8h às 18h" | `working_hours` | LLM converts natural language to `{mon: "8h-18h", ...}` format. Hour strings are stored as-is (e.g. "8h-18h", "08:00-18:00") — the preview card and stored value are the LLM's output verbatim. |

After step 6: server returns `complete: true` → client renders `ProfilePreviewCard`.

**Missing optional fields:**
- `description_en` — left `null`; omitted from conversation entirely.
- `phone` — left `null`.
- `photo_urls` — empty; photos are added post-creation on `/account/edit`.

**Error handling / retry:** The client tracks `retryCount: Record<string, number>` locally in React state (never sent to server). After each response, the client compares the new `collectedData` against the previous one. If neither `collectedData` changed nor any new fields were added, the client increments `retryCount["current_step"]` (using a `currentStep: string` local variable tracking which field the conversation is currently targeting). When `retryCount["current_step"] >= 2`, the client appends `"failingField": currentStep` in the next request body. The route handler, on receiving `failingField`, prepends an extra instruction to the system prompt: `"The user has struggled to provide '${failingField}' twice. Ask a simpler, more direct follow-up question for just that one value (e.g., for 'whatsapp': 'Pode me passar só o número com DDD?')."` This covers both never-set fields and stuck-at-update fields. The `currentStep` is computed as follows:
- During the **initial forward flow**: first key in `["name","category_ids","description_pt","whatsapp","service_area_ids","working_hours"]` that is absent or empty in `collectedData`.
- During the **correction flow** (after "Quero corrigir algo" was clicked): `currentStep` is set to the field the user mentions wanting to fix. The client listens for the LLM's follow-up question after "Quero corrigir" and maintains a separate `correctionField: string | null` state. When `correctionField` is set, it overrides the `currentStep` calculation for retry purposes. `correctionField` is reset to `null` once the field is successfully updated (detected by comparing `collectedData` before and after the response).

**Tone:** Warm, informal, Brazilian Portuguese. "Oi", "Pode ser bem simples", "Ficou ótimo!". Never formal or bureaucratic.

---

## LLM Configuration

- **Package:** `openai` (already in `package.json` at v6.32.0) — no new packages needed
- **API key:** `process.env.OPENAI_API_KEY` — must be present in `.env.local` and Vercel env vars. The `OpenAI` client reads this automatically: `const openai = new OpenAI()`.
- **Model:** `gpt-4o-mini` — fast and cheap for short interactions
- **System prompt:** Loaded once per request. Includes:
  - Role + tone instructions
  - Full category list (id, name_pt) fetched fresh from Supabase on each request (small table, no caching needed for MVP)
  - Full bairros list (id, name) fetched fresh from Supabase on each request
  - Instruction to call `collect_field` when a value is extracted with confidence
- **Tool definition:**
  ```typescript
  {
    type: "function",
    function: {
      name: "collect_field",
      description: "Call this when you have extracted a field value with confidence.",
      parameters: {
        type: "object",
        properties: {
          field: {
            type: "string",
            enum: ["name","slug","category_ids","description_pt","whatsapp","service_area_ids","working_hours"]
            // home_bairro_id is NOT in the enum — it is derived server-side as service_area_ids[0]
          },
          value: {}
        },
        required: ["field", "value"]
      }
    }
  }
  ```
  The system prompt must explicitly state: `"For working_hours, call collect_field with a JSON object as value using only these keys: mon, tue, wed, thu, fri, sat, sun. Example: {\"mon\":\"8h-18h\",\"fri\":\"8h-18h\"}. Never return a plain string for working_hours."` After applying tool calls server-side, validate `working_hours` before accepting it as collected:
  ```typescript
  const VALID_DAYS = new Set(["mon","tue","wed","thu","fri","sat","sun"]);
  function isValidWorkingHours(v: unknown): v is Record<string, string> {
    if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
    const keys = Object.keys(v);
    return keys.length > 0 && keys.every(k => VALID_DAYS.has(k));
  }
  ```
  If validation fails, do not update `collectedData.working_hours` and let the LLM ask again.
- **Tool call loop:** After the first completion, if `finish_reason === "tool_calls"`, the route handler:
  1. Extracts all tool calls from `response.choices[0].message.tool_calls`
  2. Parses each `collect_field` call and applies to `collectedData`
  3. After applying `service_area_ids`, immediately sets `collectedData.home_bairro_id = collectedData.service_area_ids[0]`
  4. Appends the assistant message + synthetic tool results (`{ role: "tool", tool_call_id, content: "ok" }`) to `messages`
  5. Makes a second OpenAI call with `tool_choice: "none"` to get the next conversational response (text only)
- **State:** Conversation history + `CollectedData` + `failingField?` passed in every request body. `retryCount` is client-only state, never sent. No server-side session.
- **Auth:** Route handler calls `createClient()` and `supabase.auth.getUser()`. Returns HTTP 401 JSON `{ error: "Unauthorized" }` if no valid session.
- **Max duration:** Route handler exports `export const maxDuration = 30;` to handle slow network conditions on Brazilian mobile connections.

---

## Request / Response Contract

**POST `/api/onboarding/chat`**

Request body:
```typescript
{
  messages: { role: "user" | "assistant", content: string }[];
  collectedData: CollectedData;
  failingField?: string;   // retryCount is client-only state, never sent
}
```

Response (200 OK, JSON):
```typescript
{
  message: string;         // LLM's next question or confirmation
  collectedData: CollectedData;  // Updated after any tool calls
  complete: boolean;       // true when all required fields are present
}
```

Error response (401 / 500):
```typescript
{ error: string }
```

**Required fields for `complete: true`:** `name`, `slug`, `category_ids` (length ≥ 1), `description_pt`, `whatsapp`, `service_area_ids` (length ≥ 1), `working_hours` (non-empty object — not a string). `home_bairro_id` is auto-set from `service_area_ids[0]` so it will always be present when `service_area_ids` is non-empty.

---

## Return-to-Step Mechanism

When the user clicks **"Quero corrigir algo"** on the preview card:

1. Client hides `ProfilePreviewCard`, shows chat again
2. Client appends a user message: `"Quero corrigir algo"` to its local message history
3. Client sends the full history + current `collectedData` to the route handler (with `complete: false` implied — route handler does not auto-complete when this message is present)
4. The LLM (instructed in system prompt to detect correction intent) responds: `"Claro! O que você gostaria de corrigir?"` and then re-asks the relevant step's question when the user specifies
5. When the user provides a new value, `collect_field` overwrites that field in `collectedData`
6. When all required fields are present again, the route handler returns `complete: true` and the preview card re-renders

No client-side step index needed — the LLM navigates re-entry using conversation history.

---

## FormData Serialization

`ProfilePreviewCard` is a Client Component (it holds React state from the chat). It calls `createOwnProvider` by importing it from the `"use server"` actions file and calling it from a `<form action={...}>` element, which is the standard App Router pattern for Client Components invoking Server Actions. The `collectedDataToFormData` helper is defined in the same file (not exported):

```typescript
type CollectedData = {
  name?: string;
  slug?: string;
  category_ids?: string[];
  description_pt?: string;
  whatsapp?: string;
  service_area_ids?: string[];
  home_bairro_id?: string;
  working_hours?: Record<string, string>; // e.g. { mon: "8h-18h" }
};

function collectedDataToFormData(data: CollectedData): FormData {
  const fd = new FormData();
  if (data.name)            fd.set("name", data.name);
  if (data.slug)            fd.set("slug", data.slug);
  if (data.description_pt)  fd.set("description_pt", data.description_pt);
  if (data.whatsapp)        fd.set("whatsapp", data.whatsapp);
  if (data.home_bairro_id)  fd.set("home_bairro_id", data.home_bairro_id);
  (data.category_ids ?? []).forEach(id => fd.append("category_ids", id));
  (data.service_area_ids ?? []).forEach(id => fd.append("service_area_ids", id));
  // photo_urls intentionally omitted — photos added post-creation on /account/edit
  const days = ["mon","tue","wed","thu","fri","sat","sun"] as const;
  for (const day of days) {
    const val = data.working_hours?.[day];
    if (val) fd.set(`hours_${day}`, val);
  }
  return fd;
}
```

The `ProfilePreviewCard` "Publicar meu perfil" button submits a hidden `<form>` with a `<input type="hidden">` for each field, or uses `startTransition(() => createOwnProvider(collectedDataToFormData(data)))` from a click handler — both are valid App Router patterns. Use the `startTransition` approach (simpler, no hidden inputs needed).

---

## Profile Preview Card

Shown after step 6, before submission. All display text is hardcoded Brazilian Portuguese (no locale prop — this flow is pt-BR only). Renders the listing as it will appear to consumers:

- Provider name (large, prominent)
- Category pills (same style as public catalog)
- Description text
- Service areas as bairro chips
- Working hours formatted naturally ("Seg–Sex 8h–18h")
- WhatsApp button (disabled, just visual)
- Placeholder photo slot

Two actions:
- **"Publicar meu perfil"** → `startTransition(() => createOwnProvider(collectedDataToFormData(collectedData)))` → redirects to `/account` on success. On error (e.g. slug conflict, DB failure), `createOwnProvider` returns `{ error: string }` instead of redirecting. `ProfilePreviewCard` handles this by showing an inline error banner above the "Publicar" button: `"Erro ao publicar: {error}. Tente novamente."` The button re-enables so the user can retry.
- **"Quero corrigir algo"** → returns to chat (see Return-to-Step Mechanism above)

**Known limitation:** All conversation state lives in React component state. If the user refreshes the page mid-conversation, all progress is lost. The user must start over. This is acceptable for MVP — the full flow takes under 2 minutes.

---

## Photo Upload

Handled as a separate step after profile creation, on the `/account/edit` page (already exists). The preview card shows a placeholder. After publishing, the user is nudged: "Adicione fotos para destacar seu perfil →".

Rationale: photos require file upload, which breaks the conversational flow. Separating them keeps the onboarding to under 2 minutes.

---

## Files

| File | Action |
|---|---|
| `src/app/[locale]/account/create/page.tsx` | Modify — swap `ProviderForm` for `OnboardingChat` |
| `src/app/[locale]/account/create/OnboardingChat.tsx` | Create — chat UI component |
| `src/app/[locale]/account/create/ProfilePreviewCard.tsx` | Create — read-only listing preview + `collectedDataToFormData` helper |
| `src/app/api/onboarding/chat/route.ts` | Create — Route Handler for LLM orchestration |

---

## Data Flow

```
User sends message
    → POST /api/onboarding/chat
        body: { messages, collectedData, failingField? }  ← retryCount is client-only, not sent
        ← supabase.auth.getUser() → 401 if unauthenticated
        → fetch categories + bairros from Supabase (fresh per request)
        → build system prompt (role + tone + category list + bairro list)
        → if failingField: prepend extra system instruction for simpler follow-up
        → openai.chat.completions.create({ model: "gpt-4o-mini", messages, tools: [collect_field], tool_choice: "auto" })
        → if finish_reason === "tool_calls":
              extract tool calls → apply to collectedData
              append assistant message + tool results to messages
              openai.chat.completions.create({ ..., tool_choice: "none" })  ← get next question
        → check if all required fields present → set complete: true/false
        → return { message, collectedData, complete }
    ← OnboardingChat receives JSON response
    ← appends assistant message to local history
    ← updates local collectedData state
    ← if complete: renders ProfilePreviewCard
    → User confirms → createOwnProvider(collectedDataToFormData(collectedData)) → redirect /account
```

---

## What Does Not Change

- Admin form (`/admin/providers/new`, `/admin/providers/[id]/edit`) — unchanged
- `createOwnProvider` Server Action — unchanged
- Database schema — unchanged
- `ProviderForm` component — unchanged (still used by admin)

---

## Testing

Manual verification (no unit tests for LLM behavior):

1. Full happy path on mobile viewport — completes in under 2 minutes
2. Ambiguous category input ("faço de tudo em casa") — LLM asks clarifying question
3. Invalid WhatsApp format — LLM asks again with guidance; after 2nd failure, simpler fallback prompt triggered via `failingField`
4. "Quero corrigir algo" — returns to chat, LLM asks what to fix, accepts new value, re-shows preview with updated data
5. Final submission — `collectedDataToFormData` serializes correctly; listing appears in `/account` and public catalog
6. Unauthenticated request to `/api/onboarding/chat` — returns 401

---

## Acceptance Criteria

- [ ] Provider can complete registration without seeing a single traditional form field
- [ ] LLM correctly maps free-text responses to database categories and bairros
- [ ] Preview card matches how the listing appears in the public catalog
- [ ] Submission reuses existing `createOwnProvider` action without modification
- [ ] Full flow completes in under 2 minutes on mobile
- [ ] Unauthenticated requests to `/api/onboarding/chat` return 401
