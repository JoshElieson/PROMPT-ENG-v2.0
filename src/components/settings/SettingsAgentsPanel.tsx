import { useMemo, useState } from "react";
import { Bot, ChevronRight, MessageSquare, Search, X } from "lucide-react";
import { ChatSettingsDialog } from "@/components/chat/ChatSettingsDialog";
import { useChats } from "@/contexts/ChatsContext";
import {
  collectActiveAgentsByProject,
  type ProjectAgentGroup,
} from "@/lib/agent-settings-summary";
import { sortWorkspaces } from "@/lib/chat-utils";
import { cn } from "@/lib/utils";

function AgentRow({
  name,
  promptSummary,
  permissionsSummary,
  messageCount,
  threadId,
  onOpen,
}: {
  name: string;
  promptSummary: string;
  permissionsSummary: string;
  messageCount: number;
  threadId: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      data-ai-target={`settings.agents.row.${threadId}`}
      className={cn(
        "border-border-subtle bg-panel/60 hover:bg-panel-elevated/70 group flex w-full cursor-pointer flex-col gap-1.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
      )}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Bot className="text-muted-foreground h-3.5 w-3.5 shrink-0 opacity-80" />
          <span className="truncate text-sm font-medium text-foreground">
            {name}
          </span>
        </div>
        <ChevronRight className="text-muted-foreground/60 group-hover:text-muted-foreground h-3.5 w-3.5 shrink-0 transition-colors" />
      </div>
      <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
        {promptSummary}
      </p>
      <div className="text-muted-foreground/80 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px]">
        <span>{permissionsSummary}</span>
        <span className="inline-flex items-center gap-1">
          <MessageSquare className="h-2.5 w-2.5" aria-hidden />
          {messageCount === 1 ? "1 message" : `${messageCount} messages`}
        </span>
      </div>
    </button>
  );
}

export function SettingsAgentsPanel() {
  const { chats, activeChat } = useChats();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<{
    chatId: string;
    threadId: string;
  } | null>(null);

  const projectGroups = useMemo(() => {
    const byId = new Map(chats.map((chat) => [chat.id, chat]));
    if (activeChat && !byId.has(activeChat.id)) {
      byId.set(activeChat.id, activeChat);
    }
    return collectActiveAgentsByProject(sortWorkspaces([...byId.values()]));
  }, [activeChat, chats]);

  const filteredProjectGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return projectGroups;

    return projectGroups
      .map((group) => {
        const projectMatches = group.projectName.toLowerCase().includes(query);
        const agents = projectMatches
          ? group.agents
          : group.agents.filter((agent) =>
              agent.summary.name.toLowerCase().includes(query),
            );
        if (agents.length === 0) return null;
        return { ...group, agents };
      })
      .filter((group): group is ProjectAgentGroup => group != null);
  }, [projectGroups, searchQuery]);

  const totalAgents = useMemo(
    () => projectGroups.reduce((count, group) => count + group.agents.length, 0),
    [projectGroups],
  );

  const trimmedSearch = searchQuery.trim();

  return (
    <>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div
          className="border-border-subtle bg-panel/80 flex h-9 items-center gap-2 rounded-lg border px-3"
          data-ai-target="settings.agents.search"
        >
          <Search className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search agents or projects"
            className="placeholder:text-muted-foreground/70 text-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          {trimmedSearch ? (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-muted-foreground hover:text-foreground flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        {totalAgents === 0 ? (
          <div className="border-border-subtle bg-panel/60 flex flex-col items-center justify-center rounded-xl border px-6 py-16 text-center">
            <Bot className="text-muted-foreground mb-3 h-8 w-8 opacity-60" />
            <p className="text-sm font-medium text-foreground">No active agents</p>
            <p className="text-muted-foreground mt-1 max-w-xs text-xs leading-relaxed">
              Open a project and add an agent to configure it here.
            </p>
          </div>
        ) : filteredProjectGroups.length === 0 ? (
          <div className="border-border-subtle bg-panel/60 flex flex-col items-center justify-center rounded-xl border px-6 py-16 text-center">
            <Search className="text-muted-foreground mb-3 h-8 w-8 opacity-60" />
            <p className="text-sm font-medium text-foreground">No matching agents</p>
            <p className="text-muted-foreground mt-1 max-w-xs text-xs leading-relaxed">
              Try a different agent or project name.
            </p>
          </div>
        ) : (
          filteredProjectGroups.map((group) => (
            <section key={group.chatId} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2 px-0.5">
                <h2 className="truncate text-sm font-medium text-foreground">
                  {group.projectName}
                </h2>
                <span className="text-muted-foreground shrink-0 text-[10px]">
                  {group.agents.length === 1
                    ? "1 agent"
                    : `${group.agents.length} agents`}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {group.agents.map((agent) => (
                  <AgentRow
                    key={agent.threadId}
                    threadId={agent.threadId}
                    name={agent.summary.name}
                    promptSummary={agent.summary.promptSummary}
                    permissionsSummary={agent.summary.permissionsSummary}
                    messageCount={agent.summary.messageCount}
                    onOpen={() =>
                      setSelectedAgent({
                        chatId: agent.chatId,
                        threadId: agent.threadId,
                      })
                    }
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      {selectedAgent ? (
        <ChatSettingsDialog
          chatId={selectedAgent.chatId}
          threadId={selectedAgent.threadId}
          onClose={() => setSelectedAgent(null)}
        />
      ) : null}
    </>
  );
}
