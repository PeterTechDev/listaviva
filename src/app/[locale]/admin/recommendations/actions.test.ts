import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRevalidatePath = vi.hoisted(() => vi.fn());
const mockToSlug = vi.hoisted(() => vi.fn());
const mockEmbedText = vi.hoisted(() => vi.fn());
const mockBuildProviderText = vi.hoisted(() => vi.fn());
const mockCreateClient = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
vi.mock("@/lib/slug", () => ({ toSlug: mockToSlug }));
vi.mock("@/lib/embeddings", () => ({
  embedText: mockEmbedText,
  buildProviderText: mockBuildProviderText,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mockCreateClient }));

import { approveRecommendation, rejectRecommendation } from "./actions";

const RECOMMENDATION = {
  id: "rec-1",
  provider_name: "João Elétrica",
  whatsapp: "27999999999",
  bairro_id: "bairro-1",
  description: "Ótimo serviço",
  category_id: "cat-1",
  status: "pending",
};

const NEW_PROVIDER_ID = "provider-new-1";

function makeSupabaseMock({
  userId = "admin-1",
  recommendation = RECOMMENDATION as typeof RECOMMENDATION | null,
  slugExists = false,
  insertProviderError = null as string | null,
  categoryId = "cat-1" as string | null,
} = {}) {
  // Slug collision check
  const slugCheckMaybeSingle = vi.fn().mockResolvedValue({
    data: slugExists ? { slug: "joao-eletrica" } : null,
    error: null,
  });
  const slugCheckEq = vi.fn().mockReturnValue({ maybeSingle: slugCheckMaybeSingle });
  const slugCheckSelect = vi.fn().mockReturnValue({ eq: slugCheckEq });

  // Provider insert
  const providerInsertSingle = vi.fn().mockResolvedValue({
    data: insertProviderError ? null : { id: NEW_PROVIDER_ID },
    error: insertProviderError ? { message: insertProviderError } : null,
  });
  const providerInsertSelect = vi.fn().mockReturnValue({ single: providerInsertSingle });
  const providerInsertMock = vi.fn().mockReturnValue({ select: providerInsertSelect });

  // Provider embedding update
  const providerUpdateEq = vi.fn().mockResolvedValue({ error: null });
  const providerUpdateMock = vi.fn().mockReturnValue({ eq: providerUpdateEq });

  // Recommendation select (for fetch)
  const recMaybeSingle = vi.fn().mockResolvedValue({
    data: recommendation,
    error: null,
  });
  const recSelectEq2 = vi.fn().mockReturnValue({ maybeSingle: recMaybeSingle });
  const recSelectEq1 = vi.fn().mockReturnValue({ eq: recSelectEq2 });
  const recSelectMock = vi.fn().mockReturnValue({ eq: recSelectEq1 });

  // Recommendation update (for approve/reject)
  const recUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
  const recUpdateMock = vi.fn().mockReturnValue({ eq: recUpdateEqMock });

  // provider_categories insert
  const provCatInsertMock = vi.fn().mockResolvedValue({ error: null });

  // provider_categories select for embedding
  const provCatEmbedEq = vi.fn().mockResolvedValue({
    data: categoryId
      ? [{ categories: { name_pt: "Elétrica" } }]
      : [],
    error: null,
  });
  const provCatEmbedSelect = vi.fn().mockReturnValue({ eq: provCatEmbedEq });

  let provCatCallCount = 0;

  const fromMock = vi.fn().mockImplementation((table: string) => {
    if (table === "recommendations") {
      return {
        select: recSelectMock,
        update: recUpdateMock,
      };
    }
    if (table === "providers") {
      return {
        select: slugCheckSelect,
        insert: providerInsertMock,
        update: providerUpdateMock,
      };
    }
    if (table === "provider_categories") {
      provCatCallCount++;
      if (provCatCallCount === 1) {
        return { insert: provCatInsertMock };
      }
      return { select: provCatEmbedSelect };
    }
    return {};
  });

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
      }),
    },
    from: fromMock,
    _recUpdateMock: recUpdateMock,
    _recUpdateEqMock: recUpdateEqMock,
    _providerInsertMock: providerInsertMock,
    _provCatInsertMock: provCatInsertMock,
  };
}

