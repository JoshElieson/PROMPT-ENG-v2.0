import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { isTauri } from "@/lib/tauri";

export interface BrowserWebviewBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BrowserNavigatedEvent {
  id: string;
  url: string;
  canGoBack: boolean;
  canGoForward: boolean;
}

export function canUseEmbeddedBrowser(): boolean {
  return isTauri();
}

export async function openBrowserWebview(
  tabId: string,
  url: string,
  bounds: BrowserWebviewBounds,
): Promise<void> {
  await invoke("browser_webview_open", { id: tabId, url, bounds });
}

export async function navigateBrowserWebview(
  tabId: string,
  url: string,
): Promise<void> {
  await invoke("browser_webview_navigate", { id: tabId, url });
}

export async function goBackBrowserWebview(tabId: string): Promise<void> {
  await invoke("browser_webview_go_back", { id: tabId });
}

export async function goForwardBrowserWebview(tabId: string): Promise<void> {
  await invoke("browser_webview_go_forward", { id: tabId });
}

export async function reloadBrowserWebview(tabId: string): Promise<void> {
  await invoke("browser_webview_reload", { id: tabId });
}

export async function setBrowserWebviewBounds(
  tabId: string,
  bounds: BrowserWebviewBounds,
): Promise<void> {
  await invoke("browser_webview_set_bounds", { id: tabId, bounds });
}

export async function setBrowserWebviewVisible(
  tabId: string,
  visible: boolean,
): Promise<void> {
  await invoke("browser_webview_set_visible", { id: tabId, visible });
}

export async function closeBrowserWebview(tabId: string): Promise<void> {
  if (!isTauri()) return;
  await invoke("browser_webview_close", { id: tabId });
}

export async function listenBrowserNavigated(
  handler: (event: BrowserNavigatedEvent) => void,
): Promise<UnlistenFn> {
  return listen<BrowserNavigatedEvent>("browser-navigated", (event) => {
    handler(event.payload);
  });
}

export async function evaluateBrowserWebview(
  tabId: string,
  js: string,
): Promise<string> {
  const executionId = Math.random().toString(36).substring(2, 9);

  const wrapped = `
    (async () => {
      try {
        const res = await (async () => { return (${js}); })();
        const strRes = typeof res === "object" ? JSON.stringify(res) : String(res);
        window.location.href = "https://forge-eval.local/success/${executionId}?data=" + encodeURIComponent(strRes);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        window.location.href = "https://forge-eval.local/error/${executionId}?data=" + encodeURIComponent(errMsg);
      }
    })();
  `;

  return new Promise<string>((resolve, reject) => {
    let unlisten: (() => void) | null = null;

    const setupListener = async () => {
      unlisten = await listenBrowserNavigated((event) => {
        if (event.id !== tabId) return;
        if (event.url.includes("forge-eval.local")) {
          try {
            const isSuccess = event.url.includes("/success/");
            const isError = event.url.includes("/error/");
            if (isSuccess || isError) {
              const prefix = isSuccess ? "https://forge-eval.local/success/" : "https://forge-eval.local/error/";
              const remaining = event.url.substring(prefix.length);
              const qIndex = remaining.indexOf("?");
              const pathId = qIndex !== -1 ? remaining.substring(0, qIndex) : remaining;
              
              if (pathId === executionId) {
                let data = "";
                if (qIndex !== -1) {
                  const searchParams = new URLSearchParams(remaining.substring(qIndex));
                  data = searchParams.get("data") || "";
                }
                
                if (unlisten) unlisten();
                if (isSuccess) {
                  resolve(decodeURIComponent(data));
                } else {
                  reject(new Error(decodeURIComponent(data)));
                }
              }
            }
          } catch (err) {
            console.error("Failed to parse forge-eval URL:", err);
          }
        }
      });
    };

    void setupListener().then(() => {
      invoke("browser_webview_eval", { id: tabId, script: wrapped }).catch((err) => {
        if (unlisten) unlisten();
        reject(err instanceof Error ? err : new Error(String(err)));
      });
    });
  });
}

