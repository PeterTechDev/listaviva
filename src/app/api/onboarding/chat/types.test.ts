import { describe, it, expect } from "vitest";
import {
  VALID_DAYS,
  isValidWorkingHours,
  isOnboardingComplete,
  collectedDataToFormData,
  type CollectedData,
} from "./types";

describe("VALID_DAYS", () => {
  it("contains all seven days", () => {
    expect(VALID_DAYS.has("mon")).toBe(true);
    expect(VALID_DAYS.has("tue")).toBe(true);
    expect(VALID_DAYS.has("wed")).toBe(true);
    expect(VALID_DAYS.has("thu")).toBe(true);
    expect(VALID_DAYS.has("fri")).toBe(true);
    expect(VALID_DAYS.has("sat")).toBe(true);
    expect(VALID_DAYS.has("sun")).toBe(true);
    expect(VALID_DAYS.size).toBe(7);
  });
});

describe("isValidWorkingHours", () => {
  it("accepts valid working hours object with multiple days", () => {
    expect(isValidWorkingHours({ mon: "8h-18h", fri: "8h-12h" })).toBe(true);
  });

  it("accepts valid working hours with all days", () => {
    expect(
      isValidWorkingHours({
        mon: "8h-18h",
        tue: "8h-18h",
        wed: "8h-18h",
        thu: "8h-18h",
        fri: "8h-18h",
        sat: "9h-14h",
        sun: "10h-14h",
      })
    ).toBe(true);
  });

  it("accepts valid working hours with single day", () => {
    expect(isValidWorkingHours({ mon: "8h-18h" })).toBe(true);
  });

  it("rejects plain string", () => {
    expect(isValidWorkingHours("8h-18h")).toBe(false);
  });

  it("rejects null", () => {
    expect(isValidWorkingHours(null)).toBe(false);
  });

  it("rejects undefined", () => {
    expect(isValidWorkingHours(undefined)).toBe(false);
  });

  it("rejects array", () => {
    expect(isValidWorkingHours(["mon", "8h-18h"])).toBe(false);
  });

  it("rejects empty object", () => {
    expect(isValidWorkingHours({})).toBe(false);
  });

  it("rejects non-canonical key like 'segunda'", () => {
    expect(isValidWorkingHours({ segunda: "8h-18h" })).toBe(false);
  });

  it("rejects mix of valid and invalid keys", () => {
    expect(isValidWorkingHours({ mon: "8h-18h", segunda: "8h-18h" })).toBe(
      false
    );
  });

  it("rejects object with invalid day name", () => {
    expect(isValidWorkingHours({ invalid: "8h-18h" })).toBe(false);
  });

  it("rejects object where value is not a string", () => {
    expect(isValidWorkingHours({ mon: 123 })).toBe(false);
  });
});

describe("isOnboardingComplete", () => {
  const completeData: CollectedData = {
    name: "Test Business",
    slug: "test-business",
    category_ids: ["cat1"],
    description_pt: "Uma descrição",
    whatsapp: "11999999999",
    service_area_ids: ["area1"],
    working_hours: { mon: "8h-18h", fri: "8h-12h" },
  };

  it("returns true for complete object with all required fields", () => {
    expect(isOnboardingComplete(completeData)).toBe(true);
  });

  it("returns true when home_bairro_id is included but not required", () => {
    expect(
      isOnboardingComplete({
        ...completeData,
        home_bairro_id: "bairro123",
      })
    ).toBe(true);
  });

  it("returns false when name is missing", () => {
    const { name, ...data } = completeData;
    expect(isOnboardingComplete(data)).toBe(false);
  });

  it("returns false when name is empty string", () => {
    expect(isOnboardingComplete({ ...completeData, name: "" })).toBe(false);
  });

  it("returns false when slug is missing", () => {
    const { slug, ...data } = completeData;
    expect(isOnboardingComplete(data)).toBe(false);
  });

  it("returns false when slug is empty string", () => {
    expect(isOnboardingComplete({ ...completeData, slug: "" })).toBe(false);
  });

  it("returns false when category_ids is missing", () => {
    const { category_ids, ...data } = completeData;
    expect(isOnboardingComplete(data)).toBe(false);
  });

  it("returns false when category_ids is empty array", () => {
    expect(isOnboardingComplete({ ...completeData, category_ids: [] })).toBe(
      false
    );
  });

  it("returns false when description_pt is missing", () => {
    const { description_pt, ...data } = completeData;
    expect(isOnboardingComplete(data)).toBe(false);
  });

  it("returns false when description_pt is empty string", () => {
    expect(
      isOnboardingComplete({ ...completeData, description_pt: "" })
    ).toBe(false);
  });

  it("returns false when whatsapp is missing", () => {
    const { whatsapp, ...data } = completeData;
    expect(isOnboardingComplete(data)).toBe(false);
  });

  it("returns false when whatsapp is empty string", () => {
    expect(isOnboardingComplete({ ...completeData, whatsapp: "" })).toBe(false);
  });

  it("returns false when service_area_ids is missing", () => {
    const { service_area_ids, ...data } = completeData;
    expect(isOnboardingComplete(data)).toBe(false);
  });

  it("returns false when service_area_ids is empty array", () => {
    expect(
      isOnboardingComplete({ ...completeData, service_area_ids: [] })
    ).toBe(false);
  });

  it("returns false when working_hours is missing", () => {
    const { working_hours, ...data } = completeData;
    expect(isOnboardingComplete(data)).toBe(false);
  });

  it("returns false when working_hours is a string (LLM mistake)", () => {
    expect(
      isOnboardingComplete({
        ...completeData,
        working_hours: "8h-18h" as any,
      })
    ).toBe(false);
  });

  it("returns false when working_hours is empty object", () => {
    expect(
      isOnboardingComplete({ ...completeData, working_hours: {} })
    ).toBe(false);
  });

  it("returns false when working_hours has invalid keys", () => {
    expect(
      isOnboardingComplete({
        ...completeData,
        working_hours: { segunda: "8h-18h" },
      })
    ).toBe(false);
  });
});

