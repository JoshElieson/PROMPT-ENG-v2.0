import { invoke } from "@tauri-apps/api/core";
import type { AuthSession } from "@/types/auth";
import { normalizeAuthSession } from "@/lib/auth-session";
import { isTauri } from "@/lib/tauri";

const SCOPES = "openid email profile";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = import.meta.env.DEV
  ? "/api/google-oauth/token"
  : "https://oauth2.googleapis.com/token";
const USERINFO_URL = import.meta.env.DEV
  ? "/api/google/oauth2/v2/userinfo"
  : "https://www.googleapis.com/oauth2/v2/userinfo";

const PKCE_STORAGE_KEY = "prompt:google-oauth-pkce:v1";
const DEV_CALLBACK_PATH = "/oauth/google/callback";

const VERIFIER_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

export function getGoogleClientId(): string | undefined {
  const id = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  return id?.trim() || undefined;
}

export function getGoogleClientSecret(): string | undefined {
  const secret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
  return secret?.trim() || undefined;
}

export function isGoogleAuthConfigured(): boolean {
  return Boolean(getGoogleClientId());
}

function randomVerifier(length = 64): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => VERIFIER_CHARS[b % VERIFIER_CHARS.length]).join(
    "",
  );
}

function randomState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  const bytes = new Uint8Array(digest);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function getDevRedirectUri(): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:1420";
  return `${origin}${DEV_CALLBACK_PATH}`;
}

export function buildGoogleAuthUrl(
  clientId: string,
  redirectUri: string,
  codeChallenge: string,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function startGoogleOAuthBrowser(): Promise<void> {
  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new Error(
      "Google sign-in is not configured. Set VITE_GOOGLE_CLIENT_ID in your .env file.",
    );
  }

  const codeVerifier = randomVerifier();
  const codeChallenge = await sha256Base64Url(codeVerifier);
  const state = randomState();
  const redirectUri = getDevRedirectUri();

  sessionStorage.setItem(
    PKCE_STORAGE_KEY,
    JSON.stringify({ codeVerifier, state, redirectUri }),
  );

  window.location.assign(
    buildGoogleAuthUrl(clientId, redirectUri, codeChallenge, state),
  );
}

export async function completeGoogleOAuthBrowser(
  code: string,
  returnedState: string,
): Promise<AuthSession> {
  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new Error("Google client ID is not configured.");
  }

  const raw = sessionStorage.getItem(PKCE_STORAGE_KEY);
  sessionStorage.removeItem(PKCE_STORAGE_KEY);
  if (!raw) {
    throw new Error("Missing sign-in state. Start sign-in again.");
  }

  const pending = JSON.parse(raw) as {
    codeVerifier: string;
    state: string;
    redirectUri: string;
  };

  if (returnedState !== pending.state) {
    throw new Error("Google sign-in state mismatch. Please try again.");
  }

  const tokenBody: Record<string, string> = {
    client_id: clientId,
    code,
    code_verifier: pending.codeVerifier,
    grant_type: "authorization_code",
    redirect_uri: pending.redirectUri,
  };
  const clientSecret = getGoogleClientSecret();
  if (clientSecret) {
    tokenBody.client_secret = clientSecret;
  }

  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(tokenBody).toString(),
  });

  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(
      tokenData.error_description ??
        tokenData.error ??
        "Google token exchange failed",
    );
  }

  const userRes = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!userRes.ok) {
    throw new Error("Could not load your Google profile.");
  }

  const profile = (await userRes.json()) as {
    id?: string;
    email?: string;
    verified_email?: boolean;
    name?: string;
    picture?: string;
  };

  const email = profile.email ?? null;
  const login =
    email && email.includes("@") ? email.split("@")[0] : (profile.id ?? "user");

  return normalizeAuthSession({
    accessToken: tokenData.access_token,
    provider: "google",
    loginAt: Date.now(),
    user: {
      id: profile.id ? Number.parseInt(profile.id, 10) || 0 : 0,
      login,
      name: profile.name ?? null,
      avatar_url: profile.picture ?? "",
      email,
    },
  });
}

export async function completeGoogleLogin(
  signal?: AbortSignal,
): Promise<AuthSession> {
  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new Error(
      "Google sign-in is not configured. Set VITE_GOOGLE_CLIENT_ID in your .env file.",
    );
  }

  if (signal?.aborted) {
    throw new Error("Sign-in cancelled");
  }

  if (isTauri()) {
    const raw = await invoke<unknown>("google_complete_oauth", {
      clientId,
      clientSecret: getGoogleClientSecret() ?? null,
    });
    if (signal?.aborted) {
      throw new Error("Sign-in cancelled");
    }
    return normalizeAuthSession(raw);
  }

  await startGoogleOAuthBrowser();
  throw new Error("Redirecting to Google…");
}
