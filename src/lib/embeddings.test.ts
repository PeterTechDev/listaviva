import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted to declare the mock before vi.mock is hoisted
const mockCreate = vi.hoisted(() => vi.fn());

vi.mock("openai", () => {
  return {
    default: class {
      embeddings = { create: mockCreate };
    },
  };
});

import { embedText, buildProviderText } from "@/lib/embeddings";

describe("embedText", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("returns the embedding array on success", async () => {
    const fakeEmbedding = [0.1, 0.2, 0.3];
    mockCreate.mockResolvedValue({ data: [{ embedding: fakeEmbedding }] });

    const result = await embedText("hello world");
    expect(result).toEqual(fakeEmbedding);
  });

  it("slices the input to 8192 chars before calling the API", async () => {
    mockCreate.mockResolvedValue({ data: [{ embedding: [0.1] }] });
    const longText = "a".repeat(10000);

    await embedText(longText);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ input: "a".repeat(8192) })
    );
  });

  it("re-throws when the OpenAI client throws", async () => {
    mockCreate.mockRejectedValue(new Error("API error"));
    await expect(embedText("test")).rejects.toThrow("API error");
  });
});

describe("buildProviderText", () => {
  it("joins name, description, and categories", () => {
    const result = buildProviderText("João Elétrica", "Serviços elétricos", [
      "Elétrica",
      "Instalações",
    ]);
    expect(result).toBe("João Elétrica Serviços elétricos Elétrica Instalações");
  });

  it("skips empty description", () => {
    const result = buildProviderText("João Elétrica", null, ["Elétrica"]);
    expect(result).toBe("João Elétrica Elétrica");
  });

  it("handles no categories", () => {
    const result = buildProviderText("João Elétrica", "desc", []);
    expect(result).toBe("João Elétrica desc");
  });
});
