import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

type AppToastTone = "success" | "error" | "info";

interface AppToast {
  id: string;
  message: string;
  tone: AppToastTone;
}

interface AppToastContextValue {
  pushToast: (message: string, tone?: AppToastTone) => void;
}

const AppToastContext = createContext<AppToastContextValue | null>(null);

export function AppToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<AppToast[]>([]);

  const pushToast = useCallback((message: string, tone: AppToastTone = "info") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3200);
  }, []);

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  return (
    <AppToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[250] flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "rounded-lg border px-3 py-2 text-sm shadow-[0_14px_28px_rgba(2,6,23,0.38)] backdrop-blur-sm",
              "animate-in fade-in slide-in-from-bottom-2 duration-200",
              toast.tone === "success" &&
                "border-emerald-400/35 bg-emerald-500/12 text-emerald-100",
              toast.tone === "error" && "border-red-400/35 bg-red-500/12 text-red-100",
              toast.tone === "info" && "border-indigo-400/35 bg-indigo-500/12 text-indigo-100",
            )}
            role="status"
            aria-live="polite"
          >
            {toast.message}
          </div>
        ))}
      </div>
    </AppToastContext.Provider>
  );
}

export function useAppToast() {
  const ctx = useContext(AppToastContext);
  if (!ctx) {
    throw new Error("useAppToast must be used within AppToastProvider");
  }
  return ctx;
}

