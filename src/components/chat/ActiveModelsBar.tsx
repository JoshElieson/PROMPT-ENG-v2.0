import { useMemo } from "react";
import { ModelLogo } from "@/components/models/ModelLogo";
import { useRoundTable } from "@/context/RoundTableContext";
import { getModelById } from "@/data/ai-models";

export function ActiveModelsBar() {
  const { activeIds } = useRoundTable();

  const models = useMemo(
    () =>
      activeIds
        .map((id) => getModelById(id))
        .filter((m) => m != null),
    [activeIds],
  );

  if (models.length === 0) return null;

  return (
    <section className="shrink-0 border-b border-border-subtle bg-background px-6 py-2.5">
      <div className="mx-auto flex max-w-2xl flex-wrap justify-center gap-1.5">
        {models.map((model) => (
          <span
            key={model.id}
            className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-panel/50 px-2.5 py-0.5 text-[11px] text-foreground/90"
          >
            <ModelLogo orgId={model.orgId} size="xs" />
            {model.name}
          </span>
        ))}
      </div>
    </section>
  );
}
