import { load, type Store } from "@tauri-apps/plugin-store";
import { loadApiUsage } from "@/lib/storage";
import {
  emptyApiUsageSnapshot,
  type ApiUsageSnapshot,
} from "@/lib/token-usage";
import { isTauri } from "@/lib/tauri";
import type { AuthProvider } from "@/types/auth";
import type { UserPlan } from "@/types/user-plan";

const LOCAL_PREFIX = "prompt:user-usage:v2:";
const STORE_FILE = "usage.v1.json";
const STORE_USERS_KEY = "users";

export interface UserUsageRecord {
  plan: UserPlan;
  /** UTC month bucket, e.g. `2026-06`. */
  periodKey: string;
  usage: ApiUsageSnapshot;
  updatedAt: number;
}

type UserUsageStore = Record<string, UserUsageRecord>;

let storePromise: Promise<Store> | null = null;

function getStore(): Promise<Store> {
  storePromise ??= load(STORE_FILE, { defaults: {}, autoSave: false });
  return storePromise;
}

export function userAccountKey(provider: AuthProvider, userId: number): string {
  return `${provider}:${userId}`;
}

export function currentUsagePeriodKey(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function localStorageKey(accountKey: string): string {
  return `${LOCAL_PREFIX}${accountKey}`;
}

function parseUserPlan(value: unknown): UserPlan {
  return value === "premium" ? "premium" : "free";
}

function parseUsageSnapshot(value: unknown): ApiUsageSnapshot {
  if (!value || typeof value !== "object") return emptyApiUsageSnapshot();
  const record = value as Record<string, unknown>;
  const totalsRaw = record.totals;
  const byModelRaw = record.byModel;
  const totals =
    totalsRaw && typeof totalsRaw === "object"
      ? {
          tokens:
            typeof (totalsRaw as Record<string, unknown>).tokens === "number"
              ? Math.max(0, (totalsRaw as Record<string, unknown>).tokens as number)
              : 0,
          costUsd:
            typeof (totalsRaw as Record<string, unknown>).costUsd === "number"
              ? Math.max(0, (totalsRaw as Record<string, unknown>).costUsd as number)
              : 0,
        }
      : { tokens: 0, costUsd: 0 };

  const byModel: ApiUsageSnapshot["byModel"] = {};
  if (byModelRaw && typeof byModelRaw === "object") {
    for (const [modelId, entry] of Object.entries(byModelRaw)) {
      if (!entry || typeof entry !== "object") continue;
      const row = entry as Record<string, unknown>;
      byModel[modelId] = {
        inputTokens:
          typeof row.inputTokens === "number"
            ? Math.max(0, row.inputTokens)
            : 0,
        outputTokens:
          typeof row.outputTokens === "number"
            ? Math.max(0, row.outputTokens)
            : 0,
        costUsd:
          typeof row.costUsd === "number" ? Math.max(0, row.costUsd) : 0,
      };
    }
  }

  return { totals, byModel };
}

function normalizeUserUsageRecord(raw: unknown): UserUsageRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const periodKey =
    typeof record.periodKey === "string" && /^\d{4}-\d{2}$/.test(record.periodKey)
      ? record.periodKey
      : currentUsagePeriodKey();
  return {
    plan: parseUserPlan(record.plan),
    periodKey,
    usage: parseUsageSnapshot(record.usage),
    updatedAt:
      typeof record.updatedAt === "number" && Number.isFinite(record.updatedAt)
        ? record.updatedAt
        : Date.now(),
  };
}

function createDefaultRecord(
  plan: UserPlan = "free",
  usage: ApiUsageSnapshot = emptyApiUsageSnapshot(),
): UserUsageRecord {
  return {
    plan,
    periodKey: currentUsagePeriodKey(),
    usage,
    updatedAt: Date.now(),
  };
}

function rollPeriodIfNeeded(record: UserUsageRecord): UserUsageRecord {
  const periodKey = currentUsagePeriodKey();
  if (record.periodKey === periodKey) return record;
  return {
    ...record,
    periodKey,
    usage: emptyApiUsageSnapshot(),
    updatedAt: Date.now(),
  };
}

function readLocalRecord(accountKey: string): UserUsageRecord | null {
  try {
    const raw = localStorage.getItem(localStorageKey(accountKey));
    if (!raw) return null;
    return normalizeUserUsageRecord(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeLocalRecord(accountKey: string, record: UserUsageRecord): void {
  try {
    localStorage.setItem(localStorageKey(accountKey), JSON.stringify(record));
  } catch {
    // localStorage may be unavailable
  }
}

async function readStoreUsers(): Promise<UserUsageStore> {
  if (!isTauri()) return {};
  try {
    const store = await getStore();
    const raw = await store.get(STORE_USERS_KEY);
    if (!raw || typeof raw !== "object") return {};
    const out: UserUsageStore = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      const normalized = normalizeUserUsageRecord(value);
      if (normalized) out[key] = normalized;
    }
    return out;
  } catch {
    return {};
  }
}

async function writeStoreUsers(users: UserUsageStore): Promise<void> {
  if (!isTauri()) return;
  try {
    const store = await getStore();
    await store.set(STORE_USERS_KEY, users);
    await store.save();
  } catch {
    // Disk store is optional; local cache already has the record.
  }
}

function migrateLegacyUsageIfEmpty(record: UserUsageRecord): UserUsageRecord {
  if (record.usage.totals.tokens > 0) return record;
  const legacy = loadApiUsage();
  if (legacy.totals.tokens <= 0) return record;
  return {
    ...record,
    usage: legacy,
    updatedAt: Date.now(),
  };
}

export async function loadUserUsageRecord(
  accountKey: string,
): Promise<UserUsageRecord> {
  let record: UserUsageRecord | null = null;

  if (isTauri()) {
    const users = await readStoreUsers();
    record = users[accountKey] ?? null;
    if (record) writeLocalRecord(accountKey, record);
  }

  record ??= readLocalRecord(accountKey);
  const base = rollPeriodIfNeeded(
    record ?? createDefaultRecord("free", emptyApiUsageSnapshot()),
  );
  const migrated = migrateLegacyUsageIfEmpty(base);
  writeLocalRecord(accountKey, migrated);
  if (isTauri()) {
    const users = await readStoreUsers();
    users[accountKey] = migrated;
    await writeStoreUsers(users);
  }
  return migrated;
}

export async function saveUserUsageRecord(
  accountKey: string,
  record: UserUsageRecord,
): Promise<UserUsageRecord> {
  const next = rollPeriodIfNeeded({
    ...record,
    updatedAt: Date.now(),
  });
  writeLocalRecord(accountKey, next);
  if (isTauri()) {
    const users = await readStoreUsers();
    users[accountKey] = next;
    await writeStoreUsers(users);
  }
  return next;
}

export async function setUserPlan(
  accountKey: string,
  plan: UserPlan,
): Promise<UserUsageRecord> {
  const current = await loadUserUsageRecord(accountKey);
  return saveUserUsageRecord(accountKey, { ...current, plan });
}

export function nextUsagePeriodResetDate(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

export function formatUsagePeriodResetDate(date = new Date()): string {
  return nextUsagePeriodResetDate(date).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
