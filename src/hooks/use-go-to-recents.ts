import { useCallback, useState } from "react";
import {
  loadGoToRecents,
  pushGoToRecent,
  saveGoToRecents,
  type GoToRecentKind,
  type GoToRecents,
} from "@/lib/go-to-recents";

interface UseGoToRecentsResult {
  recents: GoToRecents;
  recordRecent: (kind: GoToRecentKind, id: string) => void;
}

/**
 * Tracks recently used agents/models/projects for the Go to… selectors and
 * persists them across sessions via local storage.
 */
export function useGoToRecents(): UseGoToRecentsResult {
  const [recents, setRecents] = useState<GoToRecents>(loadGoToRecents);

  const recordRecent = useCallback((kind: GoToRecentKind, id: string) => {
    setRecents((prev) => {
      const next = pushGoToRecent(prev, kind, id);
      if (next === prev) return prev;
      saveGoToRecents(next);
      return next;
    });
  }, []);

  return { recents, recordRecent };
}
