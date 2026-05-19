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
    return invoke<DeviceFlowPending>("github_start_device_flow", {
      clientId,
      scope: SCOPES,
    });
  }

  const data = await postFormBrowser(`${OAUTH_BASE}${DEVICE_CODE_PATH}`, {
    client_id: clientId,
    scope: SCOPES,
  });

  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    expiresIn: Number(data.expires_in) || 900,
    interval: Number(data.interval) || 5,
  };
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

  const deadline = Date.now() + pending.expiresIn * 1000;
  let intervalMs = pending.interval * 1000;

  while (Date.now() < deadline) {
    if (signal?.aborted) {
      throw new Error("Sign-in cancelled");
    }

    await delay(intervalMs);

    if (isTauri()) {
      const result = await invoke<{
        status: "token" | "pending" | "slowDown";
        accessToken?: string;
      }>("github_poll_device_token", {
        clientId,
        deviceCode: pending.deviceCode,
      });

      if (result.status === "token" && result.accessToken) {
        return result.accessToken;
      }
      if (result.status === "slowDown") {
        intervalMs += 5000;
      }
      continue;
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
      continue;
    }
    if (error === "slow_down") {
      intervalMs += 5000;
      continue;
    }
    if (error === "expired_token") {
      throw new Error("The sign-in code expired. Please try again.");
    }
    if (error === "access_denied") {
      throw new Error("GitHub sign-in was denied.");
    }

    throw new Error(data.error_description ?? error ?? "GitHub sign-in failed");
  }

  throw new Error("Sign-in timed out. Please try again.");
}

export async function fetchGitHubUser(accessToken: string): Promise<GitHubUser> {
  if (isTauri()) {
    return invoke<GitHubUser>("github_fetch_user", { accessToken });
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
  return {
    id: data.id,
    login: data.login,
    name: data.name,
    avatar_url: data.avatar_url,
    email: data.email,
  };
}

export async function completeGitHubDeviceLogin(
  pending: DeviceFlowPending,
  signal?: AbortSignal,
): Promise<AuthSession> {
  const accessToken = await pollGitHubDeviceFlow(pending, signal);
  const user = await fetchGitHubUser(accessToken);
  return { accessToken, user, loginAt: Date.now() };
}
