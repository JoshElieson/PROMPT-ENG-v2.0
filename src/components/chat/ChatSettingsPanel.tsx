import { ChevronDown, Info } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { FileContextEditor } from "@/components/chat/FileContextEditor";
import { ProjectToolsEditor } from "@/components/chat/ProjectToolsEditor";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useChats } from "@/contexts/ChatsContext";
import {
  QUEUED_MESSAGE_BEHAVIOR_OPTIONS,
  resolveAutoScrollEnabled,
  resolveQueuedMessageBehavior,
} from "@/lib/chat-behavior";
import { resolveAgentPermissions } from "@/lib/agent-permissions";
import { dedupeProjectTools } from "@/lib/project-tools";
import type { QueuedMessageBehavior } from "@/types/chat-behavior";
import {
  DEFAULT_AGENT_SYSTEM_PROMPT,
  DEFAULT_WORKSPACE_TITLE,
  defaultThreadTitle,
  isPlaceholderWorkspaceTitle,
  threadDisplayTitle,
  workspaceDisplayTitle,
} from "@/lib/chat-utils";
import {
  AGENT_PERMISSION_OPTIONS,
  DEFAULT_AGENT_PERMISSIONS,
} from "@/types/agent-permissions";
import type { AgentPermissions } from "@/types/agent-permissions";
import { cn } from "@/lib/utils";

type ChatSettingsPanelProps = {
  chatId: string;
  threadId: string;
};

