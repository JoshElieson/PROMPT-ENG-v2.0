import { useState } from "react";
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
  menuBarActive,
  onOpenChange,
  onActivate,
}: {
  label: string;
  items: MenuEntry[];
  open: boolean;
  menuBarActive: boolean;
  onOpenChange: (open: boolean) => void;
  onActivate: () => void;
}) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange} modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "rounded px-2.5 py-1 text-[13px] text-muted-foreground outline-none",
            "hover:bg-panel-elevated hover:text-foreground",
            "data-[state=open]:bg-panel-elevated data-[state=open]:text-foreground",
          )}
          onPointerEnter={() => {
            if (menuBarActive) onActivate();
          }}
          onPointerDown={(e) => {
            if (menuBarActive && !open) {
              e.preventDefault();
              onActivate();
            }
          }}
        >
          {label}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[220px]">
        <MenuEntries items={items} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MenuBar() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuBarActive = openMenu !== null;

  return (
    <nav
      className="flex min-w-0 flex-1 items-center gap-0.5"
      aria-label="Application menu"
    >
      {appMenuGroups.map((group) => (
        <MenuGroupDropdown
          key={group.label}
          label={group.label}
          items={group.items}
          open={openMenu === group.label}
          menuBarActive={menuBarActive}
          onOpenChange={(nextOpen) => {
            if (nextOpen) {
              setOpenMenu(group.label);
            } else {
              setOpenMenu((current) =>
                current === group.label ? null : current,
              );
            }
          }}
          onActivate={() => setOpenMenu(group.label)}
        />
      ))}
    </nav>
  );
}
