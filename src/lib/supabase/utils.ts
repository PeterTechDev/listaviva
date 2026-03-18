/**
 * Safely casts a Supabase JSON column to Record<string, string>.
 * Returns {} if the value is null, an array, or a non-object primitive.
 */
export function parseWorkingHours(raw: unknown): Record<string, string> {
  if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, string>;
  }
  return {};
}

/**
 * Builds a WhatsApp deep link from a phone number string.
 * Returns null if the number is missing or contains fewer than 7 digits
 * (guards against "N/A", "-", empty strings stored in the DB).
 */
export function buildWhatsAppHref(
  whatsapp: string | null | undefined
): string | null {
  if (!whatsapp) return null;
  const digits = whatsapp.replace(/\D/g, "");
  if (digits.length < 7) return null;
  return `https://wa.me/${digits}`;
}
