import type { SlashCommand } from "@/data/slash-commands";
import { cn } from "@/lib/utils";

interface SlashCommandAutocompleteProps {
  commands: SlashCommand[];
  activeIndex: number;
  onSelect: (command: SlashCommand) => void;
  onActiveIndexChange?: (index: number) => void;
}

export function SlashCommandAutocomplete({
  commands,
  activeIndex,
  onSelect,
  onActiveIndexChange,
}: SlashCommandAutocompleteProps) {
  if (commands.length === 0) {
    return (
      <div className="border-border bg-panel text-muted rounded-lg border p-3 text-xs shadow-lg">
        No matching commands
      </div>
    );
  }

  return (
    <ul
      className="border-border bg-panel max-h-48 overflow-y-auto rounded-lg border py-1 shadow-lg"
      role="listbox"
      aria-label="Slash commands"
    >
      {commands.map((command, index) => (
        <li key={command.id} role="option" aria-selected={index === activeIndex}>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onMouseEnter={() => onActiveIndexChange?.(index)}
            onClick={(e) => {
              e.preventDefault();
              onSelect(command);
            }}
            className={cn(
              "flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm transition-colors",
              index === activeIndex
                ? "bg-panel-elevated text-foreground outline outline-1 outline-offset-[-1px] outline-foreground"
                : "hover:bg-panel-elevated",
            )}
          >
            <span className="truncate font-medium text-sky-400">
              {command.label}
            </span>
            {command.description && (
              <span className="text-muted truncate text-xs">
                {command.description}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
