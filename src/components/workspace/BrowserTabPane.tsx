import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  RotateCw,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAppSelection } from "@/contexts/AppSelectionContext";
import {
  canUseEmbeddedBrowser,
  closeBrowserWebview,
  goBackBrowserWebview,
  goForwardBrowserWebview,
  listenBrowserNavigated,
  navigateBrowserWebview,
  openBrowserWebview,
  reloadBrowserWebview,
  setBrowserWebviewBounds,
  setBrowserWebviewVisible,
} from "@/lib/embedded-browser";
import { openExternal } from "@/lib/open-external";
import { cn } from "@/lib/utils";

interface BrowserTabPaneProps {
  tabId: string;
  isFocused: boolean;
  /** Hide native webview while panel chrome (menus, split drag) is active — child webviews paint above the main UI. */
  suppressNativeOverlay?: boolean;
  onRequestFocus: (tabId: string) => void;
}

const DEFAULT_URL = "https://www.google.com/";
const GOOGLE_SEARCH_URL = "https://www.google.com/search?q=";

function normalizeComparableUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    parsed.hash = "";
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString();
  } catch {
    return url.trim();
  }
}

function toNavigationTarget(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return DEFAULT_URL;

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      return new URL(trimmed).href;
    } catch {
      /* fall through to search */
    }
  }

  const looksLikeHost =
    /^[a-z0-9][-a-z0-9.]*[a-z0-9](:\d+)?(\/.*)?$/i.test(trimmed) &&
    trimmed.includes(".") &&
    !trimmed.includes(" ");
  const looksLikeLocalhost = /^localhost(:\d+)?(\/.*)?$/i.test(trimmed);
  const looksLikeIpv4 = /^\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?(\/.*)?$/.test(trimmed);

  if (looksLikeHost || looksLikeLocalhost || looksLikeIpv4) {
    try {
      const defaultProtocol = looksLikeLocalhost || looksLikeIpv4 ? "http" : "https";
      return new URL(`${defaultProtocol}://${trimmed}`).href;
    } catch {
      /* fall through */
    }
  }

  return `${GOOGLE_SEARCH_URL}${encodeURIComponent(trimmed)}`;
}

function readBounds(host: HTMLElement) {
  const rect = host.getBoundingClientRect();
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

async function waitForHostBounds(host: HTMLElement, maxAttempts = 40) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const bounds = readBounds(host);
    if (bounds.width >= 4 && bounds.height >= 4) {
      return bounds;
    }
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }
  return readBounds(host);
}

