export interface ImportedModel {
  id: string;
  name: string;
  orgId: string;
  provider: string;
  role: string;
  color: string;
  initial: string;
  importedAt: number;
  endpoint?: string;
}

export interface ImportedModelDraft {
  id: string;
  name: string;
  provider: string;
  role: string;
  endpoint: string;
}

export function createEmptyImportedModelDraft(): ImportedModelDraft {
  return {
    id: "",
    name: "",
    provider: "",
    role: "",
    endpoint: "",
  };
}

export function isImportedModelDraftValid(
  draft: ImportedModelDraft,
): boolean {
  return (
    draft.id.trim().length > 0 &&
    draft.name.trim().length > 0 &&
    draft.provider.trim().length > 0
  );
}

export function importedModelFromDraft(
  draft: ImportedModelDraft,
): ImportedModel {
  const name = draft.name.trim();
  const provider = draft.provider.trim();
  const role = draft.role.trim() || "Imported";
  const endpoint = draft.endpoint.trim();

  return {
    id: draft.id.trim(),
    name,
    orgId: "deepseek",
    provider,
    role,
    color: "#6366f1",
    initial: name.charAt(0).toUpperCase() || "?",
    importedAt: Date.now(),
    ...(endpoint ? { endpoint } : {}),
  };
}
