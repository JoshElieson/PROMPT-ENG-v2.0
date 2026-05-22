import { useCallback, useEffect, useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
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
import { useChats } from "@/contexts/ChatsContext";
import { useAppSelection } from "@/contexts/AppSelectionContext";
import { menuActionChecked, useLayout } from "@/contexts/LayoutContext";
import { cn } from "@/lib/utils";

function menuActionToSidebarView(action: MenuActionId): Exclude<SidebarView, "git"> | null {
  if (action === "view.explorer") return "explorer";
  if (action === "view.agentCart") return "agents";
  return null;
}

function MenuEntries({ items }: { items: MenuEntry[] }) {
  const { createChat, startNewProject, expandActiveWorkspaceLayout } = useChats();
  const { selectWorkspaceScreen } = useAppSelection();
  const {
    workspaceBottomPanelOpen,
    bottomPanelKindsVisible,
    sidebarView,
    leftSidebarCollapsed,
    setLeftSidebarViewVisible,
    toggleBottomPanelKind,
    dispatchMenuAction,
  } = useLayout();
  const runMenuAction = useCallback(
    (action: MenuActionId) => {
      if (action === "file.newAgent") {
        if (!expandActiveWorkspaceLayout(true)) {
          createChat();
        }
        selectWorkspaceScreen();
        return;
      }
      if (action === "file.newProject") {
        setLeftSidebarViewVisible("explorer", true);
        startNewProject();
        return;
      }
      dispatchMenuAction(action);
    },
    [
      createChat,
      startNewProject,
      setLeftSidebarViewVisible,
      dispatchMenuAction,
      expandActiveWorkspaceLayout,
      selectWorkspaceScreen,
    ],
  );
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
          const sidebarViewTarget = menuActionToSidebarView(entry.action);
          const checked =
            menuActionChecked(
              entry.action,
              workspaceBottomPanelOpen,
              sidebarView,
              leftSidebarCollapsed,
              bottomPanelKindsVisible,
            ) ?? false;

          return (
            <DropdownMenuCheckboxItem
              key={entry.label}
              disabled={entry.disabled}
              checked={checked}
              onSelect={() => {
                if (entry.action === "view.workspaceTerminal") {
                  toggleBottomPanelKind("terminal");
                } else if (entry.action === "view.workspaceBrowser") {
                  toggleBottomPanelKind("browser");
                } else if (sidebarViewTarget) {
                  setLeftSidebarViewVisible(sidebarViewTarget, !checked);
                }
              }}
            >
              {getMenuDisplayLabel(entry)}
              {entry.shortcut && (
                <DropdownMenuShortcut>{entry.shortcut}</DropdownMenuShortcut>
              )}
            </DropdownMenuCheckboxItem>
          );
        }

        return (
          <DropdownMenuItem
            key={entry.label}
            disabled={entry.disabled}
            onSelect={() => {
              if (entry.action) runMenuAction(entry.action);
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

  useEffect(() => {
    openMenuRef.current = openMenu;
  }, [openMenu]);

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
