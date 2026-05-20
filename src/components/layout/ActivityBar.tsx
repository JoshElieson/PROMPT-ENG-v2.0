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
        "relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg transition-colors",
        active
          ? "text-accent"
          : "text-muted-foreground hover:bg-panel-elevated/60",
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 bg-accent" />
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
    <aside className="flex w-12 shrink-0 flex-col items-center border-r border-border-subtle bg-surface py-3">
      <div className="flex flex-col gap-1">
        <ActivityButton
          title="Model Cart"
          active={activeView === "agents"}
          onClick={() => {
            onViewChange("agents");
            selectWorkspaceScreen();
          }}
        >
          <Bot className="h-4 w-4" />
        </ActivityButton>
        <ActivityButton
          title="Chats & Projects"
          active={activeView === "explorer" || explorerSidebarSelected}
          onClick={() => {
            onViewChange("explorer");
            selectChatList();
          }}
        >
          <MessageSquare className="h-4 w-4" />
        </ActivityButton>
        <ActivityButton
          title={scTitle}
          active={activeView === "git"}
          onClick={() => {
            onViewChange("git");
            selectWorkspaceScreen();
          }}
        >
          <SourceControlIcon className="h-4 w-4" changeCount={changeCount} />
        </ActivityButton>
      </div>

      <div className="mt-auto flex flex-col items-center gap-2">
        <button
          type="button"
          title="Settings"
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-panel-elevated hover:text-foreground"
        >
          <Settings className="h-4 w-4" />
        </button>
        <AccountMenu />
      </div>
    </aside>
  );
}
