import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  loadLayoutBool,
  loadLayoutPx,
  loadLayoutSizes,
  saveLayoutBool,
  saveLayoutPx,
  saveLayoutSizes,
} from "@/lib/layout-storage";
import { useLayout } from "@/contexts/LayoutContext";
import { cn } from "@/lib/utils";

/** Narrowest width while dragging; release here snaps closed (VS Code–style). */
const COLLAPSE_THRESHOLD = 120;

export type PanelGutterSnap = "none" | "max" | "collapse";

function resolveSidebarDragWidth(
  next: number,
  minWidth: number,
  maxWidth: number,
): { width: number; snapHighlight: boolean } {
  const clamped = Math.min(maxWidth, next);
  if (clamped >= minWidth) {
    return { width: clamped, snapHighlight: false };
  }
  const width = Math.max(COLLAPSE_THRESHOLD, clamped);
  const snapHighlight = width === COLLAPSE_THRESHOLD;
  return { width, snapHighlight };
}

export interface ResizablePanelConfig {
  id: string;
  content: ReactNode;
  /** Minimum size in pixels along the split axis. */
  minSize?: number;
  /** Maximum size in pixels along the split axis. */
  maxSize?: number;
  /** Minimum share of the container (0–1), combined with `minSize`. */
  minRatio?: number;
  /** Maximum share of the container (0–1), combined with `maxSize`. */
  maxRatio?: number;
  /** Release after snap-highlight at `collapseThreshold` closes the panel. */
  collapsible?: boolean;
  /** Snap width before collapse; defaults to {@link COLLAPSE_THRESHOLD}. */
  collapseThreshold?: number;
}

interface ResizablePanelsProps {
  direction: "vertical" | "horizontal";
  panels: ResizablePanelConfig[];
  defaultSizes: number[];
  storageKey?: string;
  className?: string;
  /** Controlled sizes (flex ratios). When both are set, `storageKey` persistence is disabled. */
  sizes?: number[];
  onSizesChange?: (sizes: number[]) => void;
  /** When false, gutters are not draggable; `sizes` still drive layout when provided. */
  resizable?: boolean;
  /** Called on pointer-up when a collapsible trailing panel was dragged to the snap point. */
  onTrailingPanelCollapse?: () => void;
}

function normalizeSizes(sizes: number[]): number[] {
  const sum = sizes.reduce((a, b) => a + b, 0);
  if (sum <= 0) return sizes.map(() => 1 / sizes.length);
  return sizes.map((s) => s / sum);
}

function panelMinRatio(panel: ResizablePanelConfig, containerSize: number): number {
  const fromPx = (panel.minSize ?? 48) / containerSize;
  return Math.max(panel.minRatio ?? 0, fromPx);
}

function panelMaxRatio(panel: ResizablePanelConfig, containerSize: number): number {
  const fromRatio = panel.maxRatio ?? 1;
  const fromPx =
    panel.maxSize != null ? panel.maxSize / containerSize : fromRatio;
  return Math.min(fromRatio, fromPx);
}

function hasRatioConstraints(panels: ResizablePanelConfig[]): boolean {
  return panels.some((p) => p.minRatio != null || p.maxRatio != null);
}

function secondaryMaxPx(
  containerSize: number,
  primaryPanel: ResizablePanelConfig,
  secondaryPanel: ResizablePanelConfig,
): number {
  return Math.min(
    containerSize * panelMaxRatio(secondaryPanel, containerSize),
    Math.max(
      0,
      containerSize - containerSize * panelMinRatio(primaryPanel, containerSize),
    ),
  );
}

function resolveTwoPanelSecondaryDrag(
  requestedSecondaryPx: number,
  containerSize: number,
  primaryPanel: ResizablePanelConfig,
  secondaryPanel: ResizablePanelConfig,
): { secondaryPx: number; snap: PanelGutterSnap } {
  const maxSecondaryPx = secondaryMaxPx(containerSize, primaryPanel, secondaryPanel);
  const minSecondaryPx = secondaryPanel.minSize ?? 48;
  const effectiveMinSecondaryPx = Math.min(minSecondaryPx, maxSecondaryPx);
  const collapseThreshold = secondaryPanel.collapseThreshold ?? COLLAPSE_THRESHOLD;

  if (requestedSecondaryPx > maxSecondaryPx) {
    return { secondaryPx: maxSecondaryPx, snap: "max" };
  }

  if (secondaryPanel.collapsible && requestedSecondaryPx < effectiveMinSecondaryPx) {
    const secondaryPx = Math.max(collapseThreshold, requestedSecondaryPx);
    return {
      secondaryPx: Math.min(secondaryPx, maxSecondaryPx),
      snap: secondaryPx <= collapseThreshold ? "collapse" : "none",
    };
  }

  const secondaryPx = Math.min(
    Math.max(requestedSecondaryPx, effectiveMinSecondaryPx),
    maxSecondaryPx,
  );
  return { secondaryPx, snap: "none" };
}

