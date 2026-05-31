import { useEffect, useRef, useState } from "react";

const DEFAULT_FADE_MS = 1000;

/**
 * Keeps a rainbow highlight visible while `loading` is true, then fades out
 * for `fadeMs` after loading completes.
 */
export function useAiLoadingHighlight(
  loading: boolean,
  fadeMs: number = DEFAULT_FADE_MS,
) {
  const [fadeActive, setFadeActive] = useState(false);
  const hadLoadingRef = useRef(false);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visible = loading || fadeActive;

  useEffect(() => {
    if (loading) hadLoadingRef.current = true;
  }, [loading]);

  useEffect(() => {
    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }

    if (loading) return;

    if (!hadLoadingRef.current) return;

    setFadeActive(true);
    fadeTimerRef.current = setTimeout(() => {
      setFadeActive(false);
      hadLoadingRef.current = false;
      fadeTimerRef.current = null;
    }, fadeMs);

    return () => {
      if (fadeTimerRef.current) {
        clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }
    };
  }, [loading, fadeMs]);

  return { visible, exiting: fadeActive && !loading };
}
