import { useMemo } from "react";
import { ExternalLink, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApiUsage } from "@/contexts/ApiUsageContext";
import { useAuth } from "@/contexts/AuthContext";
import { getModelById } from "@/data/ai-models";
import { openExternal } from "@/lib/open-external";
import {
  formatCostUsd,
  formatPlanTokenCount,
  formatTokenCount,
  FREE_PLAN_TOKEN_LIMIT,
  freePlanUsageRatio,
  tokenLimitForPlan,
  totalInputTokens,
  totalOutputTokens,
  type ModelUsageTotals,
} from "@/lib/token-usage";
import { USER_PLAN_LABELS } from "@/types/user-plan";
import { cn } from "@/lib/utils";

interface ModelUsageRow {
  modelId: string;
  name: string;
  provider: string;
  color: string;
  usage: ModelUsageTotals;
}

function SummaryStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-foreground mt-1 text-xl font-semibold tabular-nums tracking-tight">
        {value}
      </p>
      {hint ? (
        <p className="text-muted-foreground/80 mt-0.5 text-[10px]">{hint}</p>
      ) : null}
    </div>
  );
}

function PlanBadge({ plan }: { plan: "free" | "premium" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
        plan === "premium"
          ? "bg-premium-gold/15 text-premium-gold"
          : "bg-panel-elevated text-muted-foreground",
      )}
    >
      {USER_PLAN_LABELS[plan]}
    </span>
  );
}

