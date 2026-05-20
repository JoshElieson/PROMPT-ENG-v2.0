import { useMemo } from "react";
import { LayoutMenu } from "@/components/layout/LayoutMenu";
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

  return (
    <section className="flex shrink-0 items-center gap-2 border-b border-border-subtle bg-background px-2 py-2">
      <span className="mx-auto flex min-w-0 flex-1 flex-wrap justify-center gap-1.5 px-2">
        {models.map((model) => (
          <span
            key={model.id}
            className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-panel/50 px-2.5 py-0.5 text-[11px] text-foreground/90"
          >
            <ModelLogo orgId={model.orgId} size="xs" />
            {model.name}
          </span>
        ))}
      </span>
      <LayoutMenu />
    </section>
  );
}
