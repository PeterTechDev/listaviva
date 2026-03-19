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
| `OnboardingChat` component | Chat UI with streaming, message history, field progress |
| `/api/onboarding/chat` route handler | LLM orchestration, field extraction via tool calling, conversation state |
| `ProfilePreviewCard` component | Read-only preview of the listing as consumers will see it |
| `/account/create` page | Swaps `ProviderForm` for `OnboardingChat` |

The existing `createOwnProvider` Server Action is reused without changes for final submission.

---

## Conversation Flow

Six steps in sequence. The LLM uses a `collect_field` tool to signal when a field is extracted with confidence. The server accumulates fields and transitions to the next step automatically.

| Step | Question | Fields collected | Notes |
|---|---|---|---|
| 1 | "Olá! Vou te ajudar a criar seu perfil em 2 minutos. Qual é o nome do seu negócio ou seu nome?" | `name`, `slug` | Slug auto-generated from name |
| 2 | "Que tipo de serviço você oferece?" | `category_ids` | LLM maps free text to existing categories. Confirms if ambiguous: "Encontrei *Diarista* — correto?" |
| 3 | "Me conta um pouco mais sobre o seu trabalho. Pode ser bem simples." | `description_pt` | LLM uses response verbatim or lightly cleaned |
| 4 | "Qual é o seu WhatsApp?" | `whatsapp` | LLM validates Brazilian format (+55 DDD number) |
| 5 | "Quais bairros de Linhares você atende?" | `service_area_ids` | LLM maps free text to bairros list. Handles "centro todo", "qualquer bairro" |
| 6 | "Qual é sua disponibilidade? Ex: segunda a sexta, das 8h às 18h" | `working_hours` | LLM converts natural language to `{mon: "8h-18h", ...}` format |

After step 6: transition to ProfilePreviewCard.

**Error handling:** If the LLM cannot extract a field with confidence after 2 attempts, it asks a simpler fallback question ("Pode me passar só o número com DDD?").

**Tone:** Warm, informal, Brazilian Portuguese. "Oi", "Pode ser bem simples", "Ficou ótimo!". Never formal or bureaucratic.

---

## LLM Configuration

- **Model:** `anthropic/claude-haiku-4-5-20251001` via AI Gateway — fast and cheap for short interactions
- **System prompt:** Includes the full list of available categories (id + name_pt) and bairros (id + name) so the LLM can map responses to database IDs without extra lookups
- **Tool:** `collect_field(field: string, value: unknown)` — called by LLM when a field is extracted with confidence. Server accumulates these into a `CollectedData` object
- **State:** Conversation history + `CollectedData` passed on every request. No server-side session needed

---

## Profile Preview Card

Shown after step 6, before submission. Renders the listing as it will appear to consumers:

- Provider name (large, prominent)
- Category pills (same style as public catalog)
- Description text
- Service areas as bairro chips
- Working hours formatted naturally ("Seg–Sex 8h–18h")
- WhatsApp button (disabled, just visual)
- Placeholder photo slot

Two actions:
- **"Publicar meu perfil"** → calls `createOwnProvider` Server Action → redirects to `/account`
- **"Quero corrigir algo"** → returns to chat, replays from the relevant step (not from start)

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
| `src/app/[locale]/account/create/ProfilePreviewCard.tsx` | Create — read-only listing preview |
| `src/app/api/onboarding/chat/route.ts` | Create — Route Handler for LLM orchestration |

---

## Data Flow

```
User message
    → POST /api/onboarding/chat
        → LLM (with system prompt + categories + bairros + history)
        → LLM calls collect_field tool → server updates CollectedData
        → LLM returns next question (streamed)
    → OnboardingChat renders streamed response
    → When CollectedData is complete → server signals "done"
    → OnboardingChat shows ProfilePreviewCard
    → User confirms → createOwnProvider(collectedData) → redirect /account
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
3. Invalid WhatsApp format — LLM asks again with guidance
4. "Quero corrigir algo" — returns to correct step, not start
5. Final submission — listing appears correctly in `/account` and public catalog

---

## Acceptance Criteria

- [ ] Provider can complete registration without seeing a single traditional form field
- [ ] LLM correctly maps free-text responses to database categories and bairros
- [ ] Preview card matches how the listing appears in the public catalog
- [ ] Submission reuses existing `createOwnProvider` action without modification
- [ ] Full flow completes in under 2 minutes on mobile
