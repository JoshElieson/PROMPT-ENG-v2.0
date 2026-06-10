import type { AiToolActivityEvent } from "@/lib/ai-chat";
import type { AgentActivityEvent } from "@/types/agent-activity";

function basename(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

export function activityStampForSlowNotice(
  events: AgentActivityEvent[],
  activities: AiToolActivityEvent[],
): number | undefined {
  if (events.length === 0 && activities.length === 0) return undefined;
  const lastEventTs = events[events.length - 1]?.timestamp ?? 0;
  return lastEventTs + activities.length;
}

export function filterLoadingActivityEvents(
  events: AgentActivityEvent[],
): AgentActivityEvent[] {
  return events.filter(
    (event) =>
      event.type !== "done" &&
      event.type !== "error" &&
      event.type !== "planning",
  );
}

export function filterLoadingToolActivities(
  activities: AiToolActivityEvent[],
): AiToolActivityEvent[] {
  return activities.filter((activity) => activity.action !== "status");
}

export function buildLiveAgentStatus(
  events: AgentActivityEvent[],
  activities: AiToolActivityEvent[],
): string {
  const meaningful = filterLoadingActivityEvents(events);
  const latest = meaningful[meaningful.length - 1];
  if (latest) {
    if (latest.filePath) {
      return `${latest.message} (${basename(latest.filePath)})`;
    }
    return latest.message;
  }

  const toolActivities = filterLoadingToolActivities(activities);
  if (toolActivities.length > 0) {
    const last = toolActivities[toolActivities.length - 1]!;
    if (last.action === "read") return `Reading ${basename(last.path)}`;
    return `Editing ${basename(last.path)}`;
  }

  return "Waiting on model response…";
}

export function summarizeAgentProgress(
  events: AgentActivityEvent[],
): string | null {
  const meaningful = filterLoadingActivityEvents(events);
  if (meaningful.length === 0) return null;

  let reads = 0;
  let writes = 0;
  for (const event of meaningful) {
    if (event.type === "reading") reads += 1;
    if (event.type === "editing") writes += 1;
  }

  const parts: string[] = [];
  if (reads > 0) parts.push(`${reads} read${reads === 1 ? "" : "s"}`);
  if (writes > 0) parts.push(`${writes} edit${writes === 1 ? "" : "s"}`);
  if (parts.length === 0) return null;
  return parts.join(" · ");
}
