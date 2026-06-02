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
import { GoToPanel, type GoToPanelKind } from "@/components/layout/GoToPanel";
import { useChats } from "@/contexts/ChatsContext";
import { useAppSelection } from "@/contexts/AppSelectionContext";
import { menuActionChecked, useLayout } from "@/contexts/LayoutContext";
import {
  copyTextToClipboard,
  cutChatInputSelection,
  findEditableChatInput,
  getEditableSelection,
  pasteIntoChatInput,
  readSelectedText,
} from "@/lib/edit-clipboard";
import { cn } from "@/lib/utils";

function menuActionToSidebarView(action: MenuActionId): Exclude<SidebarView, "git"> | null {
  if (action === "view.explorer") return "explorer";
  if (action === "view.agentCart") return "agents";
  return null;
}

/**
 * Anchor the Go to… panel to the right edge of the whole dropdown (like a
 * submenu) while keeping it vertically aligned with the hovered item.
 */
function goToAnchorFromItem(node: HTMLElement): DOMRect {
  const itemRect = node.getBoundingClientRect();
  const menu = node.closest<HTMLElement>('[role="menu"]');
  const menuRect = menu?.getBoundingClientRect();
  if (!menuRect) return itemRect;
  return new DOMRect(
    menuRect.left,
    itemRect.top,
    menuRect.width,
    itemRect.height,
  );
}

function isGoToActionId(action?: MenuActionId): action is "go.agent" | "go.project" {
  return action === "go.agent" || action === "go.project";
}