export function BrowserTabPane({
  tabId,
  isFocused,
  suppressNativeOverlay = false,
  onRequestFocus,
}: BrowserTabPaneProps) {
  const showNativeWebview = !suppressNativeOverlay;
  const useNative = canUseEmbeddedBrowser();
  const { selectBottomPanel } = useAppSelection();
  const hostRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [webviewReady, setWebviewReady] = useState(false);
  const historyRef = useRef<string[]>([DEFAULT_URL]);
  const historyIndexRef = useRef(0);
  const [addressBar, setAddressBar] = useState(DEFAULT_URL);
  const [pageUrl, setPageUrl] = useState(DEFAULT_URL);
  const pageUrlRef = useRef(pageUrl);

  useEffect(() => {
    pageUrlRef.current = pageUrl;
  }, [pageUrl]);
  const nativeUrlRef = useRef(DEFAULT_URL);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [historyPos, setHistoryPos] = useState({ index: 0, length: 1 });
  const [nativeNav, setNativeNav] = useState({
    canGoBack: false,
    canGoForward: false,
  });

  const focusPane = useCallback(() => {
    selectBottomPanel();
    onRequestFocus(tabId);
  }, [tabId, selectBottomPanel, onRequestFocus]);

  const navigate = useCallback(
    (raw: string, pushHistory = true) => {
      const next = toNavigationTarget(raw);
      setLoadError(null);
      setPageUrl(next);
      setAddressBar(next);
      if (pushHistory) {
        const history = historyRef.current.slice(0, historyIndexRef.current + 1);
        if (history[history.length - 1] !== next) {
          history.push(next);
          historyRef.current = history;
          historyIndexRef.current = history.length - 1;
          setHistoryPos({
            index: historyIndexRef.current,
            length: history.length,
          });
        }
      }
    },
    [],
  );

  const syncNativeBounds = useCallback(async () => {
    if (!useNative || !hostRef.current || !webviewReady) return;
    const bounds = readBounds(hostRef.current);
    if (bounds.width < 4 || bounds.height < 4) {
      await setBrowserWebviewVisible(tabId, false);
      return;
    }
    await setBrowserWebviewBounds(tabId, bounds);
    await setBrowserWebviewVisible(tabId, showNativeWebview);
  }, [tabId, showNativeWebview, useNative, webviewReady]);

  useEffect(() => {
    if (!useNative || !hostRef.current) return;

    let cancelled = false;

    const boot = async () => {
      const host = hostRef.current;
      if (!host) return;
      try {
        const bounds = await waitForHostBounds(host);
        await openBrowserWebview(tabId, pageUrlRef.current, bounds);
        if (cancelled) return;
        setWebviewReady(true);
        if (!showNativeWebview) {
          await setBrowserWebviewVisible(tabId, false);
        } else {
          await setBrowserWebviewVisible(tabId, true);
          await setBrowserWebviewBounds(tabId, readBounds(host));
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Could not start embedded browser.";
        setLoadError(message);
      }
    };

    void boot();

    return () => {
      cancelled = true;
      setWebviewReady(false);
      void closeBrowserWebview(tabId);
    };
  }, [tabId, useNative, showNativeWebview]);

  useEffect(() => {
    if (!useNative || !webviewReady) return;

    const unlistenPromise = listenBrowserNavigated((event) => {
      if (event.id !== tabId) return;
      if (event.url.includes("#forge-eval-") || event.url.startsWith("forge-eval://")) {
        return;
      }
      nativeUrlRef.current = event.url;
      setLoadError(null);
      setPageUrl(event.url);
      setAddressBar(event.url);
      setNativeNav({
        canGoBack: event.canGoBack,
        canGoForward: event.canGoForward,
      });
    });

    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [tabId, useNative, webviewReady]);

  useEffect(() => {
    if (!useNative || !webviewReady) return;
    if (
      normalizeComparableUrl(pageUrl) ===
      normalizeComparableUrl(nativeUrlRef.current)
    ) {
      return;
    }
    void navigateBrowserWebview(tabId, pageUrl).catch((err) => {
      const message =
        err instanceof Error ? err.message : "Could not navigate.";
      setLoadError(message);
    });
  }, [pageUrl, tabId, useNative, webviewReady]);

  useEffect(() => {
    if (!useNative || !webviewReady) return;
    void setBrowserWebviewVisible(tabId, showNativeWebview);
    if (showNativeWebview) {
      void syncNativeBounds();
    }
  }, [tabId, showNativeWebview, useNative, webviewReady, syncNativeBounds]);

  useEffect(() => {
    if (!useNative || !hostRef.current) return;
    const host = hostRef.current;
    const ro = new ResizeObserver(() => {
      void syncNativeBounds();
    });
    ro.observe(host);
    window.addEventListener("resize", syncNativeBounds);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", syncNativeBounds);
    };
  }, [syncNativeBounds, useNative]);

  const goBack = () => {
    setLoadError(null);
    if (useNative && webviewReady) {
      void goBackBrowserWebview(tabId).catch((err) => {
        const message =
          err instanceof Error ? err.message : "Could not go back.";
        setLoadError(message);
      });
      return;
    }
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const url = historyRef.current[historyIndexRef.current]!;
    setHistoryPos({
      index: historyIndexRef.current,
      length: historyRef.current.length,
    });
    navigate(url, false);
  };

  const goForward = () => {
    setLoadError(null);
    if (useNative && webviewReady) {
      void goForwardBrowserWebview(tabId).catch((err) => {
        const message =
          err instanceof Error ? err.message : "Could not go forward.";
        setLoadError(message);
      });
      return;
    }
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const url = historyRef.current[historyIndexRef.current]!;
    setHistoryPos({
      index: historyIndexRef.current,
      length: historyRef.current.length,
    });
    navigate(url, false);
  };

  const reload = () => {
    setLoadError(null);
    if (useNative && webviewReady) {
      void reloadBrowserWebview(tabId).catch((err) => {
        const message =
          err instanceof Error ? err.message : "Could not reload.";
        setLoadError(message);
      });
      return;
    }
    const iframe = iframeRef.current;
    if (iframe) {
      iframe.src = pageUrl;
    }
  };

  const canGoBack = useNative ? nativeNav.canGoBack : historyPos.index > 0;
  const canGoForward = useNative
    ? nativeNav.canGoForward
    : historyPos.index < historyPos.length - 1;
  const submitAddressBar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    navigate(addressBar);
  };

  return (
    <div
      data-focused={isFocused || undefined}
      className={cn(
        "absolute inset-0 flex flex-col",
        !useNative && "bg-terminal",
      )}
    >
      <div className="border-border-subtle bg-panel flex h-8 shrink-0 items-center gap-1 border-b px-1.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground h-6 w-6 shrink-0"
          title="Back"
          aria-label="Back"
          disabled={!canGoBack}
          onClick={goBack}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground h-6 w-6 shrink-0"
          title="Forward"
          aria-label="Forward"
          disabled={!canGoForward}
          onClick={goForward}
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground h-6 w-6 shrink-0"
          title="Reload"
          aria-label="Reload"
          onClick={reload}
        >
          <RotateCw className="h-3.5 w-3.5" />
        </Button>
        <form
          className="flex min-w-0 flex-1 items-center gap-1"
          onSubmit={submitAddressBar}
        >
          <input
            type="text"
            value={addressBar}
            onChange={(e) => setAddressBar(e.target.value)}
            onFocus={focusPane}
            onKeyDownCapture={(e) => {
              if (e.key === "Enter") {
                e.stopPropagation();
              }
            }}
            className="border-border-subtle text-foreground focus:ring-accent/50 bg-panel-elevated min-w-0 flex-1 rounded-md border px-2 py-0.5 text-xs outline-none focus:ring-1"
            aria-label="Address bar"
            spellCheck={false}
          />
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground h-6 shrink-0 px-2 text-xs"
          >
            Go
          </Button>
        </form>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground h-6 w-6 shrink-0"
          title="Open in default browser"
          aria-label="Open in default browser"
          onClick={() => void openExternal(pageUrl)}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div
        ref={hostRef}
        className={cn(
          "relative min-h-0 flex-1",
          useNative ? "bg-transparent" : "bg-terminal",
        )}
      >
        {loadError && (
          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/80 dark:text-amber-100">
            <span className="min-w-0 truncate">{loadError}</span>
            <button
              type="button"
              className="hover:text-foreground shrink-0 underline"
              onClick={() => void openExternal(pageUrl)}
            >
              Open externally
            </button>
          </div>
        )}
        {!useNative && (
          <>
            <iframe
              ref={iframeRef}
              title="Browser"
              src={pageUrl}
              className="h-full w-full border-0 bg-white"
              onLoad={() => setLoadError(null)}
              onError={() =>
                setLoadError(
                  "Google and many sites block embedded browsers. Run npm run tauri:dev for the in-app browser.",
                )
              }
            />
            <p className="text-muted-foreground pointer-events-none absolute inset-x-0 bottom-2 text-center text-[10px]">
              Use the Forge desktop app (tauri:dev) for full in-panel browsing.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