describe("collectedDataToFormData", () => {
  const testData: CollectedData = {
    name: "Test Business",
    slug: "test-business",
    category_ids: ["cat1", "cat2"],
    description_pt: "Uma descrição",
    whatsapp: "11999999999",
    service_area_ids: ["area1", "area2"],
    home_bairro_id: "bairro123",
    working_hours: { mon: "8h-18h", fri: "8h-12h", sun: "10h-14h" },
  };

  it("maps all fields to correct FormData keys", () => {
    const fd = collectedDataToFormData(testData);

    expect(fd.get("name")).toBe("Test Business");
    expect(fd.get("slug")).toBe("test-business");
    expect(fd.get("description_pt")).toBe("Uma descrição");
    expect(fd.get("whatsapp")).toBe("11999999999");
    expect(fd.get("home_bairro_id")).toBe("bairro123");
  });

  it("appends all category_ids", () => {
    const fd = collectedDataToFormData(testData);
    const categoryIds = fd.getAll("category_ids");
    expect(categoryIds).toEqual(["cat1", "cat2"]);
  });

  it("appends all service_area_ids", () => {
    const fd = collectedDataToFormData(testData);
    const serviceAreaIds = fd.getAll("service_area_ids");
    expect(serviceAreaIds).toEqual(["area1", "area2"]);
  });

  it("sets correct hours keys for each day in working_hours", () => {
    const fd = collectedDataToFormData(testData);
    expect(fd.get("hours_mon")).toBe("8h-18h");
    expect(fd.get("hours_fri")).toBe("8h-12h");
    expect(fd.get("hours_sun")).toBe("10h-14h");
  });

  it("does not include hours_sat when not in working_hours", () => {
    const fd = collectedDataToFormData(testData);
    expect(fd.get("hours_sat")).toBeNull();
  });

  it("does not include description_en", () => {
    const fd = collectedDataToFormData(testData);
    expect(fd.has("description_en")).toBe(false);
  });

  it("does not include photo_urls", () => {
    const fd = collectedDataToFormData(testData);
    expect(fd.has("photo_urls")).toBe(false);
  });

  it("handles data with missing optional fields", () => {
    const minimalData: CollectedData = {
      name: "Business",
      slug: "business",
    };
    const fd = collectedDataToFormData(minimalData);

    expect(fd.get("name")).toBe("Business");
    expect(fd.get("slug")).toBe("business");
    expect(fd.getAll("category_ids")).toEqual([]);
    expect(fd.getAll("service_area_ids")).toEqual([]);
  });

  it("handles data with empty working_hours", () => {
    const data: CollectedData = {
      name: "Business",
      slug: "business",
      working_hours: {},
    };
    const fd = collectedDataToFormData(data);

    expect(fd.get("name")).toBe("Business");
    // Should not set any hours_* keys
    expect(fd.get("hours_mon")).toBeNull();
  });

  it("handles all seven days in working_hours", () => {
    const data: CollectedData = {
      name: "Business",
      slug: "business",
      working_hours: {
        mon: "8h-18h",
        tue: "8h-18h",
        wed: "8h-18h",
        thu: "8h-18h",
        fri: "8h-18h",
        sat: "9h-14h",
        sun: "10h-14h",
      },
    };
    const fd = collectedDataToFormData(data);

    expect(fd.get("hours_mon")).toBe("8h-18h");
    expect(fd.get("hours_tue")).toBe("8h-18h");
    expect(fd.get("hours_wed")).toBe("8h-18h");
    expect(fd.get("hours_thu")).toBe("8h-18h");
    expect(fd.get("hours_fri")).toBe("8h-18h");
    expect(fd.get("hours_sat")).toBe("9h-14h");
    expect(fd.get("hours_sun")).toBe("10h-14h");
  });
});
