import { Bot, MessageSquare, Settings, User } from "lucide-react";
import { cn } from "@/lib/utils";

export type SidebarView = "explorer" | "agents";

interface ActivityBarProps {
  activeView: SidebarView;
  onViewChange: (view: SidebarView) => void;
}

function ActivityButton({
  title,
  active,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "relative flex h-9 w-9 items-center justify-center text-muted-foreground transition-colors",
        active
          ? "border border-foreground bg-panel-elevated text-foreground"
          : "border border-transparent hover:bg-panel-elevated hover:text-foreground",
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 bg-foreground" />
      )}
      {children}
    </button>
  );
}

export function ActivityBar({ activeView, onViewChange }: ActivityBarProps) {
  return (
    <aside className="flex w-12 shrink-0 flex-col items-center border-r border-border-subtle bg-surface py-3">
      <div className="flex flex-col gap-1">
        <ActivityButton
          title="Model Cart"
          active={activeView === "agents"}
          onClick={() => onViewChange("agents")}
        >
          <Bot className="h-4 w-4" />
        </ActivityButton>
        <ActivityButton
          title="Chats & Projects"
          active={activeView === "explorer"}
          onClick={() => onViewChange("explorer")}
        >
          <MessageSquare className="h-4 w-4" />
        </ActivityButton>
      </div>

      <div className="mt-auto flex flex-col items-center gap-2">
        <button
          type="button"
          title="Settings"
          className="flex h-9 w-9 items-center justify-center text-muted-foreground transition-colors hover:bg-panel-elevated hover:text-foreground"
        >
          <Settings className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Profile"
          className="relative flex h-9 w-9 items-center justify-center text-muted-foreground transition-colors hover:bg-panel-elevated hover:text-foreground"
        >
          <User className="h-4 w-4" />
          <span className="absolute bottom-1.5 right-1.5 h-2 w-2 rounded-full bg-success ring-2 ring-surface" />
        </button>
      </div>
    </aside>
  );
}
