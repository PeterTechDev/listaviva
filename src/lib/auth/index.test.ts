import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.hoisted(() => vi.fn());
const mockSingle = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: mockSingle }),
      }),
    }),
  }),
}));

// next/navigation's redirect() throws a special error in Next.js internals.
// We replicate that behaviour so tests can assert on it.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { requireAdmin, requireAuth, getCurrentUser } from "./index";

beforeEach(() => {
  vi.clearAllMocks();
});

// ── getCurrentUser ────────────────────────────────────────────────────────────

describe("getCurrentUser", () => {
  it("returns null when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const result = await getCurrentUser();

    expect(result).toBeNull();
  });

  it("returns the profile when authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockSingle.mockResolvedValue({
      data: { id: "user-1", role: "admin", full_name: "Test", avatar_url: null, locale: "pt-BR" },
    });

    const result = await getCurrentUser();

    expect(result).toMatchObject({ id: "user-1", role: "admin" });
  });

  it("returns null when profile fetch fails", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockSingle.mockResolvedValue({ data: null });

    const result = await getCurrentUser();

    expect(result).toBeNull();
  });

  it("returns null and logs when profile fetch returns a db error", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockSingle.mockResolvedValue({
      data: null,
      error: { code: "PGRST301", message: "connection refused" },
    });

    const result = await getCurrentUser();

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[auth]"),
      expect.objectContaining({ code: "PGRST301" })
    );
    consoleSpy.mockRestore();
  });
});

// ── requireAuth ───────────────────────────────────────────────────────────────

describe("requireAuth", () => {
  it("redirects to login when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    await expect(requireAuth("pt-BR")).rejects.toThrow("REDIRECT:/pt-BR/login");
  });

  it("uses the provided locale in the login redirect", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    await expect(requireAuth("en")).rejects.toThrow("REDIRECT:/en/login");
  });

  it("returns the profile when authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockSingle.mockResolvedValue({
      data: { id: "user-1", role: "consumer", full_name: null, avatar_url: null, locale: "pt-BR" },
    });

    const result = await requireAuth("pt-BR");

    expect(result.id).toBe("user-1");
  });
});

// ── requireAdmin ──────────────────────────────────────────────────────────────

describe("requireAdmin", () => {
  it("redirects to login when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    await expect(requireAdmin("pt-BR")).rejects.toThrow("REDIRECT:/pt-BR/login");
  });

  it("redirects to 403 when authenticated but not admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockSingle.mockResolvedValue({
      data: { id: "user-1", role: "consumer", full_name: null, avatar_url: null, locale: "pt-BR" },
    });

    await expect(requireAdmin("pt-BR")).rejects.toThrow("REDIRECT:/pt-BR/403");
  });

  it("uses the provided locale in the 403 redirect", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockSingle.mockResolvedValue({
      data: { id: "user-1", role: "provider", full_name: null, avatar_url: null, locale: "pt-BR" },
    });

    await expect(requireAdmin("en")).rejects.toThrow("REDIRECT:/en/403");
  });

  it("returns the profile when user is admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockSingle.mockResolvedValue({
      data: { id: "user-1", role: "admin", full_name: "Admin User", avatar_url: null, locale: "pt-BR" },
    });

    const result = await requireAdmin("pt-BR");

    expect(result).toMatchObject({ id: "user-1", role: "admin" });
  });
});
