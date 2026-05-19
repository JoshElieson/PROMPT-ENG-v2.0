import { invoke } from "@tauri-apps/api/core";
import type { AuthSession, DeviceFlowPending, GitHubUser } from "@/types/auth";
import { isTauri } from "@/lib/tauri";

const SCOPES = "read:user user:email";

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

export async function pollGitHubDeviceFlow(
  pending: DeviceFlowPending,
  signal?: AbortSignal,
): Promise<string> {
  const clientId = getGitHubClientId();
  if (!clientId) {
    throw new Error("GitHub client ID is not configured.");
  }

  if (!pending.deviceCode) {
    throw new Error("Missing device code. Please try signing in again.");
  }

  if (isTauri()) {
    return invoke<string>("github_wait_for_device_token", {
      clientId,
      deviceCode: pending.deviceCode,
      intervalSecs: pending.interval,
      expiresInSecs: pending.expiresIn,
    });
  }

  const deadline = Date.now() + pending.expiresIn * 1000;
  let intervalMs = pending.interval * 1000;

  while (Date.now() < deadline) {
    if (signal?.aborted) {
      throw new Error("Sign-in cancelled");
    }

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

function normalizeGitHubUser(raw: GitHubUser & { avatarUrl?: string }): GitHubUser {
  if (!raw?.login) {
    throw new Error("Could not load your GitHub profile.");
  }

  return {
    id: raw.id,
    login: raw.login,
    name: raw.name ?? null,
    avatar_url: raw.avatar_url ?? raw.avatarUrl ?? "",
    email: raw.email ?? null,
  };
}

type RawAuthSession = AuthSession & {
  access_token?: string;
  login_at?: number;
};

export function normalizeAuthSession(raw: RawAuthSession): AuthSession {
  const accessToken = raw.accessToken ?? raw.access_token;
  if (!accessToken) {
    throw new Error("GitHub did not return an access token.");
  }

  return {
    accessToken,
    loginAt: raw.loginAt ?? raw.login_at ?? Date.now(),
    user: normalizeGitHubUser(raw.user),
  };
}

export async function fetchGitHubUser(accessToken: string): Promise<GitHubUser> {
  if (isTauri()) {
    const user = await invoke<GitHubUser & { avatarUrl?: string }>("github_fetch_user", {
      accessToken,
    });
    return normalizeGitHubUser(user);
  }

  const res = await fetch(`${API_BASE}${USER_API_PATH}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!res.ok) {
    throw new Error("Could not load your GitHub profile.");
  }

  const data = (await res.json()) as GitHubUser;
  return normalizeGitHubUser(data);
}

export async function completeGitHubDeviceLogin(
  pending: DeviceFlowPending,
  signal?: AbortSignal,
): Promise<AuthSession> {
  const clientId = getGitHubClientId();
  if (!clientId) {
    throw new Error("GitHub client ID is not configured.");
  }

  if (!pending.deviceCode) {
    throw new Error("Missing device code. Please try signing in again.");
  }

  if (isTauri()) {
    const session = await invoke<RawAuthSession>("github_complete_device_login", {
      clientId,
      deviceCode: pending.deviceCode,
      intervalSecs: pending.interval,
      expiresInSecs: pending.expiresIn,
    });
    return normalizeAuthSession(session);
  }

  const accessToken = await pollGitHubDeviceFlow(pending, signal);
  const user = await fetchGitHubUser(accessToken);
  return { accessToken, user, loginAt: Date.now() };
}
