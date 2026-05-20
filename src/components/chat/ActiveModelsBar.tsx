import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { LayoutMenu } from "@/components/layout/LayoutMenu";
import { ModelLogo } from "@/components/models/ModelLogo";
import { useRoundTable } from "@/contexts/RoundTableContext";
import { getModelById, type AiModel } from "@/data/ai-models";
import {
  WORKSPACE_HEADER_SURFACE,
  workspaceHeaderRowClass,
} from "@/lib/workspace-header";
import { cn } from "@/lib/utils";

const CHIP_GAP_PX = 6;
const ELLIPSIS_RESERVE_PX = 28;

function ModelChip({ model }: { model: AiModel }) {
  return (
    <span
      data-model-chip
      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] text-foreground/90"
    >
      <ModelLogo orgId={model.orgId} size="xs" />
      {model.name}
    </span>
  );
}

function countVisibleChips(containerWidth: number, chipWidths: number[]): number {
  if (chipWidths.length === 0) return 0;

  let used = 0;
  let count = 0;

  for (let i = 0; i < chipWidths.length; i++) {
    const gap = count > 0 ? CHIP_GAP_PX : 0;
    const remaining = chipWidths.length - i - 1;
    const reserve = remaining > 0 ? ELLIPSIS_RESERVE_PX : 0;

    if (count > 0 && used + gap + chipWidths[i]! + reserve > containerWidth) {
      break;
    }

    if (count === 0 && chipWidths[i]! + reserve > containerWidth) {
      count = 1;
      break;
    }

    used += gap + chipWidths[i]!;
    count++;
  }

  return count;
}

export function ActiveModelsBar() {
  const { activeIds } = useRoundTable();
  const measureRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLSpanElement>(null);
  const [visibleCount, setVisibleCount] = useState(0);

  const models = useMemo(
    () =>
      activeIds
        .map((id) => getModelById(id))
        .filter((m): m is AiModel => m != null),
    [activeIds],
  );

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const update = () => {
      const chipEls = measure.querySelectorAll<HTMLElement>("[data-model-chip]");
      const widths = Array.from(chipEls).map((el) => el.offsetWidth);
      setVisibleCount(countVisibleChips(container.clientWidth, widths));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, [models]);

  const hiddenCount = Math.max(0, models.length - visibleCount);
  const visibleModels = models.slice(0, visibleCount);

  return (
    <section
      className={workspaceHeaderRowClass(
        true,
        cn(WORKSPACE_HEADER_SURFACE, "w-full gap-2 px-2"),
      )}
    >
      <span
        ref={containerRef}
        className={cn(
          "relative flex h-7 min-w-0 flex-1 items-center justify-center overflow-hidden",
          "rounded-lg border border-border-subtle bg-panel/50 px-2",
        )}
      >
        <span
          ref={measureRef}
          aria-hidden
          className="pointer-events-none invisible absolute inset-0 flex items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap"
        >
          {models.map((model) => (
            <ModelChip key={model.id} model={model} />
          ))}
        </span>

        <span className="flex min-w-0 items-center justify-center gap-1.5 overflow-hidden">
          {visibleModels.map((model) => (
            <ModelChip key={model.id} model={model} />
          ))}
          {hiddenCount > 0 && (
            <span
              className="shrink-0 text-[11px] font-medium text-muted-foreground"
              title={`${hiddenCount} more model${hiddenCount === 1 ? "" : "s"} active`}
            >
              …
            </span>
          )}
        </span>
      </span>

      <LayoutMenu />
    </section>
  );
}