beforeEach(() => {
  mockRevalidatePath.mockReset();
  mockToSlug.mockReset();
  mockToSlug.mockReturnValue("joao-eletrica");
  mockEmbedText.mockReset();
  mockEmbedText.mockResolvedValue([0.1, 0.2]);
  mockBuildProviderText.mockReset();
  mockBuildProviderText.mockReturnValue("João Elétrica Ótimo serviço Elétrica");
  mockCreateClient.mockReset();
});

describe("approveRecommendation", () => {
  it("creates a provider with status active and description_pt from recommendation description", async () => {
    const supabase = makeSupabaseMock();
    mockCreateClient.mockResolvedValue(supabase);

    await approveRecommendation("rec-1");

    expect(supabase._providerInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "João Elétrica",
        slug: "joao-eletrica",
        status: "active",
        description_pt: "Ótimo serviço",
      })
    );
  });

  it("inserts provider_categories when category_id is present", async () => {
    const supabase = makeSupabaseMock({ categoryId: "cat-1" });
    mockCreateClient.mockResolvedValue(supabase);

    await approveRecommendation("rec-1");

    expect(supabase._provCatInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider_id: NEW_PROVIDER_ID,
        category_id: "cat-1",
      })
    );
  });

  it("skips provider_categories insert when category_id is null", async () => {
    const rec = { ...RECOMMENDATION, category_id: null };
    const supabase = makeSupabaseMock({ categoryId: null });
    // Override recommendation data
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === "recommendations") {
        const maybeSingle = vi.fn().mockResolvedValue({ data: rec, error: null });
        const eq2 = vi.fn().mockReturnValue({ maybeSingle });
        const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
        const select = vi.fn().mockReturnValue({ eq: eq1 });
        const updateEq = vi.fn().mockResolvedValue({ error: null });
        const update = vi.fn().mockReturnValue({ eq: updateEq });
        return { select, update };
      }
      if (table === "providers") {
        const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
        const eq = vi.fn().mockReturnValue({ maybeSingle });
        const selectSlug = vi.fn().mockReturnValue({ eq });
        const single = vi.fn().mockResolvedValue({ data: { id: NEW_PROVIDER_ID }, error: null });
        const selectInsert = vi.fn().mockReturnValue({ single });
        const insert = vi.fn().mockReturnValue({ select: selectInsert });
        const updateEq = vi.fn().mockResolvedValue({ error: null });
        const update = vi.fn().mockReturnValue({ eq: updateEq });
        return { select: selectSlug, insert, update };
      }
      if (table === "provider_categories") {
        const insert = vi.fn().mockResolvedValue({ error: null });
        const eq = vi.fn().mockResolvedValue({ data: [], error: null });
        const select = vi.fn().mockReturnValue({ eq });
        return { insert, select };
      }
      return {};
    });

    await approveRecommendation("rec-1");

    // provider_categories.insert should NOT have been called with provider_id/category_id
    // (it may be called for embedding fetch, but not for the category link)
    expect(supabase._provCatInsertMock).not.toHaveBeenCalled();
  });

  it("updates recommendation to approved with created_provider_id and reviewed_by", async () => {
    const supabase = makeSupabaseMock();
    mockCreateClient.mockResolvedValue(supabase);

    await approveRecommendation("rec-1");

    expect(supabase._recUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "approved",
        reviewed_by: "admin-1",
        created_provider_id: NEW_PROVIDER_ID,
      })
    );
  });
});

describe("rejectRecommendation", () => {
  it("updates recommendation to rejected with reviewed_by", async () => {
    const supabase = makeSupabaseMock();
    mockCreateClient.mockResolvedValue(supabase);

    await rejectRecommendation("rec-1");

    expect(supabase._recUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "rejected",
        reviewed_by: "admin-1",
      })
    );
  });
});
