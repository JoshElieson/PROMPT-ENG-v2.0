import { ModelLogo } from "@/components/models/ModelLogo";
import type { AiModel } from "@/data/ai-models";
import { cn } from "@/lib/utils";

interface MentionAutocompleteProps {
  models: AiModel[];
  activeIndex: number;
  onSelect: (model: AiModel) => void;
  onActiveIndexChange?: (index: number) => void;
}

export function MentionAutocomplete({
  models,
  activeIndex,
  onSelect,
  onActiveIndexChange,
}: MentionAutocompleteProps) {
  if (models.length === 0) {
    return (
      <div className="border-border bg-panel text-muted rounded-lg border p-3 text-xs shadow-lg">
        Add models to your Model Cart first
      </div>
    );
  }

  return (
    <ul
      className="border-border bg-panel max-h-48 overflow-y-auto rounded-lg border py-1 shadow-lg"
      role="listbox"
    >
      {models.map((model, index) => (
        <li key={model.id} role="option" aria-selected={index === activeIndex}>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onMouseEnter={() => onActiveIndexChange?.(index)}
            onClick={(e) => {
              e.preventDefault();
              onSelect(model);
            }}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
              index === activeIndex
                ? "bg-panel-elevated text-foreground outline outline-1 outline-offset-[-1px] outline-foreground"
                : "hover:bg-panel-elevated",
            )}
          >
            <ModelLogo orgId={model.orgId} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{model.name}</span>
              <span className="text-muted block truncate text-xs">
                @{model.id}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
