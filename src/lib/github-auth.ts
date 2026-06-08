import { invoke } from "@tauri-apps/api/core";
import type { AuthSession, DeviceFlowPending, AuthUser } from "@/types/auth";
import { normalizeAuthSession, normalizeAuthUser } from "@/lib/auth-session";
import { isTauri } from "@/lib/tauri";

const SCOPES = "read:user user:email repo";

const DEVICE_CODE_PATH = "/login/device/code";
const ACCESS_TOKEN_PATH = "/login/oauth/access_token";
const USER_API_PATH = "/user";

/** Dev-only Vite proxies avoid browser CORS when not running inside Tauri. */
const OAUTH_BASE = import.meta.env.DEV ? "/api/github-oauth" : "https://github.com";
const API_BASE = import.meta.env.DEV ? "/api/github" : "https://api.github.com";

export function getGitHubClientId(): string | undefined {
  const id = import.meta.env.VITE_GITHUB_CLIENT_ID;
  return id?.trim() || undefined;
}

export function isGitHubAuthConfigured(): boolean {
  return Boolean(getGitHubClientId());
}

type RawDeviceFlow = DeviceFlowPending & {
  device_code?: string;
  user_code?: string;
  verification_uri?: string;
  expires_in?: number;
};

export function normalizeDeviceFlowPending(raw: RawDeviceFlow): DeviceFlowPending {
  const deviceCode = raw.deviceCode ?? raw.device_code ?? "";
  const userCode = raw.userCode ?? raw.user_code ?? "";
  const verificationUri =
    raw.verificationUri ??
    raw.verification_uri ??
    "https://github.com/login/device";

  if (!deviceCode || !userCode) {
    throw new Error("GitHub returned an incomplete sign-in response. Please try again.");
  }

  return {
    deviceCode,
    userCode,
    verificationUri,
    expiresIn: Number(raw.expiresIn ?? raw.expires_in ?? 900),
    interval: Number(raw.interval ?? 5),
  };
}

async function postFormBrowser(
  url: string,
  body: Record<string, string>,
): Promise<Record<string, string>> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });

  const data = (await res.json()) as Record<string, string>;

  if (data.access_token) {
    return data;
  }

  const oauthError = data.error;
  if (
    oauthError === "authorization_pending" ||
    oauthError === "slow_down" ||
    oauthError === "expired_token" ||
    oauthError === "access_denied"
  ) {
    return data;
  }

  if (!res.ok) {
    throw new Error(data.error_description ?? data.error ?? "GitHub request failed");
  }

  return data;
}

