import { useEffect, useState } from "react";

const DEFAULT_SLOW_THRESHOLD_MS = 30_000;

/**
 * True after `thresholdMs` with no change to `activityStamp`.
 * Resets whenever the agent emits new activity.
 */
export function useSlowOperationNotice(
  activityStamp: number | undefined,
  thresholdMs: number = DEFAULT_SLOW_THRESHOLD_MS,
) {
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    setIsSlow(false);
    const timer = window.setTimeout(() => setIsSlow(true), thresholdMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [activityStamp, thresholdMs]);

  return isSlow;
}
