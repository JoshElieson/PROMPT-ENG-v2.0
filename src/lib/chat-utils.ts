import type { Chat } from "@/types/chat";

export function formatChatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function titleFromMessage(content: string): string {
  const line = content.trim().split(/\r?\n/)[0] ?? "";
  if (!line) return "New Chat";
  return line.length > 48 ? `${line.slice(0, 48)}…` : line;
}

function startOfDay(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export interface GroupedChats {
  today: Chat[];
  yesterday: Chat[];
  older: Chat[];
}

export function groupChatsByDate(chats: Chat[]): GroupedChats {
  const now = new Date();
  const todayStart = startOfDay(now);
  const yesterdayStart = todayStart - 86_400_000;

  const sorted = [...chats].sort((a, b) => b.updatedAt - a.updatedAt);

  const today: Chat[] = [];
  const yesterday: Chat[] = [];
  const older: Chat[] = [];

  for (const chat of sorted) {
    const t = chat.updatedAt;
    if (t >= todayStart) {
      today.push(chat);
    } else if (t >= yesterdayStart) {
      yesterday.push(chat);
    } else {
      older.push(chat);
    }
  }

  return { today, yesterday, older };
}
