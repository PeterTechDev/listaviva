import { getCurrentUser } from "@/lib/auth";
import { HeaderClient } from "./header-client";

export async function Header() {
  const user = await getCurrentUser();
  return (
    <HeaderClient
      initialRole={user?.role ?? null}
      avatarUrl={user?.avatar_url ?? null}
      fullName={user?.full_name ?? null}
    />
  );
}
