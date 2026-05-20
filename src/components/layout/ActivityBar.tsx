import { Bot, MessageSquare, Settings } from "lucide-react";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { SourceControlIcon } from "@/components/git/SourceControlIcon";
import { useAppSelection } from "@/contexts/AppSelectionContext";
import { useGit } from "@/contexts/GitContext";
import { getGitChangeCount } from "@/lib/git-utils";
import { cn } from "@/lib/utils";

export type SidebarView = "explorer" | "agents" | "git";

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
        "relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-transparent transition-all duration-150",
        active
          ? "border-[#6366f1]/28 bg-[#6366f1]/12 text-foreground shadow-[inset_0_0_0_1px_rgba(99,102,241,0.16)]"
          : "text-muted-foreground hover:border-border hover:bg-panel-elevated/70 hover:text-foreground",
      )}
    >
      {active && (
        <span className="absolute left-1/2 top-1 h-0.5 w-3 -translate-x-1/2 rounded-full bg-[#6366f1]/75" />
      )}
      {children}
    </button>
  );
}

export function ActivityBar({ activeView, onViewChange }: ActivityBarProps) {
  const { status } = useGit();
  const {
    isProjectsSelected,
    isChatListSelected,
    selectChatList,
    selectWorkspaceScreen,
  } = useAppSelection();
  const changeCount = getGitChangeCount(status);
  const explorerSidebarSelected =
    isProjectsSelected || isChatListSelected;
  const scTitle =
    changeCount > 0
      ? `Source Control (${changeCount} change${changeCount === 1 ? "" : "s"})`
      : "Source Control";

  return (
    <aside className="flex w-12 shrink-0 flex-col items-center border-r border-border-subtle bg-surface/90 py-3 backdrop-blur-sm">
      <div className="flex flex-col gap-1.5">
        <ActivityButton
          title="Model Cart"
          active={activeView === "agents"}
          onClick={() => {
            onViewChange("agents");
            selectWorkspaceScreen();
          }}
        >
          <Bot className="h-3.5 w-3.5" />
        </ActivityButton>
        <ActivityButton
          title="Workspaces"
          active={activeView === "explorer" || explorerSidebarSelected}
          onClick={() => {
            onViewChange("explorer");
            selectChatList();
          }}
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </ActivityButton>
        <ActivityButton
          title={scTitle}
          active={activeView === "git"}
          onClick={() => {
            onViewChange("git");
            selectWorkspaceScreen();
          }}
        >
          <SourceControlIcon className="h-3.5 w-3.5" changeCount={changeCount} />
        </ActivityButton>
      </div>

      <div className="mt-auto flex flex-col items-center gap-2">
        <button
          type="button"
          title="Settings"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-transparent text-muted-foreground transition-all duration-150 hover:border-border hover:bg-panel-elevated/70 hover:text-foreground"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>
        <AccountMenu />
      </div>
    </aside>
  );
}
