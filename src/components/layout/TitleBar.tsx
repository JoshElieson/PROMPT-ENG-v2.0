import { useEffect, useState } from "react";
import { Minus, Square, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "@/lib/tauri";
import { cn } from "@/lib/utils";

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;

    const appWindow = getCurrentWindow();

    void appWindow.setTheme("dark");
    void appWindow.isMaximized().then(setIsMaximized);

    const unlistenPromise = appWindow.onResized(() => {
      void appWindow.isMaximized().then(setIsMaximized);
    });

    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  if (!isTauri()) return null;

  const appWindow = getCurrentWindow();

  return (
    <header
      className={cn(
        "flex h-8 shrink-0 select-none items-stretch",
        "border-b border-border-subtle bg-black text-foreground",
      )}
    >
      <div
        data-tauri-drag-region
        className="flex min-w-0 flex-1 items-center gap-2 px-3"
      >
        <span className="text-xs font-semibold tracking-wide text-foreground/90">
          Prompt
        </span>
      </div>

      <div className="flex shrink-0 items-stretch">
        <button
          type="button"
          title="Minimize"
          onClick={() => void appWindow.minimize()}
          className="inline-flex w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-panel-elevated hover:text-foreground"
        >
          <Minus className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
        <button
          type="button"
          title={isMaximized ? "Restore" : "Maximize"}
          onClick={() => void appWindow.toggleMaximize()}
          className="inline-flex w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-panel-elevated hover:text-foreground"
        >
          <Square className="h-3 w-3" strokeWidth={2} />
        </button>
        <button
          type="button"
          title="Close"
          onClick={() => void appWindow.close()}
          className="inline-flex w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-red-600 hover:text-white"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>
    </header>
  );
}
