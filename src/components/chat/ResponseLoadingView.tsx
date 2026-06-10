import { useMemo } from "react";
import { RoundTableDiscussion } from "@/components/chat/RoundTableDiscussion";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { AIActivityStream } from "@/components/chat/AIActivityStream";
import { useSlowOperationNotice } from "@/hooks/use-slow-operation-notice";
import {
  buildLiveAgentStatus,
  filterLoadingActivityEvents,
  filterLoadingToolActivities,
  activityStampForSlowNotice,
  summarizeAgentProgress,
} from "@/lib/agent-live-status";
import type { AiToolActivityEvent } from "@/lib/ai-chat";
import type { AgentActivityEvent } from "@/types/agent-activity";
import type { ResponseLoadingState } from "@/types/chat";

interface ResponseLoadingViewProps {
  loading: ResponseLoadingState;
  activities: AiToolActivityEvent[];
  activityEvents: AgentActivityEvent[];
  fullWidth?: boolean;
}

export function ResponseLoadingView({
  loading,
  activities,
  activityEvents,
  fullWidth = false,
}: ResponseLoadingViewProps) {
  const streamEvents = useMemo(
    () => filterLoadingActivityEvents(activityEvents),
    [activityEvents],
  );
  const streamActivities = useMemo(
    () => filterLoadingToolActivities(activities),
    [activities],
  );
  const activityStamp = useMemo(
    () => activityStampForSlowNotice(streamEvents, activities),
    [streamEvents, activities],
  );
  const isTakingLong = useSlowOperationNotice(activityStamp);
  const liveStatus = useMemo(
    () => buildLiveAgentStatus(streamEvents, streamActivities),
    [streamEvents, streamActivities],
  );
  const progressSummary = useMemo(
    () => summarizeAgentProgress(streamEvents),
    [streamEvents],
  );
  const displayEvents = useMemo(() => {
    if (isTakingLong) return streamEvents;
    const latest = streamEvents[streamEvents.length - 1];
    return latest ? [latest] : [];
  }, [isTakingLong, streamEvents]);

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
        {displayEvents.length > 0 ? (
          <AIActivityStream events={displayEvents} expanded={isTakingLong} />
        ) : streamActivities.length > 0 ? (
          <div className="border-border/60 bg-panel/25 space-y-1 rounded-lg border px-3 py-2">
            {(isTakingLong ? streamActivities : streamActivities.slice(-1)).map(
              (activity, index) => (
              <div
                key={`${activity.streamId}-${activity.path}-${index}`}
                className="text-muted-foreground/90 font-mono text-xs leading-relaxed"
              >
                {activity.action === "read"
                  ? `Reading "${activity.path}"`
                  : activity.action === "write"
                    ? `Editing "${activity.path}"`
                    : activity.path}
              </div>
            ),
            )}
          </div>
        ) : null}
        <div className="border-border-subtle space-y-2 border-t pt-2">
          {isTakingLong ? (
            <>
              <p
                className="text-foreground/85 text-xs leading-relaxed"
                aria-live="polite"
              >
                {liveStatus}
              </p>
              {progressSummary ? (
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Still working — {progressSummary}
                </p>
              ) : null}
            </>
          ) : null}
          <TypingIndicator />
        </div>
      </section>
    </article>
  );
}
