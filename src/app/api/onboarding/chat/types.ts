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

/**
 * Validates that a value is a valid working hours object.
 * Returns true only if:
 * - v is a non-null object (not array)
 * - has at least one key
 * - every key is in VALID_DAYS
 * - every value is a string
 */
export function isValidWorkingHours(v: unknown): v is Record<string, string> {
  // Must be an object, not null, and not an array
  if (v === null || typeof v !== "object" || Array.isArray(v)) {
    return false;
  }

  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj);

  // Must have at least one key
  if (keys.length === 0) {
    return false;
  }

  // Every key must be in VALID_DAYS and every value must be a string
  return keys.every((key) => VALID_DAYS.has(key) && typeof obj[key] === "string");
}

/**
 * Returns true when ALL of these are present:
 * - data.name (truthy string)
 * - data.slug (truthy string)
 * - data.category_ids has length >= 1
 * - data.description_pt (truthy string)
 * - data.whatsapp (truthy string)
 * - data.service_area_ids has length >= 1
 * - isValidWorkingHours(data.working_hours) is true
 *
 * home_bairro_id is NOT required (it's derived automatically)
 */
export function isOnboardingComplete(data: CollectedData): boolean {
  return (
    typeof data.name === "string" &&
    data.name.length > 0 &&
    typeof data.slug === "string" &&
    data.slug.length > 0 &&
    Array.isArray(data.category_ids) &&
    data.category_ids.length >= 1 &&
    typeof data.description_pt === "string" &&
    data.description_pt.length > 0 &&
    typeof data.whatsapp === "string" &&
    data.whatsapp.length > 0 &&
    Array.isArray(data.service_area_ids) &&
    data.service_area_ids.length >= 1 &&
    isValidWorkingHours(data.working_hours)
  );
}

/**
 * Maps CollectedData to FormData keys that createOwnProvider() expects.
 * Includes:
 * - Single value fields: name, slug, description_pt, whatsapp, home_bairro_id
 * - Array fields: category_ids, service_area_ids (appended)
 * - Working hours: hours_mon, hours_tue, ..., hours_sun (for each day present)
 *
 * Intentionally excludes:
 * - photo_urls
 * - description_en
 */
export function collectedDataToFormData(data: CollectedData): FormData {
  const fd = new FormData();

  // Single value fields
  if (data.name) {
    fd.set("name", data.name);
  }
  if (data.slug) {
    fd.set("slug", data.slug);
  }
  if (data.description_pt) {
    fd.set("description_pt", data.description_pt);
  }
  if (data.whatsapp) {
    fd.set("whatsapp", data.whatsapp);
  }
  if (data.home_bairro_id) {
    fd.set("home_bairro_id", data.home_bairro_id);
  }

  // Array fields
  if (data.category_ids && Array.isArray(data.category_ids)) {
    for (const id of data.category_ids) {
      fd.append("category_ids", id);
    }
  }
  if (data.service_area_ids && Array.isArray(data.service_area_ids)) {
    for (const id of data.service_area_ids) {
      fd.append("service_area_ids", id);
    }
  }

  // Working hours
  if (data.working_hours && typeof data.working_hours === "object") {
    for (const [day, hours] of Object.entries(data.working_hours)) {
      fd.set(`hours_${day}`, hours);
    }
  }

  return fd;
}
