export interface ChatItem {
  id: string;
  title: string;
  time: string;
  active?: boolean;
}

export const chatHistory = {
  today: [
    { id: "1", title: "Optimize Rust Function", time: "2:30 AM", active: true },
    { id: "2", title: "TypeScript Refactor", time: "1:15 AM" },
  ] as ChatItem[],
  yesterday: [
    { id: "3", title: "API Design Review", time: "11:42 PM" },
    { id: "4", title: "Prompt Template Draft", time: "9:20 PM" },
  ] as ChatItem[],
};

export const keyboardShortcuts = [
  { keys: "⌘ 1", label: "GPT-4o" },
  { keys: "⌘ 2", label: "Claude 3.5" },
  { keys: "⌘ 3", label: "Gemini 1.5" },
  { keys: "⌘ 4", label: "Mix (Round Table)" },
  { keys: "/", label: "Commands" },
  { keys: "@", label: "Add Context" },
];
