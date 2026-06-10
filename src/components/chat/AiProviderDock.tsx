import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { ModelLogo } from "@/components/models/ModelLogo";
import { useLayout } from "@/contexts/LayoutContext";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AiModel } from "@/data/ai-models";
import {
  dropSideFromPointer,
  type DropSide,
} from "@/lib/list-reorder-drag";
import { cn } from "@/lib/utils";

const DOCK_ITEM_STAGGER_MS = 42;
const DOCK_ICON_ROW = "h-8 w-8";
/** Matches chat settings button chrome in `ChatUtilityBar`. */
const DOCK_TOGGLE_CHROME = cn(
  "ai-dock-shell group/dock flex h-8 w-10 shrink-0 select-none items-center justify-center rounded-xl border border-border/35",
  "bg-panel/72 text-muted-foreground shadow-dock backdrop-blur-md transition-all duration-150",
  "hover:border-border-subtle hover:bg-hover-surface hover:text-foreground",
  "hover:shadow-dock-hover",
);

const DOCK_CONNECTED_SHELL = cn(
  "ai-dock-shell pointer-events-auto absolute bottom-0 left-0 z-20 flex w-10 flex-col overflow-hidden rounded-xl",
  "border border-border-subtle bg-panel/72 text-foreground shadow-dock-active backdrop-blur-md",
);

const DOCK_EXPANDED_TOGGLE = cn(
  "flex h-8 w-full shrink-0 select-none items-center justify-center border-t border-border/25 transition-colors",
  "hover:bg-hover-surface",
);

type AiProviderDockProps = {
  models: AiModel[];
  primaryModel: AiModel;
  highlightedIds: Set<string>;
  autoEnabled: boolean;
  activeIds: string[];
  onModelClick: (id: string) => void;
  onReorderModels?: (sourceId: string, targetId: string, side: DropSide) => void;
  /** When true, sits in normal flow beside the composer instead of overlay positioning. */
  inline?: boolean;
};

function DockAddModelButton({
  animateIn,
  onClick,
}: {
  animateIn: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            DOCK_ICON_ROW,
            "relative flex shrink-0 select-none items-center justify-center rounded-lg border border-dashed border-border/70",
            "bg-transparent text-muted-foreground transition-colors duration-200",
            "hover:border-accent/45 hover:bg-hover-surface-subtle hover:text-accent-soft",
            animateIn && "ai-dock-item-in",
          )}
          style={animateIn ? { animationDelay: "0ms" } : undefined}
          aria-label="Add models"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="font-medium">
        Add models
      </TooltipContent>
    </Tooltip>
  );
}

function DockProviderIcon({
  model,
  active,
  highlighted,
  staggerIndex,
  animateIn,
  onClick,
}: {
  model: AiModel;
  active: boolean;
  highlighted: boolean;
  staggerIndex: number;
  animateIn: boolean;
  onClick: () => void;
}) {
  const selected = active || highlighted;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            DOCK_ICON_ROW,
            "relative flex shrink-0 select-none items-center justify-center rounded-lg border border-transparent transition-colors duration-200",
            "hover:border-border-subtle hover:bg-hover-surface hover:shadow-[0_0_0_1px_rgb(99_102_241_/_0.14)]",
            selected &&
              "border-border-subtle bg-hover-surface shadow-[0_0_0_1px_rgb(99_102_241_/_0.14)]",
            animateIn && "ai-dock-item-in",
          )}
          style={
            animateIn
              ? { animationDelay: `${staggerIndex * DOCK_ITEM_STAGGER_MS}ms` }
              : undefined
          }
          aria-label={model.name}
          aria-pressed={active}
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          <ModelLogo
            orgId={model.orgId}
            size="sm"
            muted={!selected}
            className="ring-0"
          />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="font-medium">
        {model.name}
        {highlighted && !active ? " · Speaking" : null}
      </TooltipContent>
    </Tooltip>
  );
}

function DockModelDropIndicator({ side }: { side: DropSide }) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute inset-x-1 z-10 h-0.5 rounded-full bg-accent-bright",
        side === "before" ? "-top-0.5" : "-bottom-0.5",
      )}
      aria-hidden
    />
  );
}

