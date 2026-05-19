import type { DeviceFlowPending } from "@/types/auth";

const PENDING_KEY = "prompt:github-pending:v1";

export interface StoredPendingAuth extends DeviceFlowPending {
  startedAt: number;
  /** Absolute expiry time (ms). Used for polling deadline. */
  expiresAt: number;
}

export function savePendingGitHubAuth(pending: DeviceFlowPending): void {
  try {
    const startedAt = Date.now();
    const stored: StoredPendingAuth = {
      ...pending,
      startedAt,
      expiresAt: startedAt + pending.expiresIn * 1000,
    };
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(stored));
  } catch {
    // sessionStorage may be unavailable
  }
}

export function loadPendingGitHubAuth(): StoredPendingAuth | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredPendingAuth & {
      device_code?: string;
      user_code?: string;
      verification_uri?: string;
      expires_in?: number;
    };

    const deviceCode = parsed.deviceCode ?? parsed.device_code ?? "";
    const userCode = parsed.userCode ?? parsed.user_code ?? "";
    if (!deviceCode || !userCode) return null;

    const startedAt = parsed.startedAt ?? Date.now();
    const expiresIn = Number(parsed.expiresIn ?? parsed.expires_in ?? 900);
    const expiresAt =
      typeof parsed.expiresAt === "number"
        ? parsed.expiresAt
        : startedAt + expiresIn * 1000;
    if (Date.now() >= expiresAt) {
      clearPendingGitHubAuth();
      return null;
    }

    return {
      deviceCode,
      userCode,
      verificationUri:
        parsed.verificationUri ??
        parsed.verification_uri ??
        "https://github.com/login/device",
      expiresIn,
      interval: Number(parsed.interval ?? 5),
      startedAt,
      expiresAt,
    };
  } catch {
    return null;
  }
}

export function clearPendingGitHubAuth(): void {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // ignore
  }
}