function usesSecondaryDragSnap(panels: ResizablePanelConfig[]): boolean {
  return (
    panels.length === 2 &&
    (hasRatioConstraints(panels) || panels[1]?.collapsible === true)
  );
}

/** Keeps flex ratios valid; panel[0] is primary, panel[1] is secondary when length is 2. */
export function enforcePanelConstraints(
  sizes: number[],
  panels: ResizablePanelConfig[],
  containerSize?: number,
): number[] {
  if (sizes.length !== panels.length || panels.length === 0) {
    return normalizeSizes(sizes);
  }

  if (panels.length === 2) {
    const [primaryPanel, secondaryPanel] = panels;

    if (!containerSize || containerSize <= 0) {
      if (!hasRatioConstraints(panels)) {
        return normalizeSizes(sizes);
      }
      let secondary = sizes[1];
      secondary = Math.min(secondary, secondaryPanel.maxRatio ?? 1);
      let primary = 1 - secondary;
      primary = Math.max(primary, primaryPanel.minRatio ?? 0);
      secondary = 1 - primary;
      secondary = Math.min(secondary, secondaryPanel.maxRatio ?? 1);
      return normalizeSizes([primary, secondary]);
    }

    const minSecondaryPx = secondaryPanel.minSize ?? 48;
    const maxSecondaryPx = Math.min(
      containerSize * panelMaxRatio(secondaryPanel, containerSize),
      Math.max(
        0,
        containerSize - containerSize * panelMinRatio(primaryPanel, containerSize),
      ),
    );
    const effectiveMinSecondaryPx = Math.min(minSecondaryPx, maxSecondaryPx);
    let secondaryPx = sizes[1] * containerSize;
    secondaryPx = Math.min(
      Math.max(secondaryPx, effectiveMinSecondaryPx),
      maxSecondaryPx,
    );
    const secondaryRatio = secondaryPx / containerSize;
    return normalizeSizes([1 - secondaryRatio, secondaryRatio]);
  }

  if (!containerSize || containerSize <= 0) {
    return normalizeSizes(sizes);
  }

  const next = [...sizes];
  for (let i = 0; i < panels.length; i++) {
    next[i] = Math.max(next[i], panelMinRatio(panels[i], containerSize));
    next[i] = Math.min(next[i], panelMaxRatio(panels[i], containerSize));
  }
  return normalizeSizes(next);
}

