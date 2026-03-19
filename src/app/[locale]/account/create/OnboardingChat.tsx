"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import type { CollectedData, ChatMessage } from "@/app/api/onboarding/chat/types";

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
  correctionField: string | null,
): string {
  if (correctionField) return correctionField;
  for (const field of FIELD_ORDER) {
    const val = data[field];
    if (!val || (Array.isArray(val) && val.length === 0)) return field;
    if (
      field === "working_hours" &&
      (typeof val === "string" || Object.keys(val as object).length === 0)
    )
      return field;
  }
  return "working_hours"; // fallback
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
  const initializedRef = useRef(false);

  // Auto-scroll on new messages or while pending
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isPending]);

  // Initial greeting — fire once, guarded against StrictMode double-fire
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    sendMessage("", {}, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendMessage(
    userText: string,
    currentData: CollectedData,
    isInitial = false,
  ) {
    const newMessages: ChatMessage[] = isInitial
      ? []
      : [...messages, { role: "user" as const, content: userText }];

    if (!isInitial) setMessages(newMessages);
    setError(null);

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

        const newData: CollectedData = data.collectedData;
        const dataChanged =
          JSON.stringify(newData) !== JSON.stringify(currentData);

        if (!dataChanged && !isInitial) {
          setRetryCount((prev) => ({
            ...prev,
            [step]: (prev[step] ?? 0) + 1,
          }));
        } else {
          setRetryCount((prev) => ({ ...prev, [step]: 0 }));
          // Clear correctionField when the field is successfully updated
          if (
            correctionField &&
            newData[correctionField as keyof CollectedData] !==
              currentData[correctionField as keyof CollectedData]
          ) {
            setCorrectionField(null);
          }
        }

        setCollectedData(newData);
        if (data.complete) onComplete(newData);
      } catch {
        setError(
          "Erro de conexão. Verifique sua internet e tente novamente.",
        );
      }
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isPending) return;
    // Detect correction intent
    if (text.toLowerCase().includes("corrig")) {
      setCorrectionField("__pending__");
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

      {/* Input */}
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
