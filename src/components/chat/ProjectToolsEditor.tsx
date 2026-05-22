import { X } from "lucide-react";
import { useCallback, useState, type KeyboardEvent } from "react";
import {
  dedupeProjectTools,
  normalizeToolName,
} from "@/lib/project-tools";
import { cn } from "@/lib/utils";

type ProjectToolsEditorProps = {
  tools: string[];
  onChange: (tools: string[]) => void;
  className?: string;
};

export function ProjectToolsEditor({
  tools,
  onChange,
  className,
}: ProjectToolsEditorProps) {
  const [draft, setDraft] = useState("");

  const addTool = useCallback(
    (raw: string) => {
      const name = normalizeToolName(raw);
      if (!name) return;
      onChange(dedupeProjectTools([...tools, name]));
      setDraft("");
    },
    [onChange, tools],
  );

  const onDraftKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTool(draft);
      return;
    }
    if (event.key === "Backspace" && !draft && tools.length > 0) {
      onChange(tools.slice(0, -1));
    }
  };

  const removeTool = (name: string) => {
    const key = name.toLowerCase();
    onChange(tools.filter((tool) => tool.toLowerCase() !== key));
  };

  return (
    <div
      className={cn(
        "rounded-md border border-border/60 bg-panel-elevated/80 px-2 py-1.5",
        className,
      )}
    >
      {tools.length > 0 ? (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {tools.map((tool) => (
            <span
              key={tool.toLowerCase()}
              className="inline-flex max-w-full items-center gap-0.5 rounded-md border border-border/50 bg-panel/90 px-1.5 py-0.5 text-[11px] text-foreground/90"
            >
              <span className="truncate">{tool}</span>
              <button
                type="button"
                onClick={() => removeTool(tool)}
                className="text-muted-foreground hover:text-foreground shrink-0 rounded-sm p-0.5 transition-colors"
                aria-label={`Remove ${tool}`}
              >
                <X className="h-2.5 w-2.5" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onDraftKeyDown}
        onBlur={() => addTool(draft)}
        placeholder="C, Vercel, Supabase… press Enter"
        className="h-7 w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/55"
      />
    </div>
  );
}
