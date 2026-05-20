import { useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, Search, ShoppingCart, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarPanel } from "@/components/layout/SidebarPanel";
import {
  filterModelsGroupedByOrg,
  getModelsGroupedByOrg,
  getTopModelForOrg,
  type AiModel,
  type ModelOrg,
} from "@/data/ai-models";
import { ModelLogo } from "@/components/models/ModelLogo";
import { useChatRoundTable } from "@/hooks/use-chat-round-table";
import { cn } from "@/lib/utils";

const allGroupedOrgs = getModelsGroupedByOrg();

function FlyoutModelItem({
  model,
  selected,
  onToggle,
}: {
  model: AiModel;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm transition-colors",
        selected ? "bg-panel-elevated" : "hover:bg-panel-elevated/80",
      )}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="h-3.5 w-3.5 shrink-0 border-border bg-panel accent-foreground"
      />
      <ModelLogo orgId={model.orgId} size="sm" />
      <span className="min-w-0 flex-1 truncate font-medium">{model.name}</span>
      <span className="shrink-0 text-[10px] text-muted">{model.role}</span>
    </label>
  );
}

function OrgFlyout({
  org,
  models,
  anchor,
  isSelected,
  toggleModel,
  onPointerEnter,
  onPointerLeave,
}: {
  org: ModelOrg;
  models: AiModel[];
  anchor: DOMRect;
  isSelected: (id: string) => boolean;
  toggleModel: (id: string) => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}) {
  const selectedCount = models.filter((m) => isSelected(m.id)).length;

  return createPortal(
    <section
      className="fixed z-50 min-w-[220px] rounded-lg border border-border bg-panel shadow-lg"
      style={{
        top: anchor.top,
        left: anchor.right + 6,
        maxHeight: `min(360px, calc(100vh - ${anchor.top}px - 12px))`,
      }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <header className="border-b border-border-subtle px-3 py-2">
        <p className="text-xs font-semibold text-foreground">{org.name}</p>
        <p className="text-[10px] text-muted">
          {selectedCount} of {models.length} in Round Table
        </p>
      </header>
      <ul className="overflow-y-auto py-1">
        {models.map((model) => (
          <li key={model.id}>
            <FlyoutModelItem
              model={model}
              selected={isSelected(model.id)}
              onToggle={() => toggleModel(model.id)}
            />
          </li>
        ))}
      </ul>
    </section>,
    document.body,
  );
}

function OrgCartRow({
  org,
  models,
  isSelected,
  isOpen,
  onOpen,
  onClose,
  onToggleOrg,
}: {
  org: ModelOrg;
  models: AiModel[];
  isSelected: (id: string) => boolean;
  isOpen: boolean;
  onOpen: (anchor: DOMRect) => void;
  onClose: () => void;
  onToggleOrg: () => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const selectedCount = models.filter((m) => isSelected(m.id)).length;

  const handleOpen = useCallback(() => {
    const rect = rowRef.current?.getBoundingClientRect();
    if (rect) onOpen(rect);
  }, [onOpen]);

  const handleOrgClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleOrg();
    },
    [onToggleOrg],
  );

  return (
    <div
      ref={rowRef}
      className={cn(
        "flex w-full items-center gap-2.5 border px-3 py-2.5 text-left transition-colors",
        isOpen || selectedCount > 0
          ? "border-[#6366f1]/24 bg-panel-elevated/72"
          : "border-transparent hover:border-border-subtle hover:bg-panel-elevated",
      )}
      onPointerEnter={handleOpen}
      onPointerLeave={onClose}
    >
      <button
        type="button"
        onClick={handleOrgClick}
        title={
          selectedCount > 0
            ? `Remove all selected ${org.name} models from cart`
            : `Add top ${org.name} model to cart`
        }
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left hover:opacity-80"
      >
        <ModelLogo orgId={org.id} size="md" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{org.name}</span>
          <span className="mt-0.5 block truncate text-[11px] text-muted">
            {models.length} {models.length === 1 ? "model" : "models"}
            {selectedCount > 0 && (
              <span className="text-muted-foreground">
                {" "}
                · {selectedCount} selected
              </span>
            )}
          </span>
        </span>
      </button>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
    </div>
  );
}

interface AgentCartPanelProps {
  active?: boolean;
}

export function AgentCartPanel({ active }: AgentCartPanelProps) {
  const { selectedIds, isSelected, toggleModel, deselectModels } =
    useChatRoundTable();
  const [search, setSearch] = useState("");
  const [openOrgId, setOpenOrgId] = useState<string | null>(null);
  const [flyoutAnchor, setFlyoutAnchor] = useState<DOMRect | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filteredGroups = useMemo(
    () => filterModelsGroupedByOrg(allGroupedOrgs, search),
    [search],
  );

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setOpenOrgId(null);
      setFlyoutAnchor(null);
    }, 120);
  }, [clearCloseTimer]);

  const openOrg = useCallback(
    (orgId: string, anchor: DOMRect) => {
      clearCloseTimer();
      setOpenOrgId(orgId);
      setFlyoutAnchor(anchor);
    },
    [clearCloseTimer],
  );

  const openGroup = filteredGroups.find((g) => g.org.id === openOrgId);

  return (
    <SidebarPanel
      title="Model Cart"
      active={active}
      headerExtra={<ShoppingCart className="h-3.5 w-3.5 text-accent" />}
    >
      <section className="shrink-0 border-b border-border-subtle px-2 py-2">
        <label className="relative block w-full min-w-0">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOpenOrgId(null);
              setFlyoutAnchor(null);
            }}
            placeholder="Search models or providers"
            title="Search models or providers"
            className={cn(
              "box-border min-w-0 w-full border border-border bg-surface py-1.5 pl-8 text-xs text-foreground placeholder:text-muted outline-none focus:border-foreground/40",
              search ? "pr-8" : "pr-2",
            )}
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setOpenOrgId(null);
                setFlyoutAnchor(null);
              }}
              className="absolute right-2 flex h-5 w-5 items-center justify-center text-muted hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </label>
      </section>

      <ScrollArea className="h-full">
        <section className="space-y-1 p-2">
          {filteredGroups.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted">
              No models or providers match &ldquo;{search.trim()}&rdquo;
            </p>
          ) : (
            filteredGroups.map(({ org, models }) => (
              <OrgCartRow
                key={org.id}
                org={org}
                models={models}
                isSelected={isSelected}
                isOpen={openOrgId === org.id}
                onOpen={(anchor) => openOrg(org.id, anchor)}
                onClose={scheduleClose}
                onToggleOrg={() => {
                  const selected = models.filter((m) => isSelected(m.id));
                  if (selected.length > 0) {
                    deselectModels(selected.map((m) => m.id));
                    return;
                  }
                  const top = getTopModelForOrg(org.id);
                  if (top && !isSelected(top.id)) toggleModel(top.id);
                }}
              />
            ))
          )}
        </section>
      </ScrollArea>

      {openGroup && flyoutAnchor && (
        <OrgFlyout
          org={openGroup.org}
          models={openGroup.models}
          anchor={flyoutAnchor}
          isSelected={isSelected}
          toggleModel={toggleModel}
          onPointerEnter={clearCloseTimer}
          onPointerLeave={scheduleClose}
        />
      )}

      <footer className="shrink-0 px-3 py-2">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{selectedIds.length}</span>
          {selectedIds.length === 1 ? " model" : " models"} selected
        </p>
      </footer>
    </SidebarPanel>
  );
}