function MenuEntries({
  items,
  onOpenGoTo,
  onCloseGoTo,
}: {
  items: MenuEntry[];
  onOpenGoTo: (kind: GoToPanelKind, anchor: DOMRect) => void;
  onCloseGoTo: () => void;
}) {
  const {
    createChat,
    startNewProject,
    expandActiveWorkspaceLayout,
    canUndoActiveChat,
    canRedoActiveChat,
    undoActiveChat,
    redoActiveChat,
  } = useChats();
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
      if (action === "file.agentSettings") {
        selectWorkspaceScreen();
        document
          .querySelector<HTMLElement>('[data-ai-target="chat.settings.button"]')
          ?.click();
        return;
      }
      if (action === "file.newProject") {
        setLeftSidebarViewVisible("explorer", true);
        startNewProject();
        return;
      }
      if (action === "edit.undo") {
        undoActiveChat();
        return;
      }
      if (action === "edit.redo") {
        redoActiveChat();
        return;
      }
      if (action === "edit.copy") {
        const selectedText = readSelectedText(document.activeElement);
        if (selectedText.length > 0) {
          void copyTextToClipboard(selectedText);
        }
        return;
      }
      if (action === "edit.cut") {
        const chatInput = findEditableChatInput(document.activeElement);
        if (!chatInput) return;
        const { start, end } = getEditableSelection(chatInput);
        if (end > start) {
          void cutChatInputSelection(chatInput, start, end);
        }
        return;
      }
      if (action === "edit.paste") {
        const chatInput = findEditableChatInput(document.activeElement);
        if (!chatInput) return;
        const { start, end } = getEditableSelection(chatInput);
        void pasteIntoChatInput(chatInput, start, end);
        return;
      }
      if (action === "go.previousMessage") {
        selectWorkspaceScreen();
        window.dispatchEvent(new CustomEvent("forge:go-previous-message"));
        return;
      }
      if (action === "go.nextMessage") {
        selectWorkspaceScreen();
        window.dispatchEvent(new CustomEvent("forge:go-next-message"));
        return;
      }
      dispatchMenuAction(action);
    },
    [
      createChat,
      startNewProject,
      setLeftSidebarViewVisible,
      undoActiveChat,
      redoActiveChat,
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
                <MenuEntries
                  items={entry.items}
                  onOpenGoTo={onOpenGoTo}
                  onCloseGoTo={onCloseGoTo}
                />
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          );
        }

        const isUndoEntry = entry.action === "edit.undo";
        const isRedoEntry = entry.action === "edit.redo";
        const isActionDisabled =
          entry.disabled ||
          (isUndoEntry && !canUndoActiveChat) ||
          (isRedoEntry && !canRedoActiveChat);

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
          const toggleCheckableEntry = () => {
            if (entry.action === "view.workspaceTerminal") {
              toggleBottomPanelKind("terminal");
            } else if (entry.action === "view.workspaceBrowser") {
              toggleBottomPanelKind("browser");
            } else if (sidebarViewTarget) {
              setLeftSidebarViewVisible(sidebarViewTarget, !checked);
            }
          };

          return (
            <DropdownMenuCheckboxItem
              key={entry.label}
              disabled={isActionDisabled}
              checked={checked}
              onSelect={(event) => {
                event.preventDefault();
                toggleCheckableEntry();
              }}
            >
              {getMenuDisplayLabel(entry)}
              {entry.shortcut && (
                <DropdownMenuShortcut>{entry.shortcut}</DropdownMenuShortcut>
              )}
            </DropdownMenuCheckboxItem>
          );
        }

        const isGoToAction = isGoToActionId(entry.action);
        const goToKind: GoToPanelKind | null = isGoToAction
          ? entry.action === "go.agent"
            ? "agent"
            : "project"
          : null;

        return (
          <DropdownMenuItem
            key={entry.label}
            disabled={isActionDisabled}
            data-go-to={isGoToAction ? entry.action : undefined}
            onPointerEnter={(event) => {
              if (goToKind) {
                onOpenGoTo(goToKind, goToAnchorFromItem(event.currentTarget));
              } else {
                onCloseGoTo();
              }
            }}
            onSelect={(event) => {
              if (goToKind) {
                // Keep the dropdown open so the panel reads as a submenu cascade.
                event.preventDefault();
                const node =
                  (event.currentTarget as HTMLElement | null) ??
                  document.querySelector<HTMLElement>(
                    `[data-go-to="${entry.action}"]`,
                  );
                if (node) onOpenGoTo(goToKind, goToAnchorFromItem(node));
                return;
              }
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
  onOpenGoTo,
  onCloseGoTo,
}: {
  label: string;
  items: MenuEntry[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTriggerMouseDown: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onTriggerMouseEnter: () => void;
  onOpenGoTo: (kind: GoToPanelKind, anchor: DOMRect) => void;
  onCloseGoTo: () => void;
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
            target.closest("[data-menu-trigger], [data-go-to-panel]")
          ) {
            event.preventDefault();
          }
        }}
        onFocusOutside={(event) => {
          const target = event.target;
          if (
            target instanceof Element &&
            target.closest("[data-menu-trigger], [data-go-to-panel]")
          ) {
            event.preventDefault();
          }
        }}
      >
        <MenuEntries
          items={items}
          onOpenGoTo={onOpenGoTo}
          onCloseGoTo={onCloseGoTo}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface MenuBarProps {
  className?: string;
}

export function MenuBar({ className }: MenuBarProps) {
  const {
    canUndoActiveChat,
    canRedoActiveChat,
    undoActiveChat,
    redoActiveChat,
  } = useChats();
  const { selectWorkspaceScreen } = useAppSelection();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [goTo, setGoTo] = useState<{
    kind: GoToPanelKind;
    anchor: DOMRect;
  } | null>(null);
  const menuSession = useRef(false);
  const openMenuRef = useRef<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    openMenuRef.current = openMenu;
  }, [openMenu]);

  const closeGoToPanel = useCallback(() => {
    setGoTo(null);
  }, []);

  const endSession = useCallback(() => {
    menuSession.current = false;
    setOpenMenu(null);
    setGoTo(null);
  }, []);

  const beginSession = useCallback((label: string) => {
    menuSession.current = true;
    setOpenMenu(label);
  }, []);

  const openGoToPanel = useCallback(
    (kind: GoToPanelKind, anchor: DOMRect) => {
      setGoTo({ kind, anchor });
    },
    [],
  );

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!menuSession.current) return;

      const target = event.target;
      if (!(target instanceof Node)) return;

      const inNav = navRef.current?.contains(target);
      const inMenu =
        target instanceof Element &&
        target.closest('[role="menu"], [role="menuitem"], [data-go-to-panel]');

      if (!inNav && !inMenu) {
        endSession();
      }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [endSession]);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      if (
        target.closest("textarea, input, [contenteditable='true'], [role='textbox']")
      ) {
        return true;
      }
      return false;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (!event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === "z" && event.shiftKey) {
        if (!canRedoActiveChat) return;
        event.preventDefault();
        redoActiveChat();
        return;
      }
      if (key === "z" && !event.shiftKey) {
        if (!canUndoActiveChat) return;
        event.preventDefault();
        undoActiveChat();
        return;
      }
      if (event.shiftKey) return;
      if (event.key === "ArrowUp") {
        event.preventDefault();
        selectWorkspaceScreen();
        window.dispatchEvent(new CustomEvent("forge:go-previous-message"));
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        selectWorkspaceScreen();
        window.dispatchEvent(new CustomEvent("forge:go-next-message"));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    canUndoActiveChat,
    canRedoActiveChat,
    redoActiveChat,
    undoActiveChat,
    selectWorkspaceScreen,
  ]);

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
            if (menuSession.current) {
              if (openMenuRef.current !== group.label) closeGoToPanel();
              beginSession(group.label);
            }
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
            closeGoToPanel();
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
          onOpenGoTo={openGoToPanel}
          onCloseGoTo={closeGoToPanel}
        />
      ))}
      {goTo && (
        <GoToPanel
          kind={goTo.kind}
          anchor={goTo.anchor}
          onClose={endSession}
        />
      )}
    </nav>
  );
}