export function SettingsPlanUsagePanel() {
  const { session } = useAuth();
  const {
    usage,
    plan,
    isSignedIn,
    isAtTokenLimit,
    usagePeriodResetLabel,
    tokenLimitMessage,
  } = useApiUsage();

  const modelRows = useMemo(() => {
    const rows: ModelUsageRow[] = Object.entries(usage.byModel).map(
      ([modelId, modelUsage]) => {
        const model = getModelById(modelId);
        return {
          modelId,
          name: model?.name ?? modelId,
          provider: model?.provider ?? "Unknown",
          color: model?.color ?? "#6366f1",
          usage: modelUsage,
        };
      },
    );
    rows.sort((a, b) => b.usage.inputTokens - a.usage.inputTokens);
    return rows;
  }, [usage.byModel]);

  const sentTokens = totalInputTokens(usage);
  const receivedTokens = totalOutputTokens(usage);
  const usedTokens = usage.totals.tokens;
  const activePlan = plan ?? "free";
  const tokenLimit = tokenLimitForPlan(activePlan);
  const planUsageRatio = freePlanUsageRatio(usedTokens, activePlan);
  const hasUsage = usage.totals.tokens > 0 || modelRows.length > 0;

  if (!isSignedIn) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <section className="border-border-subtle bg-panel/60 rounded-xl border p-6 text-center">
          <p className="text-sm font-medium text-foreground">Sign in to view usage</p>
          <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
            Token usage is tracked per signed-in account. Free accounts receive{" "}
            {formatPlanTokenCount(FREE_PLAN_TOKEN_LIMIT)} tokens each month.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <section
        className="border-border-subtle bg-panel/60 rounded-xl border p-4"
        data-ai-target="settings.plan-usage.summary"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Zap className="text-muted-foreground h-4 w-4" />
              <p className="text-sm font-medium text-foreground">Current plan</p>
              <PlanBadge plan={activePlan} />
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Usage for{" "}
              <span className="text-foreground">
                {session?.user.name ?? session?.user.login}
              </span>{" "}
              is stored securely on this device and resets on{" "}
              {usagePeriodResetLabel}. Costs are estimates based on public API
              pricing.
            </p>
          </div>
        </div>

        {activePlan === "free" ? (
          <div className="mb-4">
            <div className="mb-1.5 flex items-center justify-between gap-3 text-[11px]">
              <span className="text-muted-foreground">Monthly allowance</span>
              <span className="text-foreground tabular-nums">
                {formatPlanTokenCount(usedTokens)}/
                {formatPlanTokenCount(FREE_PLAN_TOKEN_LIMIT)} tokens used
              </span>
            </div>
            <div
              className="bg-panel-elevated/80 h-1 w-full overflow-hidden rounded-full"
              role="progressbar"
              aria-valuenow={Math.round(planUsageRatio * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Free plan token usage: ${formatPlanTokenCount(usedTokens)} of ${formatPlanTokenCount(FREE_PLAN_TOKEN_LIMIT)} tokens used`}
            >
              <div
                className={cn(
                  "h-full rounded-full transition-[width,background-color] duration-300 ease-out",
                  planUsageRatio >= 1
                    ? "bg-amber-500"
                    : planUsageRatio >= 0.9
                      ? "bg-amber-400"
                      : "bg-accent",
                )}
                style={{ width: `${planUsageRatio * 100}%` }}
              />
            </div>
            {isAtTokenLimit && tokenLimitMessage ? (
              <p className="text-amber-500 dark:text-amber-400 mt-2 text-[11px] leading-relaxed">
                {tokenLimitMessage}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground mb-4 text-[11px] leading-relaxed">
            Premium accounts have unlimited tokens. You&apos;ve used{" "}
            {formatPlanTokenCount(usedTokens)} tokens this month.
          </p>
        )}

        <div className="border-border-subtle grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-3">
          <SummaryStat
            label="Tokens sent"
            value={formatTokenCount(sentTokens)}
            hint="Input to models"
          />
          <SummaryStat
            label="Tokens received"
            value={formatTokenCount(receivedTokens)}
            hint="Model output"
          />
          <SummaryStat
            label="Estimated cost"
            value={formatCostUsd(usage.totals.costUsd)}
            hint="All models combined"
          />
        </div>
        {tokenLimit == null ? null : (
          <p className="text-muted-foreground mt-3 text-[10px] leading-relaxed">
            Resets on {usagePeriodResetLabel}.
          </p>
        )}
      </section>

      <section data-ai-target="settings.plan-usage.by-model">
        <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide">
          Usage by model
        </p>
        <div className="border-border-subtle bg-panel/60 overflow-hidden rounded-xl border">
          {modelRows.length > 0 ? (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-border-subtle text-muted-foreground border-b">
                  <th className="px-4 py-2.5 font-medium">Model</th>
                  <th className="px-4 py-2.5 text-right font-medium">Sent</th>
                  <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">
                    Received
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium">Est. cost</th>
                </tr>
              </thead>
              <tbody>
                {modelRows.map((row) => (
                  <tr
                    key={row.modelId}
                    className="border-border-subtle border-b last:border-b-0"
                  >
                    <td className="px-4 py-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold text-white"
                          style={{ backgroundColor: row.color }}
                          aria-hidden
                        >
                          {row.name.charAt(0)}
                        </span>
                        <div className="min-w-0">
                          <p className="text-foreground truncate font-medium">
                            {row.name}
                          </p>
                          <p className="text-muted-foreground truncate">
                            {row.provider}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="text-foreground px-4 py-3 text-right tabular-nums">
                      {formatTokenCount(row.usage.inputTokens)}
                    </td>
                    <td className="text-foreground hidden px-4 py-3 text-right tabular-nums sm:table-cell">
                      {formatTokenCount(row.usage.outputTokens)}
                    </td>
                    <td className="text-foreground px-4 py-3 text-right tabular-nums">
                      {formatCostUsd(row.usage.costUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <p className="text-sm font-medium text-foreground">
                {hasUsage ? "No per-model breakdown yet" : "No usage yet"}
              </p>
              <p className="text-muted-foreground mt-1 max-w-xs text-xs leading-relaxed">
                {hasUsage
                  ? "Send a new message to populate per-model usage."
                  : "Send a message in chat to start tracking token usage per model."}
              </p>
            </div>
          )}
        </div>
        {usage.totals.tokens > 0 && modelRows.length === 0 ? (
          <p
            className={cn(
              "text-muted-foreground mt-2 text-[11px] leading-relaxed",
            )}
          >
            Totals include {formatTokenCount(usage.totals.tokens)} tokens from
            before per-model tracking was enabled. New messages will appear in
            the table above.
          </p>
        ) : null}
      </section>

      {activePlan === "free" ? (
        <section
          className="border-border-subtle bg-panel/60 rounded-xl border p-4"
          data-ai-target="settings.plan-usage.upgrade"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-premium-gold mb-1 text-sm font-semibold">
                Forge Premium
              </p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Unlock unlimited tokens, priority models, and advanced agent
                workflows.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() =>
                void openExternal("https://pe-web-ebon.vercel.app/pricing.html")
              }
            >
              See Pricing Plans
              <ExternalLink className="h-3.5 w-3.5 opacity-70" />
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
