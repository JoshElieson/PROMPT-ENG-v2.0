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
