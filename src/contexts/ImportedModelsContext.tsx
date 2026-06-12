import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { popularAiModels } from "@/data/ai-models";
import {
  readImportedModels,
  writeImportedModels,
} from "@/lib/imported-models-storage";
import type { ImportedModel } from "@/types/imported-model";

interface ImportedModelsContextValue {
  importedModels: ImportedModel[];
  importModel: (model: ImportedModel) => { ok: true } | { ok: false; reason: string };
  removeImportedModel: (id: string) => void;
}

const ImportedModelsContext = createContext<ImportedModelsContextValue | null>(
  null,
);

export function ImportedModelsProvider({ children }: { children: ReactNode }) {
  const [importedModels, setImportedModels] = useState<ImportedModel[]>(() =>
    readImportedModels(),
  );

  useEffect(() => {
    writeImportedModels(importedModels);
  }, [importedModels]);

  const importModel = useCallback(
    (model: ImportedModel): { ok: true } | { ok: false; reason: string } => {
      const normalizedId = model.id.trim().toLowerCase();
      if (!normalizedId) {
        return { ok: false, reason: "Model id is required." };
      }

      if (
        popularAiModels.some(
          (item) => item.id.toLowerCase() === normalizedId,
        )
      ) {
        return { ok: false, reason: "This id matches a built-in Forge model." };
      }

      const duplicate = importedModels.some(
        (item) => item.id.toLowerCase() === normalizedId,
      );
      if (duplicate) {
        return { ok: false, reason: "A model with this id already exists." };
      }

      setImportedModels((prev) => [model, ...prev]);
      return { ok: true };
    },
    [importedModels],
  );

  const removeImportedModel = useCallback((id: string) => {
    setImportedModels((prev) =>
      prev.filter((item) => item.id.toLowerCase() !== id.toLowerCase()),
    );
  }, []);

  const value = useMemo(
    () => ({ importedModels, importModel, removeImportedModel }),
    [importedModels, importModel, removeImportedModel],
  );

  return (
    <ImportedModelsContext.Provider value={value}>
      {children}
    </ImportedModelsContext.Provider>
  );
}

export function useImportedModels(): ImportedModelsContextValue {
  const context = useContext(ImportedModelsContext);
  if (!context) {
    throw new Error(
      "useImportedModels must be used within ImportedModelsProvider",
    );
  }
  return context;
}
