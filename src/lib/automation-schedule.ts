import type { AutomationDraft } from "@/types/automation";

function parseScheduleTime(time: string): { hour: number; minute: number } {
  const [hourRaw, minuteRaw] = time.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return { hour: 9, minute: 0 };
  }
  return {
    hour: Math.min(23, Math.max(0, hour)),
    minute: Math.min(59, Math.max(0, minute)),
  };
}

export function shouldRunScheduledAutomation(
  automation: AutomationDraft,
  now: Date,
  lastRunAt: number | undefined,
): boolean {
  if (automation.triggerType !== "schedule" || !automation.enabled) return false;
  if (automation.task.trim().length === 0) return false;

  const { hour, minute } = parseScheduleTime(automation.scheduleTime);
  const nowMs = now.getTime();

  if (automation.scheduleFrequency === "custom") {
    const intervalMs = automation.scheduleIntervalMinutes * 60 * 1000;
    if (lastRunAt == null) return false;
    return nowMs - lastRunAt >= intervalMs;
  }

  const recentlyRan =
    lastRunAt != null && nowMs - lastRunAt < 55_000;

  if (automation.scheduleFrequency === "hourly") {
    return now.getMinutes() === 0 && !recentlyRan;
  }

  const timeMatches =
    now.getHours() === hour && now.getMinutes() === minute;
  if (!timeMatches || recentlyRan) return false;

  if (automation.scheduleFrequency === "daily") return true;

  if (automation.scheduleFrequency === "weekdays") {
    const day = now.getDay();
    return day >= 1 && day <= 5;
  }

  if (automation.scheduleFrequency === "weekly") {
    return now.getDay() === automation.scheduleWeekday;
  }

  return false;
}
