import type { ImportedModel } from "@/types/imported-model";

const IMPORTED_MODELS_STORAGE_KEY = "prompt:imported-models:v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeImportedModel(raw: unknown): ImportedModel | null {
  if (!isRecord(raw) || typeof raw.id !== "string" || !raw.id.trim()) {
    return null;
  }

  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const provider = typeof raw.provider === "string" ? raw.provider.trim() : "";
  if (!name || !provider) return null;

  const role = typeof raw.role === "string" && raw.role.trim()
    ? raw.role.trim()
    : "Imported";
  const orgId =
    typeof raw.orgId === "string" && raw.orgId.trim()
      ? raw.orgId.trim()
      : "deepseek";
  const color =
    typeof raw.color === "string" && raw.color.trim()
      ? raw.color.trim()
      : "#6366f1";
  const initial =
    typeof raw.initial === "string" && raw.initial.trim()
      ? raw.initial.trim()
      : name.charAt(0).toUpperCase() || "?";
  const endpoint =
    typeof raw.endpoint === "string" && raw.endpoint.trim()
      ? raw.endpoint.trim()
      : undefined;

  return {
    id: raw.id.trim(),
    name,
    orgId,
    provider,
    role,
    color,
    initial,
    importedAt:
      typeof raw.importedAt === "number" && Number.isFinite(raw.importedAt)
        ? raw.importedAt
        : Date.now(),
    ...(endpoint ? { endpoint } : {}),
  };
}

export function readImportedModels(): ImportedModel[] {
  try {
    const raw = localStorage.getItem(IMPORTED_MODELS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => normalizeImportedModel(item))
      .filter((item): item is ImportedModel => item != null)
      .sort((left, right) => right.importedAt - left.importedAt);
  } catch {
    return [];
  }
}

export function writeImportedModels(models: ImportedModel[]): void {
  try {
    localStorage.setItem(IMPORTED_MODELS_STORAGE_KEY, JSON.stringify(models));
  } catch {
    // ignore quota / private mode errors
  }
}

export function parseImportedModelsFromJson(raw: unknown): ImportedModel[] {
  const items = Array.isArray(raw) ? raw : [raw];
  return items
    .map((item) => normalizeImportedModel(item))
    .filter((item): item is ImportedModel => item != null);
}
