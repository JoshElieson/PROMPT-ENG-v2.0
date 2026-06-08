import type { AuthSession } from "@/types/auth";

export function githubTokenFromSession(
  session: AuthSession | null | undefined,
): string | null {
  if (!session || session.provider !== "github") return null;
  const token = session.accessToken.trim();
  return token || null;
}
