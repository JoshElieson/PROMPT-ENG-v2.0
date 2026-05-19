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
import { appMenuGroups, type MenuEntry } from "@/data/menu-items";
import { cn } from "@/lib/utils";

function MenuEntries({ items }: { items: MenuEntry[] }) {
  return (
    <>
      {items.map((entry, index) => {
        if (entry.type === "separator") {
          return <DropdownMenuSeparator key={`sep-${index}`} />;
        }

        if (entry.type === "submenu") {
          return (
            <DropdownMenuSub key={entry.label}>
              <DropdownMenuSubTrigger>{entry.label}</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <MenuEntries items={entry.items} />
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          );
        }

        return (
          <DropdownMenuItem
            key={entry.label}
            disabled={entry.disabled}
            onSelect={(e) => e.preventDefault()}
          >
            {entry.label}
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
            "rounded px-2.5 py-1 text-[13px] text-muted-foreground outline-none",
            "hover:bg-panel-elevated hover:text-foreground",
            "data-[state=open]:bg-panel-elevated data-[state=open]:text-foreground",
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

export function MenuBar() {
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
      className="flex min-w-0 flex-1 items-center gap-0.5"
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
          }}
        />
      ))}
    </nav>
  );
}
