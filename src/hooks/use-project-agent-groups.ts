import { useMemo } from "react";
import { useChats } from "@/contexts/ChatsContext";
import {
  collectActiveAgentsByProject,
  type ProjectAgentGroup,
} from "@/lib/agent-settings-summary";
import { sortWorkspaces } from "@/lib/chat-utils";

/** Active agents grouped by project, including the active chat. */
export function useProjectAgentGroups(): ProjectAgentGroup[] {
  const { chats, activeChat } = useChats();
  return useMemo(() => {
    const byId = new Map(chats.map((chat) => [chat.id, chat]));
    if (activeChat && !byId.has(activeChat.id)) {
      byId.set(activeChat.id, activeChat);
    }
    return collectActiveAgentsByProject(sortWorkspaces([...byId.values()]));
  }, [activeChat, chats]);
}
