import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { loadLayoutPx, loadLayoutSizes, saveLayoutPx, saveLayoutSizes } from "@/lib/layout-storage";
import { cn } from "@/lib/utils";

export interface ResizablePanelConfig {
  id: string;
  content: ReactNode;
  minSize?: number;
}

interface ResizablePanelsProps {
  direction: "vertical" | "horizontal";
  panels: ResizablePanelConfig[];
  defaultSizes: number[];
  storageKey?: string;
  className?: string;
}

function normalizeSizes(sizes: number[]): number[] {
  const sum = sizes.reduce((a, b) => a + b, 0);
  if (sum <= 0) return sizes.map(() => 1 / sizes.length);
  return sizes.map((s) => s / sum);
}

export function ResizablePanels({
  direction,
  panels,
  defaultSizes,
  storageKey,
  className,
}: ResizablePanelsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sizes, setSizes] = useState<number[]>(() =>
    normalizeSizes(loadLayoutSizes(storageKey ?? "", defaultSizes)),
  );
  const dragRef = useRef<{
    index: number;
    startPos: number;
    startSizes: number[];
    containerSize: number;
  } | null>(null);

  const isVertical = direction === "vertical";

  useEffect(() => {
    if (storageKey) saveLayoutSizes(storageKey, sizes);
  }, [sizes, storageKey]);

  const onPointerDown = useCallback(
    (index: number, event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      dragRef.current = {
        index,
        startPos: isVertical ? event.clientY : event.clientX,
        startSizes: [...sizes],
        containerSize: isVertical ? rect.height : rect.width,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [isVertical, sizes],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.containerSize <= 0) return;

      const deltaPx =
        (isVertical ? event.clientY : event.clientX) - drag.startPos;
      const deltaRatio = deltaPx / drag.containerSize;

      const next = [...drag.startSizes];
      next[drag.index] += deltaRatio;
      next[drag.index + 1] -= deltaRatio;

      const minRatio = (panel: ResizablePanelConfig) =>
        (panel.minSize ?? 48) / drag.containerSize;

      next[drag.index] = Math.max(next[drag.index], minRatio(panels[drag.index]));
      next[drag.index + 1] = Math.max(
        next[drag.index + 1],
        minRatio(panels[drag.index + 1]),
      );

      setSizes(normalizeSizes(next));
    },
    [isVertical, panels],
  );

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex min-h-0 min-w-0 flex-1",
        isVertical ? "flex-col" : "flex-row",
        className,
      )}
    >
      {panels.map((panel, index) => (
        <section key={panel.id} className="contents">
          <section
            className={cn(
              "flex min-h-0 min-w-0 flex-col overflow-hidden",
              isVertical ? "w-full" : "h-full",
            )}
            style={{ flex: `${sizes[index]} 1 0%` }}
          >
            {panel.content}
          </section>
          {index < panels.length - 1 && (
            <div
              role="separator"
              aria-orientation={isVertical ? "horizontal" : "vertical"}
              aria-label="Resize panel"
              onPointerDown={(e) => onPointerDown(index, e)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className={cn(
                "group z-10 shrink-0 touch-none select-none",
                isVertical
                  ? "flex h-1.5 w-full cursor-row-resize items-center justify-center"
                  : "flex h-full w-1.5 cursor-col-resize items-center justify-center",
              )}
            >
              <span
                className={cn(
                  "bg-border transition-colors group-hover:bg-muted-foreground/40 group-active:bg-foreground",
                  isVertical ? "h-0.5 w-8" : "h-8 w-0.5",
                )}
              />
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

interface ResizableSidebarProps {
  side: "left" | "right";
  defaultWidth: number;
  minWidth?: number;
  maxWidth?: number;
  storageKey: string;
  children: ReactNode;
  className?: string;
}

export function ResizableSidebar({
  side,
  defaultWidth,
  minWidth = 180,
  maxWidth = 480,
  storageKey,
  children,
  className,
}: ResizableSidebarProps) {
  const [width, setWidth] = useState(() => loadLayoutPx(storageKey, defaultWidth));
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    saveLayoutPx(storageKey, width);
  }, [width, storageKey]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragRef.current = { startX: event.clientX, startWidth: width };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const delta = event.clientX - drag.startX;
    const next =
      side === "left" ? drag.startWidth + delta : drag.startWidth - delta;
    setWidth(Math.min(maxWidth, Math.max(minWidth, next)));
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
  };

  return (
    <aside
      className={cn(
        "relative flex shrink-0 flex-col border-border-subtle bg-panel",
        side === "left" ? "border-r" : "border-l",
        className,
      )}
      style={{ width }}
    >
      {children}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={cn(
          "absolute top-0 z-20 flex h-full w-1.5 cursor-col-resize items-center justify-center touch-none select-none",
          side === "left" ? "-right-0.5" : "-left-0.5",
        )}
      >
        <span className="h-10 w-0.5 bg-border transition-colors hover:bg-muted-foreground/40 active:bg-muted-foreground/60" />
      </div>
    </aside>
  );
}
