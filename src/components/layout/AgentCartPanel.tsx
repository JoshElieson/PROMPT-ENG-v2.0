import { ShoppingCart } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { popularAiModels, useRoundTable } from "@/context/RoundTableContext";
import { cn } from "@/lib/utils";

function ModelCartItem({
  name,
  provider,
  role,
  color,
  initial,
  selected,
  onToggle,
}: {
  name: string;
  provider: string;
  role: string;
  color: string;
  initial: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors",
        selected
          ? "border-accent/40 bg-accent-muted"
          : "border-transparent hover:border-border-subtle hover:bg-panel-elevated",
      )}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="mt-1 h-3.5 w-3.5 shrink-0 rounded border-border bg-panel accent-accent"
      />
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
        style={{ backgroundColor: color }}
      >
        {initial}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{name}</span>
          <span className="shrink-0 rounded bg-panel-elevated px-1.5 py-0.5 text-[10px] text-muted">
            {provider}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted">{role}</span>
      </span>
    </label>
  );
}

export function AgentCartPanel() {
  const { selectedIds, isSelected, toggleModel } = useRoundTable();

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-border-subtle px-3 py-3">
        <section className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold">Model Cart</h2>
        </section>
        <p className="mt-1 text-xs text-muted">
          Check models to add them to the Round Table
        </p>
      </header>

      <ScrollArea className="flex-1">
        <section className="space-y-1 p-2">
          {popularAiModels.map((model) => (
            <ModelCartItem
              key={model.id}
              {...model}
              selected={isSelected(model.id)}
              onToggle={() => toggleModel(model.id)}
            />
          ))}
        </section>
      </ScrollArea>

      <footer className="shrink-0 border-t border-border-subtle px-3 py-2.5">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{selectedIds.length}</span>
          {selectedIds.length === 1 ? " model" : " models"} in Round Table
        </p>
      </footer>
    </section>
  );
}
