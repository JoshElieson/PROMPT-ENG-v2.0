import { ModelLogo } from "@/components/models/ModelLogo";
import { getModelById } from "@/data/ai-models";
import type { ResponseLoadingPhase } from "@/types/chat";
import { cn } from "@/lib/utils";

interface RoundTableDiscussionProps {
  modelIds: string[];
  speakingModelIndex: number;
  phase: ResponseLoadingPhase;
}

export function RoundTableDiscussion({
  modelIds,
  speakingModelIndex,
  phase,
}: RoundTableDiscussionProps) {
  const models = modelIds
    .map((id) => getModelById(id))
    .filter((m) => m != null);

  if (models.length === 0) return null;

  const isSynthesizing = phase === "synthesizing";

  return (
    <section className="space-y-2">
      <p className="text-muted text-[11px]">
        {isSynthesizing
          ? "Synthesizing a combined answer…"
          : models.length === 1
            ? `${models[0].name} is thinking…`
            : "Round Table — models are discussing"}
      </p>

      {models.length > 1 && (
        <div className="flex flex-wrap items-center gap-1">
          {models.map((model, index) => {
            const isSpeaking =
              !isSynthesizing && index === speakingModelIndex;
            const isPast =
              !isSynthesizing && speakingModelIndex > index;

            return (
              <span key={model.id} className="flex items-center gap-1">
                {index > 0 && (
                  <span
                    className={cn(
                      "text-[10px] text-muted transition-opacity",
                      isPast || isSpeaking ? "opacity-100" : "opacity-30",
                    )}
                    aria-hidden
                  >
                    →
                  </span>
                )}
                <span
                  className={cn(
                    "inline-flex items-center gap-1 border px-2 py-1 text-[10px] transition-all",
                    isSpeaking &&
                      "border-[#6366f1]/30 bg-[#6366f1]/12 text-foreground",
                    isPast && "border-border-subtle opacity-60",
                    !isSpeaking &&
                      !isPast &&
                      !isSynthesizing &&
                      "border-border-subtle opacity-40",
                    isSynthesizing && "border-border-subtle opacity-50",
                  )}
                >
                  <ModelLogo
                    orgId={model.orgId}
                    size="xs"
                    muted={!isSpeaking}
                  />
                  <span className="max-w-[5rem] truncate">{model.name}</span>
                  {isSpeaking && (
                    <span className="bg-accent-bright h-1.5 w-1.5 shrink-0 animate-pulse rounded-full" />
                  )}
                </span>
              </span>
            );
          })}
        </div>
      )}
    </section>
  );
}
