export type AuthProvider = "github" | "google";

/** Signed-in user profile (GitHub or Google). */
export interface AuthUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  email: string | null;
}

/** @deprecated Use AuthUser */
export type GitHubUser = AuthUser;

export interface AuthSession {
  accessToken: string;
  user: AuthUser;
  provider: AuthProvider;
  loginAt: number;
}

export interface DeviceFlowPending {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}
