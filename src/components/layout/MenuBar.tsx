import { useCallback, useEffect, useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  appMenuGroups,
  getMenuDisplayLabel,
  type MenuActionId,
  type MenuEntry,
} from "@/data/menu-items";
import type { SidebarView } from "@/components/layout/ActivityBar";
import { menuActionChecked, useLayout } from "@/contexts/LayoutContext";
import { cn } from "@/lib/utils";

function menuActionToRightPanel(
  action: MenuActionId,
): "roundTable" | "workflow" | null {
  if (action === "view.roundTablePanel") return "roundTable";
  if (action === "view.workflowPanel") return "workflow";
  return null;
}

function menuActionToSidebarView(action: MenuActionId): Exclude<SidebarView, "git"> | null {
  if (action === "view.explorer") return "explorer";
  if (action === "view.agentCart") return "agents";
  return null;
}

function MenuEntries({ items }: { items: MenuEntry[] }) {
  const {
    rightPanels,
    workspaceBottomPanelOpen,
    sidebarView,
    leftSidebarCollapsed,
    setRightPanelVisible,
    setLeftSidebarViewVisible,
    requestBottomPanelTab,
    dispatchMenuAction,
  } = useLayout();
  return (
    <>
      {items.map((entry, index) => {
        if (entry.type === "separator") {
          return <DropdownMenuSeparator key={`sep-${index}`} />;
        }

        if (entry.type === "submenu") {
          return (
            <DropdownMenuSub key={entry.label}>
              <DropdownMenuSubTrigger>
                {getMenuDisplayLabel(entry)}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <MenuEntries items={entry.items} />
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          );
        }

        if (entry.checkable && entry.action) {
          const panel = menuActionToRightPanel(entry.action);
          const sidebarViewTarget = menuActionToSidebarView(entry.action);
          const checked =
            menuActionChecked(
              entry.action,
              rightPanels,
              workspaceBottomPanelOpen,
              sidebarView,
              leftSidebarCollapsed,
            ) ?? false;

          return (
            <DropdownMenuItem
              key={entry.label}
              disabled={entry.disabled}
              onSelect={() => {
                const next = !checked;
                if (panel) setRightPanelVisible(panel, next);
                else if (entry.action === "view.workspaceTerminal") {
                  requestBottomPanelTab("terminal");
                } else if (sidebarViewTarget) {
                  setLeftSidebarViewVisible(sidebarViewTarget, next);
                }
              }}
            >
              {getMenuDisplayLabel(entry)}
              {entry.shortcut && (
                <DropdownMenuShortcut>{entry.shortcut}</DropdownMenuShortcut>
              )}
            </DropdownMenuItem>
          );
        }

        return (
          <DropdownMenuItem
            key={entry.label}
            disabled={entry.disabled}
            onSelect={() => {
              if (entry.action === "view.workspaceBrowser") {
                requestBottomPanelTab("browser");
                return;
              }
              if (entry.action) dispatchMenuAction(entry.action);
            }}
          >
            {getMenuDisplayLabel(entry)}
            {entry.shortcut && (
              <DropdownMenuShortcut>{entry.shortcut}</DropdownMenuShortcut>
            )}
          </DropdownMenuItem>
        );
      })}
    </>
  );
}

function MenuGroupDropdown({
  label,
  items,
  open,
  onOpenChange,
  onTriggerMouseDown,
  onTriggerMouseEnter,
}: {
  label: string;
  items: MenuEntry[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTriggerMouseDown: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onTriggerMouseEnter: () => void;
}) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange} modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-menu-trigger={label}
          className={cn(
            "rounded-md px-2.5 py-1 text-[11px] font-normal text-muted outline-none",
            "transition-colors duration-150 ease-out",
            "hover:bg-menu-hover hover:text-foreground",
            "data-[state=open]:bg-menu-hover-strong data-[state=open]:text-foreground",
          )}
          onMouseDown={onTriggerMouseDown}
          onMouseEnter={onTriggerMouseEnter}
        >
          {label}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="min-w-[220px]"
        onInteractOutside={(event) => {
          const target = event.target;
          if (
            target instanceof Element &&
            target.closest("[data-menu-trigger]")
          ) {
            event.preventDefault();
          }
        }}
        onFocusOutside={(event) => {
          const target = event.target;
          if (
            target instanceof Element &&
            target.closest("[data-menu-trigger]")
          ) {
            event.preventDefault();
          }
        }}
      >
        <MenuEntries items={items} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface MenuBarProps {
  className?: string;
}

export function MenuBar({ className }: MenuBarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuSession = useRef(false);
  const openMenuRef = useRef<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  openMenuRef.current = openMenu;

  const endSession = useCallback(() => {
    menuSession.current = false;
    setOpenMenu(null);
  }, []);

  const beginSession = useCallback((label: string) => {
    menuSession.current = true;
    setOpenMenu(label);
  }, []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!menuSession.current) return;

      const target = event.target;
      if (!(target instanceof Node)) return;

      const inNav = navRef.current?.contains(target);
      const inMenu =
        target instanceof Element &&
        target.closest('[role="menu"], [role="menuitem"]');

      if (!inNav && !inMenu) {
        endSession();
      }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [endSession]);

  return (
    <nav
      ref={navRef}
      className={cn("flex min-w-0 items-center gap-1", className)}
      aria-label="Application menu"
    >
      {appMenuGroups.map((group) => (
        <MenuGroupDropdown
          key={group.label}
          label={group.label}
          items={group.items}
          open={openMenu === group.label}
          onTriggerMouseEnter={() => {
            if (menuSession.current) beginSession(group.label);
          }}
          onTriggerMouseDown={(event) => {
            if (
              menuSession.current &&
              openMenuRef.current === group.label
            ) {
              event.preventDefault();
              endSession();
              return;
            }
            if (menuSession.current) {
              beginSession(group.label);
            } else {
              menuSession.current = true;
            }
          }}
          onOpenChange={(nextOpen) => {
            if (nextOpen) beginSession(group.label);
            else endSession();
          }}
        />
      ))}
    </nav>
  );
}