export function AiProviderDock({
  models,
  primaryModel: _primaryModel,
  highlightedIds,
  autoEnabled,
  activeIds,
  onModelClick,
  onReorderModels,
  inline = false,
}: AiProviderDockProps) {
  const { setLeftSidebarViewVisible } = useLayout();
  const [expanded, setExpanded] = useState(false);
  const [staggerGeneration, setStaggerGeneration] = useState(0);
  const [dragModelId, setDragModelId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<{
    targetModelId: string;
    side: DropSide;
  } | null>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const activeSet = useMemo(() => new Set(activeIds), [activeIds]);
  const canReorder = onReorderModels != null && models.length > 1;

  const collapse = useCallback(() => setExpanded(false), []);

  const expand = useCallback(() => {
    setExpanded(true);
    setStaggerGeneration((n) => n + 1);
  }, []);

  const openAgentCart = useCallback(() => {
    collapse();
    setLeftSidebarViewVisible("agents", true);
  }, [collapse, setLeftSidebarViewVisible]);

  const handleModelDragStart = useCallback(
    (modelId: string, e: DragEvent<HTMLDivElement>) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", modelId);
      setDragModelId(modelId);
    },
    [],
  );

  const handleModelDrop = useCallback(
    (targetModelId: string, e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const sourceModelId = e.dataTransfer.getData("text/plain");
      if (!sourceModelId || !onReorderModels) return;
      const side =
        dropHint?.targetModelId === targetModelId
          ? dropHint.side
          : dropSideFromPointer(e, "vertical");
      onReorderModels(sourceModelId, targetModelId, side);
      setDragModelId(null);
      setDropHint(null);
    },
    [dropHint, onReorderModels],
  );

  useEffect(() => {
    if (!expanded) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (dockRef.current?.contains(target)) return;
      collapse();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") collapse();
    };

    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [expanded, collapse]);

  return (
    <section
      className={cn(
        "select-none",
        inline
          ? "pointer-events-auto relative h-8 w-10 shrink-0 overflow-visible"
          : "pointer-events-none absolute bottom-0 left-0 z-10 mb-3 px-2",
      )}
      aria-label="AI providers"
    >
      <div
        ref={dockRef}
        className={cn(
          "relative w-10",
          inline ? "absolute bottom-0 left-0 z-30" : "pointer-events-auto",
        )}
      >
        {expanded ? (
          <div className={DOCK_CONNECTED_SHELL}>
            <div
              className="flex flex-col items-center gap-0.5 px-1 py-1.5"
              role="list"
            >
              <div key={`add-${staggerGeneration}`} role="listitem">
                <DockAddModelButton animateIn onClick={openAgentCart} />
              </div>
              {models.map((model, index) => {
                const isActive = !autoEnabled && activeSet.has(model.id);
                const isHighlighted = highlightedIds.has(model.id);
                const dropIndicatorSide =
                  dropHint?.targetModelId === model.id ? dropHint.side : null;

                return (
                  <div
                    key={`${model.id}-${staggerGeneration}`}
                    role="listitem"
                    className={cn(
                      "relative",
                      canReorder && "cursor-grab active:cursor-grabbing",
                      dragModelId === model.id && "opacity-70",
                    )}
                    draggable={canReorder}
                    onDragStart={
                      canReorder
                        ? (e) => handleModelDragStart(model.id, e)
                        : undefined
                    }
                    onDragOver={
                      canReorder
                        ? (e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                            if (!dragModelId || dragModelId === model.id) {
                              setDropHint(null);
                              return;
                            }
                            setDropHint({
                              targetModelId: model.id,
                              side: dropSideFromPointer(e, "vertical"),
                            });
                          }
                        : undefined
                    }
                    onDrop={
                      canReorder
                        ? (e) => handleModelDrop(model.id, e)
                        : undefined
                    }
                    onDragLeave={
                      canReorder
                        ? (e) => {
                            const related = e.relatedTarget as Node | null;
                            if (related && e.currentTarget.contains(related)) {
                              return;
                            }
                            setDropHint((prev) =>
                              prev?.targetModelId === model.id ? null : prev,
                            );
                          }
                        : undefined
                    }
                    onDragEnd={
                      canReorder
                        ? () => {
                            setDragModelId(null);
                            setDropHint(null);
                          }
                        : undefined
                    }
                  >
                    {dropIndicatorSide === "before" ? (
                      <DockModelDropIndicator side="before" />
                    ) : null}
                    <div
                      className="bg-border/30 mx-auto mb-0.5 h-px w-6"
                      aria-hidden
                    />
                    <DockProviderIcon
                      model={model}
                      active={isActive}
                      highlighted={isHighlighted}
                      staggerIndex={index + 1}
                      animateIn
                      onClick={() => onModelClick(model.id)}
                    />
                    {dropIndicatorSide === "after" ? (
                      <DockModelDropIndicator side="after" />
                    ) : null}
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              className={DOCK_EXPANDED_TOGGLE}
              aria-expanded
              title="Collapse AI providers"
              aria-label="Collapse AI providers"
              onClick={(e) => {
                e.stopPropagation();
                collapse();
              }}
            >
              <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </button>
          </div>
        ) : (
          <button
            type="button"
            className={DOCK_TOGGLE_CHROME}
            aria-expanded={false}
            title="Expand AI providers"
            aria-label={`Expand AI providers (${models.length})`}
            onClick={(e) => {
              e.stopPropagation();
              expand();
            }}
          >
            <ChevronUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
          </button>
        )}
      </div>
    </section>
  );
}