export async function startGitHubDeviceFlow(): Promise<DeviceFlowPending> {
  const clientId = getGitHubClientId();
  if (!clientId) {
    throw new Error(
      "GitHub sign-in is not configured. Set VITE_GITHUB_CLIENT_ID in your .env file.",
    );
  }

  if (isTauri()) {
    const pending = await invoke<RawDeviceFlow>("github_start_device_flow", {
      clientId,
      scope: SCOPES,
    });
    return normalizeDeviceFlowPending(pending);
  }

  const data = await postFormBrowser(`${OAUTH_BASE}${DEVICE_CODE_PATH}`, {
    client_id: clientId,
    scope: SCOPES,
  });

  return normalizeDeviceFlowPending({
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    expiresIn: Number(data.expires_in) || 900,
    interval: Number(data.interval) || 5,
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractAccessTokenFromPoll(
  result: Record<string, unknown>,
): string | undefined {
  if (typeof result.accessToken === "string") return result.accessToken;
  if (typeof result.access_token === "string") return result.access_token;

  for (const key of ["Token", "token"]) {
    const nested = result[key];
    if (nested && typeof nested === "object") {
      const obj = nested as Record<string, unknown>;
      if (typeof obj.accessToken === "string") return obj.accessToken;
      if (typeof obj.access_token === "string") return obj.access_token;
    }
  }

  return undefined;
}

async function pollGitHubDeviceFlowTauri(
  pending: DeviceFlowPending,
  signal?: AbortSignal,
  onAttempt?: (attempt: number) => void,
): Promise<string> {
  const clientId = getGitHubClientId();
  if (!clientId) {
    throw new Error("GitHub client ID is not configured.");
  }

  const pendingWithExpiry = pending as DeviceFlowPending & { expiresAt?: number };
  const deadline =
    pendingWithExpiry.expiresAt ?? Date.now() + pending.expiresIn * 1000;
  let intervalMs = Math.max(pending.interval * 1000, 1000);
  let attempt = 0;

  while (Date.now() < deadline) {
    if (signal?.aborted) {
      throw new Error("Sign-in cancelled");
    }

    attempt += 1;
    onAttempt?.(attempt);

    let result: Record<string, unknown>;
    try {
      result = await invoke<Record<string, unknown>>("github_poll_device_token", {
        clientId,
        deviceCode: pending.deviceCode,
      });
    } catch (e) {
      const wrapped = new Error(
        e instanceof Error ? e.message : "Could not reach GitHub to complete sign-in.",
      );
      Object.assign(wrapped, { cause: e });
      throw wrapped;
    }

    const status = String(result.status ?? "").toLowerCase();
    const token = extractAccessTokenFromPoll(result);
    if (token) return token;

    if (status === "slowdown" || status === "slow_down") {
      intervalMs += 5000;
    } else if (status && status !== "pending") {
      throw new Error(
        typeof result.error === "string"
          ? result.error
          : `GitHub sign-in failed (${status}).`,
      );
    }

    await delay(intervalMs);
  }

  throw new Error("Sign-in timed out. Please try again.");
}

export async function pollGitHubDeviceFlow(
  pending: DeviceFlowPending,
  signal?: AbortSignal,
  onAttempt?: (attempt: number) => void,
): Promise<string> {
  const clientId = getGitHubClientId();
  if (!clientId) {
    throw new Error("GitHub client ID is not configured.");
  }

  if (!pending.deviceCode) {
    throw new Error("Missing device code. Please try signing in again.");
  }

  if (isTauri()) {
    return pollGitHubDeviceFlowTauri(pending, signal, onAttempt);
  }

  const deadline = Date.now() + pending.expiresIn * 1000;
  let intervalMs = pending.interval * 1000;
  let attempt = 0;

  while (Date.now() < deadline) {
    if (signal?.aborted) {
      throw new Error("Sign-in cancelled");
    }

    attempt += 1;
    onAttempt?.(attempt);

    const data = await postFormBrowser(`${OAUTH_BASE}${ACCESS_TOKEN_PATH}`, {
      client_id: clientId,
      device_code: pending.deviceCode,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    });

    if (data.access_token) {
      return data.access_token;
    }

    const error = data.error;
    if (error === "authorization_pending") {
      // fall through to sleep
    } else if (error === "slow_down") {
      intervalMs += 5000;
    } else if (error === "expired_token") {
      throw new Error("The sign-in code expired. Please try again.");
    } else if (error === "access_denied") {
      throw new Error("GitHub sign-in was denied.");
    } else {
      throw new Error(data.error_description ?? error ?? "GitHub sign-in failed");
    }

    await delay(intervalMs);
  }

  throw new Error("Sign-in timed out. Please try again.");
}

export async function fetchGitHubUser(accessToken: string): Promise<AuthUser> {
  if (isTauri()) {
    const user = await invoke<AuthUser & { avatarUrl?: string }>("github_fetch_user", {
      accessToken,
    });
    return normalizeAuthUser(user);
  }

  const res = await fetch(`${API_BASE}${USER_API_PATH}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "FORGE/2.0",
    },
  });

  if (!res.ok) {
    throw new Error("Could not load your GitHub profile.");
  }

  const data = (await res.json()) as AuthUser;
  return normalizeAuthUser(data);
}

export async function completeGitHubDeviceLogin(
  pending: DeviceFlowPending,
  signal?: AbortSignal,
  onPollAttempt?: (attempt: number) => void,
): Promise<AuthSession> {
  const clientId = getGitHubClientId();
  if (!clientId) {
    throw new Error("GitHub client ID is not configured.");
  }

  if (!pending.deviceCode) {
    throw new Error("Missing device code. Please try signing in again.");
  }

  const accessToken = await pollGitHubDeviceFlow(pending, signal, onPollAttempt);
  const user = await fetchGitHubUser(accessToken);
  return normalizeAuthSession({
    accessToken,
    user,
    provider: "github",
    loginAt: Date.now(),
  });
}
