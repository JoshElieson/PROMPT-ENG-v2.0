import { getModelCostTier, type ModelCostTier } from "@/lib/token-usage";
import { cn } from "@/lib/utils";

const TIER_LABELS: Record<ModelCostTier, string> = {
  1: "$",
  2: "$$",
  3: "$$$",
};

const TIER_STYLES: Record<ModelCostTier, string> = {
  1: "text-emerald-500",
  2: "text-orange-500",
  3: "text-red-500",
};

const TIER_ARIA: Record<ModelCostTier, string> = {
  1: "Low cost",
  2: "Medium cost",
  3: "High cost",
};

export function ModelCostIndicator({ modelId }: { modelId: string }) {
  const tier = getModelCostTier(modelId);

  return (
    <span
      className={cn(
        "mt-0.5 block text-[10px] font-semibold leading-none tracking-tight",
        TIER_STYLES[tier],
      )}
      aria-label={TIER_ARIA[tier]}
    >
      {TIER_LABELS[tier]}
    </span>
  );
}
