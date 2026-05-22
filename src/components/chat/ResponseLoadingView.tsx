import { RoundTableDiscussion } from "@/components/chat/RoundTableDiscussion";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import type { AiToolActivityEvent } from "@/lib/ai-chat";
import type { ResponseLoadingState } from "@/types/chat";

interface ResponseLoadingViewProps {
  loading: ResponseLoadingState;
  activities: AiToolActivityEvent[];
  fullWidth?: boolean;
}

export function ResponseLoadingView({
  loading,
  activities,
  fullWidth = false,
}: ResponseLoadingViewProps) {
  return (
    <article className="flex w-full flex-col items-start gap-2">
      <section
        className={fullWidth ? "w-full space-y-3 py-1 pr-2" : "w-full max-w-2xl space-y-3 py-1 pr-2"}
      >
        <RoundTableDiscussion
          modelIds={loading.targetModelIds}
          speakingModelIndex={loading.speakingModelIndex}
          phase={loading.phase}
        />
        {activities.length > 0 && (
          <div className="border-border/60 bg-panel/25 space-y-1 rounded-lg border px-3 py-2">
            {activities.map((activity, index) => (
              <div
                key={`${activity.streamId}-${activity.path}-${index}`}
                className="text-muted-foreground/90 font-mono text-xs leading-relaxed"
              >
                {activity.action === "read"
                  ? `Reading "${activity.path}"`
                  : `Editing "${activity.path}"`}
                {activity.action === "write" &&
                  typeof activity.added === "number" &&
                  typeof activity.removed === "number" && (
                    <span className="ml-2 inline-flex items-center gap-2 text-[11px]">
                      <span className="text-emerald-400/90">+{activity.added}</span>
                      <span className="text-rose-400/90">-{activity.removed}</span>
                    </span>
                  )}
              </div>
            ))}
          </div>
        )}
        <div className="border-border-subtle flex items-center gap-2 border-t pt-2">
          <TypingIndicator />
        </div>
      </section>
    </article>
  );
}