export function ResizablePanels({
  direction,
  panels,
  defaultSizes,
  storageKey,
  className,
  sizes: controlledSizes,
  onSizesChange,
  resizable = true,
  onTrailingPanelCollapse,
}: ResizablePanelsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { layoutResetNonce } = useLayout();
  const [gutterSnap, setGutterSnap] = useState<PanelGutterSnap>("none");
  const isControlled =
    controlledSizes != null &&
    controlledSizes.length === panels.length &&
    (resizable ? onSizesChange != null : true);

  const [uncontrolledSizes, setUncontrolledSizes] = useState<number[]>(() =>
    enforcePanelConstraints(
      normalizeSizes(loadLayoutSizes(storageKey ?? "", defaultSizes)),
      panels,
    ),
  );

  const sizes = isControlled
    ? normalizeSizes(controlledSizes)
    : uncontrolledSizes;

  const applySizes = useCallback(
    (next: number[], containerSize?: number) => {
      const normalized = enforcePanelConstraints(
        normalizeSizes(next),
        panels,
        containerSize,
      );
      if (isControlled) {
        onSizesChange?.(normalized);
      } else {
        setUncontrolledSizes(normalized);
      }
    },
    [isControlled, onSizesChange, panels],
  );
  const dragRef = useRef<{
    index: number;
    startPos: number;
    startSizes: number[];
    containerSize: number;
    releaseSnap: PanelGutterSnap;
  } | null>(null);

  const isVertical = direction === "vertical";

  useEffect(() => {
    if (isControlled || !storageKey) return;
    saveLayoutSizes(storageKey, sizes);
  }, [sizes, storageKey, isControlled]);

  useEffect(() => {
    if (isControlled || layoutResetNonce === 0) return;
    queueMicrotask(() =>
      setUncontrolledSizes(enforcePanelConstraints(normalizeSizes(defaultSizes), panels)),
    );
  }, [layoutResetNonce, defaultSizes, isControlled, panels]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const clampToConstraints = () => {
      const rect = container.getBoundingClientRect();
      const axisSize = isVertical ? rect.height : rect.width;
      if (axisSize <= 0) return;
      const enforced = enforcePanelConstraints(sizes, panels, axisSize);
      if (enforced.some((value, index) => Math.abs(value - sizes[index]) > 0.001)) {
        applySizes(enforced, axisSize);
      }
    };

    clampToConstraints();
    const observer = new ResizeObserver(clampToConstraints);
    observer.observe(container);
    return () => observer.disconnect();
  }, [sizes, panels, isVertical, applySizes]);

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
        releaseSnap: "none",
      };
      setGutterSnap("none");
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

      if (
        drag.index === 0 &&
        panels.length === 2 &&
        usesSecondaryDragSnap(panels)
      ) {
        const requestedSecondaryPx = next[1] * drag.containerSize;
        const { secondaryPx, snap } = resolveTwoPanelSecondaryDrag(
          requestedSecondaryPx,
          drag.containerSize,
          panels[0],
          panels[1],
        );
        const secondaryRatio = secondaryPx / drag.containerSize;
        applySizes([1 - secondaryRatio, secondaryRatio], drag.containerSize);
        drag.releaseSnap = snap;
        setGutterSnap(snap);
        return;
      }

      applySizes(next, drag.containerSize);
      drag.releaseSnap = "none";
      setGutterSnap("none");
    },
    [isVertical, panels, applySizes],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      const releaseSnap = drag?.releaseSnap ?? "none";
      dragRef.current = null;
      setGutterSnap("none");

      if (releaseSnap === "collapse" && panels[1]?.collapsible) {
        onTrailingPanelCollapse?.();
      }

      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        /* already released */
      }
    },
    [onTrailingPanelCollapse, panels],
  );

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
              index === panels.length - 1 &&
                gutterSnap !== "none" &&
                (isVertical ? "border-t border-accent" : "border-l border-accent"),
            )}
            style={{ flex: `${sizes[index]} 1 0%` }}
          >
            {panel.content}
          </section>
          {index < panels.length - 1 &&
            (resizable ? (
              <div
                role="separator"
                aria-orientation={isVertical ? "horizontal" : "vertical"}
                aria-label="Resize panel"
                onPointerDown={(e) => onPointerDown(index, e)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                className={cn(
                  "relative z-10 shrink-0 touch-none select-none",
                  isVertical
                    ? "h-[5px] w-full cursor-row-resize"
                    : "h-full w-[5px] cursor-col-resize",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute transition-colors duration-150",
                    isVertical
                      ? "top-1/2 right-0 left-0 h-px -translate-y-1/2"
                      : "top-0 bottom-0 left-1/2 -translate-x-1/2",
                    gutterSnap !== "none"
                      ? isVertical
                        ? "h-0.5 bg-accent"
                        : "w-0.5 bg-accent"
                      : isVertical
                        ? "h-px bg-border-subtle"
                        : "w-px bg-border-subtle opacity-0 hover:bg-muted-foreground/40 hover:opacity-100 active:bg-muted-foreground/60",
                  )}
                />
              </div>
            ) : (
              <div
                aria-hidden
                className={cn(
                  "pointer-events-none shrink-0 bg-border-subtle",
                  isVertical ? "h-px w-full" : "h-full w-px",
                )}
              />
            ))}
        </section>
      ))}
    </div>
  );
}

interface ResizableSidebarProps {
  defaultWidth: number;
  minWidth?: number;
  maxWidth?: number;
  storageKey: string;
  children: ReactNode;
  className?: string;
}

