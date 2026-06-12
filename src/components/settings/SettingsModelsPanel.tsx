import { useMemo, useRef, useState } from "react";
import { Brain, Download, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { useImportedModels } from "@/contexts/ImportedModelsContext";
import { popularAiModels } from "@/data/ai-models";
import { parseImportedModelsFromJson } from "@/lib/imported-models-storage";
import {
  createEmptyImportedModelDraft,
  importedModelFromDraft,
  isImportedModelDraftValid,
  type ImportedModelDraft,
} from "@/types/imported-model";
import { cn } from "@/lib/utils";

const SETTINGS_INPUT_CLASS =
  "border-border-subtle bg-panel-elevated/80 text-foreground placeholder:text-muted-foreground/70 focus:border-[#6366f1]/60 h-9 w-full rounded-md border px-2 text-xs outline-none";

function ImportedModelRow({
  name,
  provider,
  modelId,
  onRemove,
}: {
  name: string;
  provider: string;
  modelId: string;
  onRemove: () => void;
}) {
  return (
    <div
      className="border-border-subtle bg-panel/60 flex items-center gap-3 rounded-xl border px-3 py-2.5"
      data-ai-target={`settings.models.imported.${modelId}`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{name}</p>
        <p className="text-muted-foreground truncate text-xs">
          {provider} · {modelId}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-destructive h-8 w-8 shrink-0"
        onClick={onRemove}
        aria-label={`Remove ${name}`}
        data-ai-target={`settings.models.remove.${modelId}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function ImportModelComposer({
  draft,
  error,
  onChange,
  onImportFile,
  onSave,
  onCancel,
}: {
  draft: ImportedModelDraft;
  error: string | null;
  onChange: (patch: Partial<ImportedModelDraft>) => void;
  onImportFile: (file: File) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div
      className="border-border-subtle bg-panel/60 flex flex-col gap-4 rounded-xl border p-4"
      data-ai-target="settings.models.import-composer"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">Import AI Model</p>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            Add a custom model definition from a JSON file or enter details
            manually.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-muted-foreground hover:bg-panel-elevated/85 hover:text-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors"
          aria-label="Cancel import"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onImportFile(file);
            event.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 px-3 text-xs"
          onClick={() => fileInputRef.current?.click()}
          data-ai-target="settings.models.import-json"
        >
          <Download className="h-3.5 w-3.5" />
          Import JSON
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-[11px] font-medium">
            Model ID
          </span>
          <input
            value={draft.id}
            onChange={(event) => onChange({ id: event.target.value })}
            placeholder="openrouter/my-model"
            className={SETTINGS_INPUT_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-[11px] font-medium">
            Display name
          </span>
          <input
            value={draft.name}
            onChange={(event) => onChange({ name: event.target.value })}
            placeholder="My Custom Model"
            className={SETTINGS_INPUT_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-[11px] font-medium">
            Provider
          </span>
          <input
            value={draft.provider}
            onChange={(event) => onChange({ provider: event.target.value })}
            placeholder="OpenRouter, Ollama, Azure…"
            className={SETTINGS_INPUT_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-[11px] font-medium">
            Role (optional)
          </span>
          <input
            value={draft.role}
            onChange={(event) => onChange({ role: event.target.value })}
            placeholder="Custom endpoint"
            className={SETTINGS_INPUT_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-muted-foreground text-[11px] font-medium">
            Endpoint (optional)
          </span>
          <input
            value={draft.endpoint}
            onChange={(event) => onChange({ endpoint: event.target.value })}
            placeholder="https://openrouter.ai/api/v1"
            className={SETTINGS_INPUT_CLASS}
          />
        </label>
      </div>

      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onSave}
          disabled={!isImportedModelDraftValid(draft)}
          data-ai-target="settings.models.import-save"
        >
          Import model
        </Button>
      </div>
    </div>
  );
}

export function SettingsModelsPanel() {
  const { settings, setSetting } = useAppSettings();
  const { importedModels, importModel, removeImportedModel } =
    useImportedModels();
  const [importOpen, setImportOpen] = useState(false);
  const [draft, setDraft] = useState<ImportedModelDraft>(
    createEmptyImportedModelDraft(),
  );
  const [error, setError] = useState<string | null>(null);

  const modelOptions = useMemo(
    () =>
      [...popularAiModels, ...importedModels].map((model) => ({
        id: model.id,
        label: `${model.name} (${model.provider})`,
      })),
    [importedModels],
  );

  const startImport = () => {
    setDraft(createEmptyImportedModelDraft());
    setError(null);
    setImportOpen(true);
  };

  const cancelImport = () => {
    setImportOpen(false);
    setDraft(createEmptyImportedModelDraft());
    setError(null);
  };

  const saveImport = () => {
    if (!isImportedModelDraftValid(draft)) return;
    const result = importModel(importedModelFromDraft(draft));
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    cancelImport();
  };

  const importFromFile = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const models = parseImportedModelsFromJson(parsed);
      if (models.length === 0) {
        setError("No valid model definitions found in that file.");
        return;
      }

      if (models.length === 1) {
        const [model] = models;
        setDraft({
          id: model.id,
          name: model.name,
          provider: model.provider,
          role: model.role,
          endpoint: model.endpoint ?? "",
        });
        setError(null);
        return;
      }

      let importedCount = 0;
      let lastError: string | null = null;
      for (const model of models) {
        const result = importModel(model);
        if (result.ok) {
          importedCount += 1;
        } else {
          lastError = result.reason;
        }
      }

      if (importedCount > 0) {
        cancelImport();
        return;
      }

      setError(lastError ?? "Could not import models from that file.");
    } catch {
      setError("That file is not valid JSON.");
    }
  };

  if (importOpen) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <ImportModelComposer
          draft={draft}
          error={error}
          onChange={(patch) => {
            setDraft((prev) => ({ ...prev, ...patch }));
            setError(null);
          }}
          onImportFile={(file) => void importFromFile(file)}
          onSave={saveImport}
          onCancel={cancelImport}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <section
        className="border-border-subtle bg-panel/60 rounded-xl border p-4"
        data-ai-target="settings.models.default-model"
      >
        <div className="mb-2 flex items-center gap-2">
          <Brain className="text-muted-foreground h-4 w-4" />
          <p className="text-sm font-medium text-foreground">Default Model</p>
        </div>
        <p className="text-muted-foreground mb-3 text-xs leading-relaxed">
          Choose the model Forge should prefer when AI picks a single model for
          you.
        </p>
        <select
          value={settings.defaultModel}
          onChange={(event) => setSetting("defaultModel", event.target.value)}
          className={cn(SETTINGS_INPUT_CLASS)}
        >
          {modelOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </section>

      <section
        className="border-border-subtle bg-panel/60 rounded-xl border p-4"
        data-ai-target="settings.models.imported"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              Imported Models
            </p>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Bring custom models from OpenRouter, Ollama, Azure OpenAI, or
              other compatible providers.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:bg-panel-elevated/85 hover:text-foreground h-8 shrink-0 gap-1.5 rounded-md px-3 text-sm"
            onClick={startImport}
            data-ai-target="settings.models.import-button"
          >
            <Upload className="h-4 w-4" />
            Import AI Model
          </Button>
        </div>

        {importedModels.length === 0 ? (
          <div className="border-border-subtle/70 bg-panel/40 flex flex-col items-center justify-center rounded-lg border border-dashed px-4 py-10 text-center">
            <p className="text-sm font-medium text-foreground">
              No imported models yet
            </p>
            <p className="text-muted-foreground mt-1 max-w-sm text-xs leading-relaxed">
              Import a JSON definition or enter model details manually to add
              custom endpoints to Forge.
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:bg-panel-elevated/85 hover:text-foreground mt-4 h-8 gap-1.5 rounded-md px-3 text-sm"
              onClick={startImport}
            >
              <Upload className="h-4 w-4" />
              Import AI Model
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {importedModels.map((model) => (
              <ImportedModelRow
                key={model.id}
                name={model.name}
                provider={model.provider}
                modelId={model.id}
                onRemove={() => removeImportedModel(model.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
