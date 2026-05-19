export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  email: string | null;
}

export interface AuthSession {
  accessToken: string;
  user: GitHubUser;
  loginAt: number;
}

export interface DeviceFlowPending {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}
