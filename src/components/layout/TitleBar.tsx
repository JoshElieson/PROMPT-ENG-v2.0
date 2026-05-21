import { useEffect, useState } from "react";
import { Minus, Square, X } from "lucide-react";
import { defaultWindowIcon } from "@tauri-apps/api/app";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ForgeWordmark } from "@/components/brand/ForgeWordmark";
import { MenuBar } from "@/components/layout/MenuBar";
import { isTauri } from "@/lib/tauri";
import { startWindowDrag, tauriDragRegionProps } from "@/lib/window-drag";
import { cn } from "@/lib/utils";

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const tauri = isTauri();

  useEffect(() => {
    if (!tauri) return;

    const appWindow = getCurrentWindow();

    void appWindow.setTheme("dark");
    void defaultWindowIcon().then((icon) => {
      if (icon) void appWindow.setIcon(icon);
    });
    void appWindow.isMaximized().then(setIsMaximized);

    const unlistenPromise = appWindow.onResized(() => {
      void appWindow.isMaximized().then(setIsMaximized);
    });

    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [tauri]);

  const appWindow = tauri ? getCurrentWindow() : null;

  return (
    <header
      className={cn(
        "flex h-8 shrink-0 select-none items-stretch",
        "border-0 border-b border-border-subtle bg-surface/95 text-foreground backdrop-blur-sm",
      )}
    >
      <div
        className="flex min-w-0 flex-1 items-center"
        {...tauriDragRegionProps()}
        onMouseDown={startWindowDrag}
      >
        <span className="ml-1 flex shrink-0 items-center rounded-md px-2.5 opacity-85">
          <ForgeWordmark height={12} />
        </span>
        <MenuBar className="shrink-0" />
        <div className="min-w-0 flex-1" />
      </div>

      {tauri && appWindow && (
        <div className="flex shrink-0 items-stretch">
          <button
            type="button"
            title="Minimize"
            onClick={() => void appWindow.minimize()}
            className="text-muted-foreground hover:bg-panel-elevated/85 hover:text-foreground inline-flex w-11 items-center justify-center transition-colors"
          >
            <Minus className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
          <button
            type="button"
            title={isMaximized ? "Restore" : "Maximize"}
            onClick={() => void appWindow.toggleMaximize()}
            className="text-muted-foreground hover:bg-panel-elevated/85 hover:text-foreground inline-flex w-11 items-center justify-center transition-colors"
          >
            <Square className="h-3 w-3" strokeWidth={2} />
          </button>
          <button
            type="button"
            title="Close"
            onClick={() => void appWindow.close()}
            className="text-muted-foreground inline-flex w-11 items-center justify-center transition-colors hover:bg-red-600 hover:text-white"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
      )}
    </header>
  );
}
