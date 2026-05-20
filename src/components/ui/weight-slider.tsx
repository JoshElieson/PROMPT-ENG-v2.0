import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface WeightSliderProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
  title?: string;
  "aria-label"?: string;
}

const THUMB_HIDDEN =
  "[&::-webkit-slider-thumb]:h-0 [&::-webkit-slider-thumb]:w-0 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-transparent " +
  "[&::-moz-range-thumb]:h-0 [&::-moz-range-thumb]:w-0 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-transparent";

const SNAP_POINTS = [25, 50, 75, 100] as const;
/** %/ms — crossing a snap band quickly triggers magnetic snap. */
const FAST_DRAG_VELOCITY = 0.22;
const SNAP_FAST = 8;
const SNAP_RELEASE = 5;

function snapWeight(
  value: number,
  threshold: number,
): number {
  let best: number | null = null;
  let bestDist = threshold + 1;
  for (const point of SNAP_POINTS) {
    const dist = Math.abs(value - point);
    if (dist <= threshold && dist < bestDist) {
      bestDist = dist;
      best = point;
    }
  }
  return best ?? value;
}

/** Thin progress-style bar with an invisible range input for dragging. */
export function WeightSlider({
  value,
  onChange,
  disabled = false,
  className,
  title = "Allocate Resources (0-100%)",
  "aria-label": ariaLabel,
}: WeightSliderProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isDragging, setIsDragging] = useState(false);
  const draggingRef = useRef(false);
  const displayRef = useRef(value);
  const lastSampleRef = useRef({ value, time: 0 });
  const pendingRef = useRef<number | null>(null);
  const rafRef = useRef(0);

  displayRef.current = displayValue;

  useEffect(() => {
    if (!draggingRef.current) setDisplayValue(value);
  }, [value]);

  const flushPending = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    if (pendingRef.current != null) {
      onChange(pendingRef.current);
      pendingRef.current = null;
    }
  }, [onChange]);

  const scheduleChange = useCallback(
    (next: number) => {
      pendingRef.current = next;
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        if (pendingRef.current != null) {
          onChange(pendingRef.current);
          pendingRef.current = null;
        }
      });
    },
    [onChange],
  );

  const handleInput = useCallback(
    (raw: number) => {
      const now = performance.now();
      const last = lastSampleRef.current;
      const dt = last.time > 0 ? now - last.time : 0;
      const velocity =
        dt >= 16 ? Math.abs(raw - last.value) / dt : 0;
      lastSampleRef.current = { value: raw, time: now };

      const next =
        velocity >= FAST_DRAG_VELOCITY
          ? snapWeight(raw, SNAP_FAST)
          : raw;

      setDisplayValue(next);
      scheduleChange(next);
    },
    [scheduleChange],
  );

  const endDrag = useCallback(() => {
    draggingRef.current = false;
    setIsDragging(false);
    lastSampleRef.current = { value: 0, time: 0 };

    const snapped = snapWeight(displayRef.current, SNAP_RELEASE);
    if (snapped !== displayRef.current) {
      setDisplayValue(snapped);
      pendingRef.current = snapped;
    }

    flushPending();
  }, [flushPending]);

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  return (
    <div
      title={title}
      className={cn(
        "relative h-1 w-full",
        disabled && "opacity-40",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-full bg-border"
        aria-hidden
      >
        <div
          className={cn(
            "h-full rounded-full bg-accent",
            !isDragging && "transition-[width] duration-150 ease-out",
          )}
          style={{ width: `${displayValue}%` }}
        />
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={displayValue}
        disabled={disabled}
        onInput={(e) => handleInput(Number(e.currentTarget.value))}
        onPointerDown={() => {
          draggingRef.current = true;
          setIsDragging(true);
          lastSampleRef.current = {
            value: displayRef.current,
            time: performance.now(),
          };
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={displayValue}
        className={cn(
          "absolute inset-0 -top-1.5 -bottom-1.5 w-full cursor-pointer appearance-none bg-transparent outline-none",
          "[&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:bg-transparent",
          THUMB_HIDDEN,
          "[&::-moz-range-track]:h-1 [&::-moz-range-track]:bg-transparent",
        )}
      />
    </div>
  );
}
