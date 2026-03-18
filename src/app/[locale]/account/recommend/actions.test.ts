import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRedirect = vi.hoisted(() => vi.fn());
const mockCreateClient = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

import { submitRecommendation } from "./actions";

function makeSupabaseMock({
  userId = null as string | null,
  insertError = null as string | null,
} = {}) {
  const insertMock = vi.fn().mockResolvedValue({ error: insertError ? { message: insertError } : null });
  const fromMock = vi.fn().mockReturnValue({ insert: insertMock });
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: userId ? { id: userId } : null } }),
    },
    from: fromMock,
    _insertMock: insertMock,
    _fromMock: fromMock,
  };
}

beforeEach(() => {
  mockRedirect.mockReset();
  mockCreateClient.mockReset();
});

describe("submitRecommendation", () => {
  it("returns error when user is not authenticated", async () => {
    const supabase = makeSupabaseMock({ userId: null });
    mockCreateClient.mockResolvedValue(supabase);

    const formData = new FormData();
    formData.set("provider_name", "Test Provider");

    const result = await submitRecommendation(null, formData);

    expect(result).toEqual({ error: "Not authenticated" });
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("returns error when provider_name is empty", async () => {
    const supabase = makeSupabaseMock({ userId: "user-1" });
    mockCreateClient.mockResolvedValue(supabase);

    const formData = new FormData();
    formData.set("provider_name", "   ");

    const result = await submitRecommendation(null, formData);

    expect(result).toEqual({ error: "Name is required" });
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("inserts recommendation and redirects on valid submission", async () => {
    const supabase = makeSupabaseMock({ userId: "user-1" });
    mockCreateClient.mockResolvedValue(supabase);

    const formData = new FormData();
    formData.set("provider_name", "João Elétrica");
    formData.set("category_id", "cat-uuid");
    formData.set("whatsapp", "27999999999");
    formData.set("bairro_id", "bairro-uuid");
    formData.set("description", "Ótimo serviço");

    await submitRecommendation(null, formData);

    expect(supabase._fromMock).toHaveBeenCalledWith("recommendations");
    expect(supabase._insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        submitted_by: "user-1",
        provider_name: "João Elétrica",
        status: "pending",
      })
    );
    expect(mockRedirect).toHaveBeenCalledWith("/account");
  });

  it("returns error when DB insert fails", async () => {
    const supabase = makeSupabaseMock({ userId: "user-1", insertError: "DB error" });
    mockCreateClient.mockResolvedValue(supabase);

    const formData = new FormData();
    formData.set("provider_name", "João Elétrica");

    const result = await submitRecommendation(null, formData);

    expect(result).toEqual({ error: "DB error" });
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
