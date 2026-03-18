import { describe, it, expect } from "vitest";
import { parseWorkingHours, buildWhatsAppHref } from "./utils";

describe("parseWorkingHours", () => {
  it("returns valid object as-is", () => {
    const input = { monday: "9h-18h", tuesday: "9h-18h" };
    expect(parseWorkingHours(input)).toEqual(input);
  });

  it("returns {} for null", () => {
    expect(parseWorkingHours(null)).toEqual({});
  });

  it("returns {} for array", () => {
    expect(parseWorkingHours(["9h-18h"])).toEqual({});
  });

  it("returns {} for string", () => {
    expect(parseWorkingHours("closed")).toEqual({});
  });

  it("returns {} for number", () => {
    expect(parseWorkingHours(42)).toEqual({});
  });

  it("returns {} for undefined", () => {
    expect(parseWorkingHours(undefined)).toEqual({});
  });
});

describe("buildWhatsAppHref", () => {
  it("returns href for valid number", () => {
    expect(buildWhatsAppHref("+55 27 99999-9999")).toBe(
      "https://wa.me/5527999999999"
    );
  });

  it("returns href for bare digits", () => {
    expect(buildWhatsAppHref("5527999999999")).toBe(
      "https://wa.me/5527999999999"
    );
  });

  it("returns null for null", () => {
    expect(buildWhatsAppHref(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(buildWhatsAppHref(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(buildWhatsAppHref("")).toBeNull();
  });

  it("returns null for non-digit string like 'N/A'", () => {
    expect(buildWhatsAppHref("N/A")).toBeNull();
  });

  it("returns null for string shorter than 7 digits", () => {
    expect(buildWhatsAppHref("123456")).toBeNull();
  });

  it("strips all non-digit characters", () => {
    expect(buildWhatsAppHref("(27) 9 9999-9999")).toBe(
      "https://wa.me/27999999999"
    );
  });
});