export function ResizableSidebar({
  defaultWidth,
  minWidth = 180,
  maxWidth = 480,
  storageKey,
  children,
  className,
}: ResizableSidebarProps) {
  const {
    layoutResetNonce,
    registerLeftSidebarExpand,
    registerLeftSidebarToggle,
    notifyLeftSidebarCollapsed,
  } = useLayout();
  const collapsedKey = `${storageKey}:collapsed`;
  const [width, setWidth] = useState(() => loadLayoutPx(storageKey, defaultWidth));
  const [collapsed, setCollapsed] = useState(() =>
    loadLayoutBool(collapsedKey, false),
  );
  const [snapHighlight, setSnapHighlight] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startWidth: number;
    fromCollapsed: boolean;
  } | null>(null);

  useEffect(() => {
    if (!collapsed) saveLayoutPx(storageKey, width);
  }, [width, storageKey, collapsed]);

  useEffect(() => {
    saveLayoutBool(collapsedKey, collapsed);
  }, [collapsed, collapsedKey]);

  useEffect(() => {
    notifyLeftSidebarCollapsed(collapsed);
  }, [collapsed, notifyLeftSidebarCollapsed]);

  useEffect(() => {
    if (layoutResetNonce === 0) return;
    queueMicrotask(() => {
      setWidth(defaultWidth);
      setCollapsed(false);
      setSnapHighlight(false);
    });
  }, [layoutResetNonce, defaultWidth]);

  useEffect(() => {
    const expand = () => {
      setCollapsed(false);
      setWidth((w) => (w < minWidth ? defaultWidth : w));
    };
    const toggle = () => {
      setCollapsed((wasCollapsed) => {
        if (wasCollapsed) {
          setWidth((w) => (w < minWidth ? defaultWidth : w));
          return false;
        }
        return true;
      });
    };
    const unregisterExpand = registerLeftSidebarExpand(expand);
    const unregisterToggle = registerLeftSidebarToggle(toggle);
    return () => {
      unregisterExpand();
      unregisterToggle();
    };
  }, [
    defaultWidth,
    minWidth,
    registerLeftSidebarExpand,
    registerLeftSidebarToggle,
  ]);

  const clampExpanded = useCallback(
    (px: number) => Math.min(maxWidth, Math.max(minWidth, px)),
    [maxWidth, minWidth],
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragRef.current = {
      startX: event.clientX,
      startWidth: collapsed ? 0 : width,
      fromCollapsed: collapsed,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;

    const delta = event.clientX - drag.startX;
    const next = drag.startWidth + delta;

    if (drag.fromCollapsed) {
      setSnapHighlight(false);
      if (next >= COLLAPSE_THRESHOLD) {
        setCollapsed(false);
        setWidth(clampExpanded(next));
      }
      return;
    }

    const { width: resolved, snapHighlight: snap } = resolveSidebarDragWidth(
      next,
      minWidth,
      maxWidth,
    );
    setWidth(resolved);
    setSnapHighlight(snap);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;

    if (drag) {
      const delta = event.clientX - drag.startX;
      const next = drag.startWidth + delta;

      if (drag.fromCollapsed) {
        if (next >= COLLAPSE_THRESHOLD) {
          setCollapsed(false);
          setWidth(clampExpanded(next));
        }
      } else {
        const { width: resolved, snapHighlight: snap } = resolveSidebarDragWidth(
          next,
          minWidth,
          maxWidth,
        );
        if (snap) {
          setCollapsed(true);
        } else {
          setCollapsed(false);
          setWidth(clampExpanded(resolved));
        }
      }
    }

    setSnapHighlight(false);

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
  };

  return (
    <aside
      className={cn(
        "relative flex shrink-0 flex-col bg-panel",
        collapsed && "bg-transparent",
        snapHighlight && "border-r border-accent",
        className,
      )}
      style={{ width: collapsed ? 0 : width }}
      aria-hidden={collapsed}
    >
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
          collapsed && "invisible",
        )}
      >
        {children}
      </div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={collapsed ? "Expand sidebar" : "Resize sidebar"}
        aria-valuenow={collapsed ? 0 : width}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={cn(
          "absolute top-0 z-20 flex h-full w-1.5 cursor-col-resize items-center justify-center touch-none select-none",
          collapsed ? "right-0" : "-right-0.5",
        )}
      >
        <span
          className={cn(
            "transition-colors duration-150",
            snapHighlight
              ? "h-full w-0.5 bg-accent"
              : "h-full w-0.5 bg-transparent opacity-0 hover:bg-muted-foreground/40 hover:opacity-100 active:bg-muted-foreground/60",
          )}
        />
      </div>
    </aside>
  );
}