export function ChatSettingsPanel({ chatId, threadId }: ChatSettingsPanelProps) {
  const { chats, activeChat, patchAgentSettings, patchWorkspaceSettings } =
    useChats();

  const chat = useMemo(() => {
    if (activeChat?.id === chatId) return activeChat;
    return chats.find((c) => c.id === chatId) ?? null;
  }, [activeChat, chatId, chats]);

  const thread = useMemo(
    () => chat?.threads.find((t) => t.id === threadId) ?? null,
    [chat, threadId],
  );
  const threadIndex = useMemo(
    () => chat?.threads.findIndex((t) => t.id === threadId) ?? 0,
    [chat, threadId],
  );

  const defaultAgentName = thread
    ? threadDisplayTitle(thread, threadIndex)
    : defaultThreadTitle(0);

  const [agentName, setAgentName] = useState(() =>
    thread ? threadDisplayTitle(thread, threadIndex) : defaultThreadTitle(0),
  );
  const [systemPrompt, setSystemPrompt] = useState(
    () => thread?.systemPrompt?.trim() ?? "",
  );
  const [agentPermissions, setAgentPermissions] = useState<AgentPermissions>(
    () => resolveAgentPermissions(thread),
  );
  const [projectName, setProjectName] = useState(() =>
    workspaceDisplayTitle(chat?.title),
  );
  const [projectDescription, setProjectDescription] = useState(
    () => chat?.projectDescription?.trim() ?? "",
  );
  const [projectTools, setProjectTools] = useState(() =>
    dedupeProjectTools(chat?.projectTools ?? []),
  );
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(() =>
    resolveAutoScrollEnabled(chat),
  );
  const [queuedMessageBehavior, setQueuedMessageBehavior] =
    useState<QueuedMessageBehavior>(() => resolveQueuedMessageBehavior(chat));

  const persistAgentName = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      const isDefault = !trimmed || trimmed === defaultAgentName;
      patchAgentSettings(chatId, threadId, {
        title: isDefault ? "" : trimmed,
      });
      if (isDefault) setAgentName(defaultAgentName);
    },
    [chatId, defaultAgentName, patchAgentSettings, threadId],
  );

  const persistSystemPrompt = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      const isDefault =
        !trimmed || trimmed === DEFAULT_AGENT_SYSTEM_PROMPT;
      patchAgentSettings(chatId, threadId, {
        systemPrompt: isDefault ? "" : trimmed,
      });
    },
    [chatId, patchAgentSettings, threadId],
  );

  const persistAgentPermissions = useCallback(
    (value: AgentPermissions) => {
      patchAgentSettings(chatId, threadId, { agentPermissions: value });
    },
    [chatId, patchAgentSettings, threadId],
  );

  const allowAllPermissions = useCallback(() => {
    const next = { ...DEFAULT_AGENT_PERMISSIONS };
    setAgentPermissions(next);
    persistAgentPermissions(next);
  }, [persistAgentPermissions]);

  const persistProjectName = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed || isPlaceholderWorkspaceTitle(trimmed)) {
        setProjectName(workspaceDisplayTitle(chat?.title));
        return;
      }
      patchWorkspaceSettings(chatId, { title: trimmed });
    },
    [chat?.title, chatId, patchWorkspaceSettings],
  );

  const persistProjectDescription = useCallback(
    (value: string) => {
      patchWorkspaceSettings(chatId, { projectDescription: value });
    },
    [chatId, patchWorkspaceSettings],
  );

  const persistProjectTools = useCallback(
    (value: string[]) => {
      patchWorkspaceSettings(chatId, { projectTools: value });
    },
    [chatId, patchWorkspaceSettings],
  );

  const persistAutoScroll = useCallback(
    (value: boolean) => {
      patchWorkspaceSettings(chatId, { autoScrollEnabled: value });
    },
    [chatId, patchWorkspaceSettings],
  );

  const persistQueuedMessageBehavior = useCallback(
    (value: QueuedMessageBehavior) => {
      patchWorkspaceSettings(chatId, { queuedMessageBehavior: value });
    },
    [chatId, patchWorkspaceSettings],
  );

  return (
    <section className="min-h-0 space-y-3 overflow-y-auto p-3">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold tracking-wide text-[#a5b4fc] uppercase">
          Agent
        </p>
        <label className="block space-y-1">
          <span className="text-muted-foreground text-[11px]">Agent Name</span>
          <input
            value={agentName}
            placeholder={defaultAgentName}
            data-ai-target="chat.settings.agent-name"
            onChange={(e) => setAgentName(e.target.value)}
            onBlur={() => persistAgentName(agentName)}
            className="h-8 w-full rounded-md border border-border/60 bg-panel-elevated/80 px-2 text-xs text-foreground outline-none transition-colors focus:border-[#6366f1]/60"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-muted-foreground text-[11px]">System Prompt</span>
          <textarea
            value={systemPrompt}
            placeholder={DEFAULT_AGENT_SYSTEM_PROMPT}
            data-ai-target="chat.settings.agent-system-prompt"
            onChange={(e) => setSystemPrompt(e.target.value)}
            onBlur={() => persistSystemPrompt(systemPrompt)}
            rows={3}
            className="w-full resize-none rounded-md border border-border/60 bg-panel-elevated/80 px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/55 outline-none transition-colors focus:border-[#6366f1]/60"
          />
        </label>
        <div className="space-y-1 pt-0.5">
          <p className="text-muted-foreground text-[11px]">Permissions</p>
          <div className="flex items-start justify-between gap-2">
            <p className="text-muted-foreground text-[10px] leading-snug">
              We recommend you allow all permissions for the best experience
            </p>
            <button
              type="button"
              onClick={allowAllPermissions}
              className="shrink-0 text-[10px] font-medium text-[#6366f1] transition-colors hover:text-[#818cf8]"
            >
              Allow all
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 rounded-md border border-border/45 bg-panel-elevated/35 p-2">
            {AGENT_PERMISSION_OPTIONS.map((option) => (
              <div
                key={option.key}
                className="flex min-w-0 items-center justify-between gap-1"
              >
                <div className="flex min-w-0 items-center gap-0.5">
                  <span className="truncate text-xs text-foreground/90">
                    {option.label}
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="text-muted-foreground/80 hover:text-muted-foreground flex h-4 w-4 shrink-0 items-center justify-center rounded-sm transition-colors"
                        aria-label={`About ${option.label}`}
                      >
                        <Info className="h-3 w-3" aria-hidden />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      className="max-w-[13rem] text-[11px] leading-snug"
                    >
                      {option.description}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Switch
                  checked={agentPermissions[option.key]}
                  onCheckedChange={(checked) => {
                    const next = {
                      ...agentPermissions,
                      [option.key]: checked,
                    };
                    setAgentPermissions(next);
                    persistAgentPermissions(next);
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2 border-t border-border/45 pt-2">
        <p className="text-[11px] font-semibold tracking-wide text-[#a5b4fc] uppercase">
          Project
        </p>
        <label className="block space-y-1">
          <span className="text-muted-foreground text-[11px]">Project Name</span>
          <input
            value={projectName}
            placeholder={DEFAULT_WORKSPACE_TITLE}
            data-ai-target="chat.settings.project-name"
            onChange={(e) => setProjectName(e.target.value)}
            onBlur={() => persistProjectName(projectName)}
            className="h-8 w-full rounded-md border border-border/60 bg-panel-elevated/80 px-2 text-xs text-foreground placeholder:text-muted-foreground/55 outline-none transition-colors focus:border-[#6366f1]/60"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-muted-foreground text-[11px]">
            Project Description
          </span>
          <textarea
            value={projectDescription}
            placeholder="What is this project? Goals, stack, constraints…"
            onChange={(e) => setProjectDescription(e.target.value)}
            onBlur={() => persistProjectDescription(projectDescription)}
            rows={3}
            className="w-full resize-none rounded-md border border-border/60 bg-panel-elevated/80 px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/55 outline-none transition-colors focus:border-[#6366f1]/60"
          />
        </label>
        <div className="block space-y-1">
          <span className="text-muted-foreground text-[11px]">Project Tools</span>
          <ProjectToolsEditor
            tools={projectTools}
            onChange={(next) => {
              setProjectTools(next);
              persistProjectTools(next);
            }}
          />
        </div>
        <div className="block space-y-1">
          <span className="text-muted-foreground text-[11px]">File Context</span>
          <FileContextEditor chatId={chatId} permissions={chat?.permissions} />
        </div>
      </div>

      <div className="space-y-2 border-t border-border/45 pt-2">
        <p className="text-[11px] font-semibold tracking-wide text-[#a5b4fc] uppercase">
          Chat Behavior
        </p>
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border/45 bg-panel-elevated/35 px-2.5 py-2">
          <div className="min-w-0">
            <p className="text-xs text-foreground/90">Auto scroll</p>
            <p className="text-muted-foreground text-[10px] leading-snug">
              Follow new messages while the agent responds
            </p>
          </div>
          <Switch
            checked={autoScrollEnabled}
            onCheckedChange={(checked) => {
              setAutoScrollEnabled(checked);
              persistAutoScroll(checked);
            }}
          />
        </div>
        <div className="space-y-1 rounded-lg border border-border/45 bg-panel-elevated/35 px-2.5 py-2">
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 text-xs text-foreground/90">
              Queued message behavior
            </p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex h-7 w-40 shrink-0 items-center justify-between gap-1.5 rounded-lg border border-border/60",
                    "bg-panel-elevated/80 px-2 text-[11px] text-foreground shadow-[0_4px_14px_rgba(2,6,23,0.18)]",
                    "outline-none transition-colors hover:border-border-subtle",
                    "focus-visible:border-[#6366f1]/60 focus-visible:ring-1 focus-visible:ring-[#6366f1]/25",
                    "data-[state=open]:border-[#6366f1]/50 data-[state=open]:ring-1 data-[state=open]:ring-[#6366f1]/20",
                  )}
                  aria-label="Queued message behavior"
                >
                  <span className="min-w-0 flex-1 truncate text-left">
                    {
                      QUEUED_MESSAGE_BEHAVIOR_OPTIONS.find(
                        (o) => o.value === queuedMessageBehavior,
                      )?.label
                    }
                  </span>
                  <ChevronDown
                    className="h-3 w-3 shrink-0 text-muted-foreground/80"
                    aria-hidden
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={6}
                className="min-w-[var(--radix-dropdown-menu-trigger-width)] p-1.5"
              >
                <DropdownMenuRadioGroup
                  value={queuedMessageBehavior}
                  onValueChange={(value) => {
                    const next = value as QueuedMessageBehavior;
                    setQueuedMessageBehavior(next);
                    persistQueuedMessageBehavior(next);
                  }}
                >
                  {QUEUED_MESSAGE_BEHAVIOR_OPTIONS.map((option) => (
                    <DropdownMenuRadioItem
                      key={option.value}
                      value={option.value}
                      className="rounded-md py-2 text-xs leading-snug"
                    >
                      {option.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <p className="text-muted-foreground text-[10px] leading-snug">
            {
              QUEUED_MESSAGE_BEHAVIOR_OPTIONS.find(
                (o) => o.value === queuedMessageBehavior,
              )?.description
            }
          </p>
        </div>
      </div>
    </section>
  );
}
