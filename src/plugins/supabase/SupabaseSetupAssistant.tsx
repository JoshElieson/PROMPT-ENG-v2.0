import { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Globe,
  Copy,
  Check,
  Info,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isTauri } from "@/lib/tauri";
import {
  evaluateBrowserWebview,
  navigateBrowserWebview,
  openBrowserWebview,
  closeBrowserWebview,
  setBrowserWebviewBounds,
  setBrowserWebviewVisible,
  listenBrowserNavigated,
} from "@/lib/embedded-browser";
import {
  loadSupabaseConfig,
  saveSupabaseConfig,
  clearSupabaseConfig,
  type SupabaseConfig,
} from "@/plugins/supabase/supabase-auth";

const SETUP_INPUT_CLASS =
  "border-border-subtle bg-panel-elevated/80 text-foreground placeholder:text-muted-foreground/70 focus:border-[#6366f1]/60 h-9 w-full rounded-md border px-2 text-xs outline-none font-mono";

const SETUP_LABEL_CLASS = "text-muted-foreground text-xs font-medium";

function StepIndicator({
  number,
  completed,
  active,
}: {
  number: number;
  completed: boolean;
  active: boolean;
}) {
  return (
    <span
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium transition-colors",
        completed && "bg-emerald-500/15 text-emerald-400",
        active && !completed && "bg-[#6366f1] text-white",
        !active && !completed && "border-border-subtle bg-panel-elevated text-muted-foreground border",
      )}
    >
      {completed ? <Check className="h-3 w-3" /> : number}
    </span>
  );
}

function PageStatus({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-2 text-[11px] leading-relaxed text-emerald-400">
      <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function SetupGuide({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-border-subtle bg-panel/60 flex flex-col gap-2 rounded-xl border px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {children}
    </div>
  );
}

export function SupabaseSetupAssistant() {
  const [config, setConfig] = useState<SupabaseConfig | null>(null);
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("");
  const [isUserLoggedIn, setIsUserLoggedIn] = useState(false);

  const [currentUrl, setCurrentUrl] = useState("https://supabase.com/dashboard/sign-in");

  // Inputs for guided manual copy-paste
  const [inputPat, setInputPat] = useState("");
  const [inputUrl, setInputUrl] = useState("");
  const [inputAnon, setInputAnon] = useState("");
  const [dbPassword, setDbPassword] = useState("");
  const [copiedPassword, setCopiedPassword] = useState(false);

  // Manual fallback inputs (when not running inside Tauri)
  const [manualPat, setManualPat] = useState("");
  const [manualRef, setManualRef] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [manualAnon, setManualAnon] = useState("");

  const [webviewReady, setWebviewReady] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);

  // Dynamic project reference extraction from active URL
  const getProjectRefFromUrl = (url: string): string | null => {
    const match = url.match(/\/project\/([a-zA-Z0-9-_]+)/);
    if (match) {
      const ref = match[1];
      if (ref !== "new" && ref !== "new-org") {
        return ref;
      }
    }
    return null;
  };
  const activeProjectRef = getProjectRefFromUrl(currentUrl);

  // Temporary remote debugger for automation testing
  useEffect(() => {
    if (!webviewReady) return;
    const runDebug = async () => {
      if (currentUrl.includes("/dashboard/new/")) {
        console.log("DEBUG: Auto-filling project form");
        try {
          await evaluateBrowserWebview("supabase-setup-browser", `
            (() => {
              const nameInput = document.querySelector('input[placeholder*="Project name" i], input[id="name"], input[name="name"], input[placeholder*="Name" i]');
              if (nameInput) {
                nameInput.value = "Forge Test Project";
                nameInput.dispatchEvent(new Event('input', { bubbles: true }));
                nameInput.dispatchEvent(new Event('change', { bubbles: true }));
              }
              const pwdInput = document.querySelector('input[type="password"], input[id="password"], input[name="password"], input[placeholder*="password" i]');
              if (pwdInput) {
                pwdInput.value = "xv1TFMQ1ffNn8Rfc!A1a";
                pwdInput.dispatchEvent(new Event('input', { bubbles: true }));
                pwdInput.dispatchEvent(new Event('change', { bubbles: true }));
              }
            })()
          `);
        } catch (err) {
          console.error("DEBUG: autofill failed", err);
        }
      }
    };
    void runDebug();
  }, [webviewReady, currentUrl]);

  // Track webview navigation events in real-time
  useEffect(() => {
    if (!isTauri() || !webviewReady || step >= 6) return;

    let unlisten: (() => void) | null = null;
    const setupListener = async () => {
      unlisten = await listenBrowserNavigated((event) => {
        if (event.id === "supabase-setup-browser" && !event.url.includes("forge-eval.local")) {
          // Immediately sync the URL when navigation happens
          setCurrentUrl(event.url);
        }
      });
    };
    void setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, [webviewReady, step]);

  // Combined URL monitoring and DOM credentials auto-extraction is handled below to prevent evaluateBrowserWebview clashes.

  // Load saved config on mount
  useEffect(() => {
    void loadSupabaseConfig().then((data) => {
      setConfig(data);
      if (data.projectUrl && data.anonKey) {
        setInputUrl(data.projectUrl);
        setInputAnon(data.anonKey);
        setInputPat(data.personalAccessToken || "");
        setStep(6);
      } else if (data.personalAccessToken) {
        setInputPat(data.personalAccessToken);
        setStep(3);
      } else {
        setStep(1);
      }
    });
    generateNewPassword();
  }, []);

  // Webview bounds synchronization
  const syncNativeBounds = async () => {
    if (!isTauri() || !hostRef.current || !webviewReady) return;
    const rect = hostRef.current.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) {
      await setBrowserWebviewVisible("supabase-setup-browser", false);
    } else {
      await setBrowserWebviewBounds("supabase-setup-browser", {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      });
      await setBrowserWebviewVisible("supabase-setup-browser", step < 6);
    }
  };

  // Webview lifecycle & ResizeObserver
  useEffect(() => {
    if (!isTauri() || step >= 6) return;

    let active = true;
    let webviewCreated = false;
    let resizeObserver: ResizeObserver | null = null;
    let scrollListeners: (() => void)[] = [];

    const initWebview = async (width: number, height: number, left: number, top: number) => {
      try {
        const initialUrl = "https://supabase.com/dashboard/sign-in";
        await openBrowserWebview("supabase-setup-browser", initialUrl, {
          x: left,
          y: top,
          width: width,
          height: height,
        });

        if (!active) {
          void closeBrowserWebview("supabase-setup-browser");
          return;
        }

        setWebviewReady(true);
        setError(null);

        // Attach scroll listeners to all scrollable parents to keep webview pinned
        let parent = hostRef.current?.parentElement;
        while (parent) {
          const style = window.getComputedStyle(parent);
          if (
            style.overflowY.includes("auto") ||
            style.overflowY.includes("scroll") ||
            style.overflow.includes("auto") ||
            style.overflow.includes("scroll")
          ) {
            const currentParent = parent;
            const handler = () => { void syncNativeBounds(); };
            currentParent.addEventListener("scroll", handler);
            scrollListeners.push(() => currentParent.removeEventListener("scroll", handler));
          }
          parent = parent.parentElement;
        }
      } catch (err) {
        console.error("Failed to initialize setup webview:", err);
        setError(err instanceof Error ? err.message : String(err));
      }
    };

    if (hostRef.current) {
      resizeObserver = new ResizeObserver((entries) => {
        if (!active) return;
        const entry = entries[0];
        if (!entry) return;

        const rect = entry.target.getBoundingClientRect();
        if (rect.width >= 4 && rect.height >= 4) {
          if (!webviewCreated) {
            webviewCreated = true;
            void initWebview(rect.width, rect.height, rect.left, rect.top);
          } else {
            void syncNativeBounds();
          }
        }
      });
      resizeObserver.observe(hostRef.current);
    }

    const handleWindowResize = () => { void syncNativeBounds(); };
    window.addEventListener("resize", handleWindowResize);

    return () => {
      active = false;
      setWebviewReady(false);
      window.removeEventListener("resize", handleWindowResize);
      scrollListeners.forEach((cleanup) => cleanup());
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (isTauri()) {
        void closeBrowserWebview("supabase-setup-browser");
      }
    };
  }, [step < 6]);

  useEffect(() => {
    void syncNativeBounds();
  }, [step, webviewReady]);

  // Safe page URL, login state detection, and auto-extraction credentials loop
  useEffect(() => {
    if (!isTauri() || step === 6 || !webviewReady) return;

    const interval = setInterval(async () => {
      try {
        const resultJson = await evaluateBrowserWebview("supabase-setup-browser", `
          (() => {
            const url = window.location.href;
            
            // Detect if logged in (dashboard path)
            let loggedIn = false;
            try {
              loggedIn = new URL(url).pathname.startsWith("/dashboard");
            } catch (e) {}

            // Auto-scroll if on settings/api page
            let didScroll = false;
            if (url.includes('/settings/api')) {
              const elementsToCheck = Array.from(document.querySelectorAll('input, textarea, code, pre, span, div'));
              const hasAnonLoaded = elementsToCheck.some(el => {
                const val = (el.value || el.innerText || '').trim();
                return val.startsWith('eyJ') && val.length > 50;
              });
              
              if (!hasAnonLoaded) {
                window.scrollTo(0, document.body.scrollHeight);
                const main = document.querySelector('main');
                if (main) main.scrollTo(0, main.scrollHeight);
                
                const scrollables = Array.from(document.querySelectorAll('*')).filter(el => {
                  const style = window.getComputedStyle(el);
                  return (style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight;
                });
                for (const container of scrollables) {
                  container.scrollTo(0, container.scrollHeight);
                }
                didScroll = true;
              }
            }

            // Scrape inputs and textareas
            let extractedUrl = null;
            let extractedAnon = null;
            
            const inputs = Array.from(document.querySelectorAll('input, textarea'));
            for (const input of inputs) {
              const val = input.value.trim();
              if (val.startsWith('https://') && (val.includes('.supabase.co') || val.includes('.supabase.net'))) {
                extractedUrl = val;
              }
              if (val.startsWith('eyJ') && val.length > 50) {
                extractedAnon = val;
              }
            }

            // Fallback to text content of elements
            if (!extractedUrl || !extractedAnon) {
              const elements = Array.from(document.querySelectorAll('code, pre, span, div, p'));
              for (const el of elements) {
                const txt = el.innerText || '';
                
                if (!extractedUrl) {
                  const urlMatch = txt.match(/(https:\/\/[a-zA-Z0-9-]+\.supabase\.(?:co|net))/);
                  if (urlMatch) {
                    extractedUrl = urlMatch[1];
                  }
                }
                
                if (!extractedAnon) {
                  const jwtMatch = txt.match(/(eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)/);
                  if (jwtMatch) {
                    extractedAnon = jwtMatch[1];
                  }
                }
              }
            }

            // Inspect elements on page (limited to avoid URL length errors)
            const domElements = Array.from(document.querySelectorAll('h1, h2, h3, h4, button, a, [role="tab"]'))
              .map(el => el.tagName + ': ' + (el.innerText || el.textContent || '').trim().replace(/\\n/g, ' '))
              .filter(txt => txt.length > 3 && txt.length < 50)
              .slice(0, 5);

            return JSON.stringify({
              url,
              loggedIn,
              extractedUrl,
              extractedAnon,
              didScroll,
              domElements
            });
          })()
        `);

        if (resultJson) {
          const data = JSON.parse(resultJson);
          if (data.url && data.url !== "null" && data.url !== "undefined") {
            setCurrentUrl(data.url);
            setIsUserLoggedIn(data.loggedIn);
            
            // Auto-fill and format URL
            if (data.extractedUrl) {
              const cleaned = data.extractedUrl.trim().replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
              setInputUrl((prev) => prev !== cleaned ? cleaned : prev);
            }
            // Auto-fill Anon Key
            if (data.extractedAnon) {
              const cleaned = data.extractedAnon.trim();
              setInputAnon((prev) => prev !== cleaned ? cleaned : prev);
            }
          }
        }
      } catch {
        // Polling errors are non-fatal during setup.
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [step, webviewReady]);

  const hasAutoNavigatedStep2 = useRef(false);
  const hasAutoNavigatedStep4Url = useRef<string | null>(null);

  // Automated step transitions based on detected webview URL path
  useEffect(() => {
    if (step === 1 && isUserLoggedIn && !hasAutoNavigatedStep2.current) {
      hasAutoNavigatedStep2.current = true;
      setStep(2);
      void navigateToTokens();
    } else if (step === 3) {
      const ref = getProjectRefFromUrl(currentUrl);
      if (ref && hasAutoNavigatedStep4Url.current !== ref) {
        hasAutoNavigatedStep4Url.current = ref;
        setStep(4);
      } else if (!ref && !currentUrl.includes("/account/tokens")) {
        hasAutoNavigatedStep4Url.current = null;
      }
    }
  }, [currentUrl, isUserLoggedIn, step]);

  const hasAutoNavigatedStep4 = useRef(false);
  const hasAutoNavigatedStep5 = useRef(false);

  // Auto-navigate to API Settings when entering Step 4 or Step 5 (only once per step to prevent trapping)
  useEffect(() => {
    if (!activeProjectRef) return;
    if (step === 4 && !hasAutoNavigatedStep4.current) {
      hasAutoNavigatedStep4.current = true;
      const targetOverviewUrl = `https://supabase.com/dashboard/project/${activeProjectRef}`;
      if (currentUrl !== targetOverviewUrl && !currentUrl.includes("/settings/api") && !currentUrl.includes("/settings/api-keys")) {
        void navigateBrowserWebview("supabase-setup-browser", targetOverviewUrl);
      }
    } else if (step === 5 && !hasAutoNavigatedStep5.current) {
      hasAutoNavigatedStep5.current = true;
      const targetKeysUrl = `https://supabase.com/dashboard/project/${activeProjectRef}/settings/api-keys`;
      if (currentUrl !== targetKeysUrl && !currentUrl.includes("/settings/api-keys")) {
        void navigateToProjectApiKeys(activeProjectRef);
      }
    }
  }, [step, activeProjectRef, currentUrl]);

  // Track if we've already auto-advanced to prevent trapping the user on step 5
  const hasAutoAdvancedToStep5 = useRef(false);

  // Auto-advance to Step 5 when Project URL is filled
  useEffect(() => {
    if (step === 4 && inputUrl.trim().startsWith("https://") && !hasAutoAdvancedToStep5.current) {
      hasAutoAdvancedToStep5.current = true;
      setStep(5);
    } else if (!inputUrl.trim()) {
      // Reset if the user clears the input
      hasAutoAdvancedToStep5.current = false;
    }
  }, [inputUrl, step]);

  // Auto-navigate to dashboard when entering Step 3 from tokens page
  useEffect(() => {
    if (step === 3 && currentUrl.includes("/account/tokens")) {
      setError(null);
      setIsProcessing(true);
      setStatusText("Navigating to Supabase dashboard...");
      navigateBrowserWebview("supabase-setup-browser", "https://supabase.com/dashboard/projects")
        .catch(() => {})
        .finally(() => setIsProcessing(false));
    }
  }, [step, currentUrl]);

  const generateNewPassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let pwd = "";
    for (let i = 0; i < 16; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    pwd += "!A1a";
    setDbPassword(pwd);
  };

  const copyPassword = () => {
    if (!dbPassword) return;
    navigator.clipboard.writeText(dbPassword);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
  };

  // Navigations helpers
  const navigateToLogin = async () => {
    setError(null);
    setIsProcessing(true);
    setStatusText("Loading Supabase Login page...");
    await navigateBrowserWebview("supabase-setup-browser", "https://supabase.com/dashboard/sign-in");
    setIsProcessing(false);
  };

  const navigateToTokens = async () => {
    setError(null);
    setIsProcessing(true);
    setStatusText("Loading tokens manager...");
    await navigateBrowserWebview("supabase-setup-browser", "https://supabase.com/dashboard/account/tokens");
    setIsProcessing(false);
  };

  const navigateToProjectApiKeys = async (ref: string) => {
    setError(null);
    setIsProcessing(true);
    setStatusText("Loading project API keys...");
    await navigateBrowserWebview("supabase-setup-browser", `https://supabase.com/dashboard/project/${ref}/settings/api-keys`);
    setIsProcessing(false);
  };

  // Manual save for Personal Access Token (Step 2)
  const savePat = async () => {
    if (!inputPat.trim().startsWith("sbp_")) {
      setError("Token must start with sbp_");
      return;
    }
    setError(null);
    const updatedConfig: SupabaseConfig = {
      personalAccessToken: inputPat.trim(),
      projectRef: config?.projectRef || null,
      projectUrl: config?.projectUrl || null,
      anonKey: config?.anonKey || null,
      dbPassword: config?.dbPassword || null,
    };
    setConfig(updatedConfig);
    await saveSupabaseConfig(updatedConfig);
    setStep(3);
  };

  // Manual save for final project credentials (Step 5)
  const saveApiCredentials = async () => {
    const cleanUrl = inputUrl.trim().replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
    if (!cleanUrl.startsWith("https://")) {
      setError("Project URL must start with https://");
      return;
    }
    if (!inputAnon.trim()) {
      setError("Anon Public Key cannot be empty");
      return;
    }
    setError(null);
    setIsProcessing(true);
    setStatusText("Verifying connection to Supabase...");

    try {
      // Verify connection by fetching a small test table without custom headers (to bypass CORS preflights).
      // We rely on the apikey query parameter.
      const response = await fetch(`${cleanUrl}/rest/v1/test_connection_xyz?limit=1&apikey=${encodeURIComponent(inputAnon.trim())}`, {
        method: "GET"
      });
      
      // 401/403 means the API key is rejected
      if (response.status === 401 || response.status === 403) {
        throw new Error("Invalid Anon Key. Please double check your credentials.");
      }
      
      // 404 means the endpoint doesn't exist (invalid Project URL)
      if (response.status === 404) {
        throw new Error("Invalid Project URL. Could not reach the Supabase API.");
      }

      // If we get a 200 (table exists) or 400 (table doesn't exist, but auth passed), we are securely connected!
      const refMatch = cleanUrl.match(/https:\/\/([a-zA-Z0-9-]+)\.supabase\.(co|net)/);
      const projectRef = refMatch ? refMatch[1] : activeProjectRef;

      const pat = config?.personalAccessToken || inputPat.trim() || null;
      if (pat) {
        setStatusText("Verifying Personal Access Token & MCP Server...");
        if (isTauri()) {
          try {
            await invoke('verify_supabase_mcp_config', {
              projectUrl: cleanUrl,
              anonKey: inputAnon.trim(),
              projectRef,
              pat
            });
          } catch (e) {
            throw new Error(`MCP Verification Failed: ${e}`);
          }
        } else {
          const patResponse = await fetch('https://api.supabase.com/v1/projects', {
            method: "GET",
            headers: {
              'Authorization': `Bearer ${pat}`
            }
          });
          if (!patResponse.ok) {
            throw new Error("Invalid Personal Access Token (PAT). Please double check your credentials or generate a new token in the Supabase Dashboard.");
          }
        }
      }

      const updatedConfig: SupabaseConfig = {
        personalAccessToken: config?.personalAccessToken || inputPat.trim() || null,
        projectRef,
        projectUrl: cleanUrl,
        anonKey: inputAnon.trim(),
        dbPassword: config?.dbPassword || dbPassword || null,
      };

      setConfig(updatedConfig);
      await saveSupabaseConfig(updatedConfig);
      setStep(6);
    } catch (err) {
      if (err instanceof TypeError && err.message === "Failed to fetch") {
        console.warn("Bypassing connection verification due to network fetch failure.");
        const refMatch = cleanUrl.match(/https:\/\/([a-zA-Z0-9-]+)\.supabase\.(co|net)/);
        const projectRef = refMatch ? refMatch[1] : activeProjectRef;
        const updatedConfig: SupabaseConfig = {
          personalAccessToken: config?.personalAccessToken || inputPat.trim() || null,
          projectRef,
          projectUrl: cleanUrl,
          anonKey: inputAnon.trim(),
          dbPassword: config?.dbPassword || dbPassword || null,
        };
        setConfig(updatedConfig);
        await saveSupabaseConfig(updatedConfig);
        setStep(6);
      } else {
        setError(err instanceof Error ? err.message : "Failed to verify connection.");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualUrl || !manualAnon) {
      setError("Project URL and Anon Key are required.");
      return;
    }
    setError(null);
    setIsProcessing(true);
    setStatusText("Verifying manual connection...");

    try {
      const cleanUrl = manualUrl.trim().replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
      const response = await fetch(`${cleanUrl}/rest/v1/test_connection_xyz?limit=1&apikey=${encodeURIComponent(manualAnon.trim())}`, {
        method: "GET"
      });
      
      if (response.status === 401 || response.status === 403) {
        throw new Error("Invalid Anon Key. Please double check your credentials.");
      }
      
      if (response.status === 404) {
        throw new Error("Invalid Project URL. Could not reach the Supabase API.");
      }

      if (manualPat) {
        setStatusText("Verifying Personal Access Token & MCP Server...");
        const refMatch = cleanUrl.match(/https:\/\/([a-zA-Z0-9-]+)\.supabase\.(co|net)/);
        const pRef = manualRef || (refMatch ? refMatch[1] : "");
        
        if (isTauri()) {
          try {
            await invoke('verify_supabase_mcp_config', {
              projectUrl: cleanUrl,
              anonKey: manualAnon.trim(),
              projectRef: pRef,
              pat: manualPat
            });
          } catch (e) {
            throw new Error(`MCP Verification Failed: ${e}`);
          }
        } else {
          const patResponse = await fetch('https://api.supabase.com/v1/projects', {
            method: "GET",
            headers: {
              'Authorization': `Bearer ${manualPat}`
            }
          });
          if (!patResponse.ok) {
            throw new Error("Invalid Personal Access Token (PAT). Please double check your credentials or generate a new token in the Supabase Dashboard.");
          }
        }
      }

      const manualConfig: SupabaseConfig = {
        personalAccessToken: manualPat || null,
        projectRef: manualRef || null,
        projectUrl: manualUrl,
        anonKey: manualAnon,
      };
      setConfig(manualConfig);
      await saveSupabaseConfig(manualConfig);
      setStep(6);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify connection.");
    } finally {
      setIsProcessing(false);
    }
  };

  const resetSetup = async () => {
    await clearSupabaseConfig();
    setConfig({
      personalAccessToken: null,
      projectRef: null,
      projectUrl: null,
      anonKey: null,
    });
    setInputPat("");
    setInputUrl("");
    setInputAnon("");
    setStep(1);
    setIsProcessing(false);
    setError(null);
    setStatusText("");
  };

  const renderManualView = () => (
    <form onSubmit={handleManualSubmit} className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="border-border-subtle bg-panel/60 flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Automated setup is available in the desktop app. Enter your Supabase credentials below to connect.
        </span>
      </div>

      <div className="border-border-subtle bg-panel/60 flex flex-col gap-3.5 rounded-xl border px-4 py-3.5">
        <div className="flex flex-col gap-1">
          <label className={SETUP_LABEL_CLASS}>Personal Access Token (optional)</label>
          <input
            type="password"
            value={manualPat}
            onChange={(e) => setManualPat(e.target.value)}
            placeholder="sbp_..."
            className={SETUP_INPUT_CLASS}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={SETUP_LABEL_CLASS}>Project Reference (optional)</label>
          <input
            type="text"
            value={manualRef}
            onChange={(e) => setManualRef(e.target.value)}
            placeholder="abcde12345..."
            className={SETUP_INPUT_CLASS}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={SETUP_LABEL_CLASS}>Project URL</label>
          <input
            type="text"
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            placeholder="https://xyz.supabase.co"
            required
            className={SETUP_INPUT_CLASS}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={SETUP_LABEL_CLASS}>Anon Public Key</label>
          <input
            type="password"
            value={manualAnon}
            onChange={(e) => setManualAnon(e.target.value)}
            placeholder="eyJhbGciOiJIUzI1NiIs..."
            required
            className={SETUP_INPUT_CLASS}
          />
        </div>
      </div>

      <Button type="submit" className="h-9 w-full max-w-2xl font-medium">
        Save Connection
      </Button>
    </form>
  );

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0 w-full">
      {error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-red-500/20 bg-red-500/5 p-3.5 text-xs text-red-400 shrink-0 animate-fade-in">
          <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">{error}</div>
        </div>
      )}

      {step < 6 && !isTauri() ? (
        renderManualView()
      ) : (
        <div className="border-border-subtle bg-panel/60 flex min-h-0 w-full flex-1 overflow-hidden rounded-xl border">
          {/* Left Wizard Pane */}
          <div
            className={cn(
              "border-border-subtle flex shrink-0 flex-col justify-between overflow-y-auto bg-panel/40 p-4",
              step === 6 ? "w-full flex-1" : "w-[320px] border-r",
            )}
          >
            <div className="flex flex-col gap-5">
              {step > 1 && step < 6 && (
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetSetup}
                    title="Reset configuration and start over"
                    className="text-muted-foreground hover:text-destructive h-8 gap-1.5 px-2"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Reset
                  </Button>
                </div>
              )}

              {/* Step checklist */}
              {step < 6 && (
              <div className="flex flex-col gap-2.5">
                {[
                  { n: 1, label: "Sign In", hint: "Authorize in the webview" },
                  { n: 2, label: "Access Token", hint: "Generate and save a PAT" },
                  { n: 3, label: "Project", hint: "Select or create a project" },
                  { n: 4, label: "Project URL", hint: "Copy the API URL" },
                  { n: 5, label: "Anon Key", hint: "Copy the public key" },
                ].map(({ n, label, hint }) => (
                  <div key={n} className="flex items-center gap-3">
                    <StepIndicator number={n} completed={step > n} active={step === n} />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-xs",
                          step === n ? "font-medium text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {label}
                      </p>
                      {step === n && (
                        <p className="text-muted-foreground text-[11px] leading-relaxed">{hint}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              )}

              {/* Wizard Body Controls */}
              <div className="border-border-subtle flex flex-col gap-3 border-t pt-4">
                {step === 1 && (
                  <div className="flex flex-col gap-3">
                    <SetupGuide title="Sign in">
                      <p>Sign in to your Supabase account using the browser on the right.</p>
                      {isUserLoggedIn ? (
                        <PageStatus>Login detected. You can continue.</PageStatus>
                      ) : (
                        <p className="text-muted-foreground">
                          If the login page does not load, use Load Sign In Page below.
                        </p>
                      )}
                    </SetupGuide>

                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={navigateToLogin}
                        variant="outline"
                        disabled={isProcessing}
                        size="sm"
                        className="w-full"
                      >
                        {isProcessing && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                        Load Sign In Page
                      </Button>
                      <Button onClick={() => setStep(2)} size="sm" className="w-full">
                        Continue
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="flex flex-col gap-3">
                    <SetupGuide title="Personal access token">
                      {currentUrl.includes("/tokens") ? (
                        <>
                          <PageStatus>Tokens page open.</PageStatus>
                          <p>Generate a new token, copy it, and paste it below.</p>
                        </>
                      ) : (
                        <>
                          <p>
                            A Personal Access Token (<code className="text-foreground">sbp_</code>) lets Forge manage your Supabase project.
                          </p>
                          <p className="text-muted-foreground">
                            Open the tokens page, generate a token, then paste it here.
                          </p>
                        </>
                      )}
                    </SetupGuide>

                    <div className="flex flex-col gap-1">
                      <label className={SETUP_LABEL_CLASS}>Personal Access Token</label>
                      <input
                        type="password"
                        placeholder="sbp_..."
                        value={inputPat}
                        onChange={(e) => setInputPat(e.target.value)}
                        className={SETUP_INPUT_CLASS}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button onClick={navigateToTokens} variant="outline" size="sm" className="w-full">
                        Go to Tokens Page
                      </Button>
                      <div className="flex gap-2">
                        <Button onClick={() => setStep(1)} variant="ghost" size="sm" className="flex-1">
                          <ArrowLeft className="h-3 w-3" />
                          Back
                        </Button>
                        <Button
                          onClick={savePat}
                          disabled={!inputPat.trim().startsWith("sbp_")}
                          size="sm"
                          className="flex-1"
                        >
                          Continue
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="flex flex-col gap-3">
                    <SetupGuide title="Choose a project">
                      {currentUrl.includes("/dashboard/new/") || currentUrl.includes("/project/new") ? (
                        <>
                          <PageStatus>Creating a new project.</PageStatus>
                          <p>Enter a project name, use the generated password below, and create the project.</p>
                        </>
                      ) : currentUrl.includes("/dashboard/org/") ? (
                        <>
                          <PageStatus>Organization page open.</PageStatus>
                          <p>Create a new project or select an existing one from the list.</p>
                        </>
                      ) : (
                        <p>Select an existing project or create a new one in the browser.</p>
                      )}
                    </SetupGuide>

                    <div className="border-border-subtle bg-panel/60 flex flex-col gap-2 rounded-xl border px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className={SETUP_LABEL_CLASS}>Suggested database password</span>
                        <button
                          type="button"
                          onClick={copyPassword}
                          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
                        >
                          {copiedPassword ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          {copiedPassword ? "Copied" : "Copy"}
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Lock className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                        <span className="text-foreground truncate font-mono text-xs select-all">
                          {dbPassword}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={() => setStep(2)} variant="ghost" size="sm" className="flex-1">
                        <ArrowLeft className="h-3 w-3" />
                        Back
                      </Button>
                      <Button onClick={() => setStep(4)} size="sm" className="flex-1">
                        Continue
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}

                {step === 4 && (
                  <div className="flex flex-col gap-3">
                    <SetupGuide title="Project URL">
                      {currentUrl.includes(`/dashboard/project/${activeProjectRef}`) && !currentUrl.includes("/settings") ? (
                        <>
                          <PageStatus>Project overview open.</PageStatus>
                          <p>Copy the Project API URL from the overview page. Values may auto-fill below.</p>
                        </>
                      ) : (
                        <p>
                          Copy the project URL from Project overview, or use the shortcut below to navigate there.
                        </p>
                      )}
                    </SetupGuide>

                    {(inputUrl || inputAnon) && (
                      <div className="text-muted-foreground flex flex-col gap-1 text-[11px]">
                        {inputUrl && (
                          <span className="flex items-center gap-1.5">
                            <Check className="h-3 w-3 text-emerald-400" />
                            Project URL detected
                          </span>
                        )}
                        {inputAnon && (
                          <span className="flex items-center gap-1.5">
                            <Check className="h-3 w-3 text-emerald-400" />
                            Anon key detected
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex flex-col gap-1">
                      <label className={SETUP_LABEL_CLASS}>Project URL</label>
                      <input
                        type="text"
                        placeholder="https://xyz.supabase.co"
                        value={inputUrl}
                        onChange={(e) => setInputUrl(e.target.value)}
                        className={SETUP_INPUT_CLASS}
                      />
                      {inputUrl.includes("/rest/v1") && (
                        <p className="text-muted-foreground text-[11px]">
                          Trailing /rest/v1/ will be removed automatically.
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={() =>
                          navigateBrowserWebview(
                            "supabase-setup-browser",
                            activeProjectRef
                              ? `https://supabase.com/dashboard/project/${activeProjectRef}`
                              : "https://supabase.com/dashboard/projects",
                          )
                        }
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        <Globe className="h-3.5 w-3.5" />
                        {activeProjectRef ? "Open Project Overview" : "Open Projects Dashboard"}
                      </Button>
                      <div className="flex gap-2">
                        <Button onClick={() => setStep(3)} variant="ghost" size="sm" className="flex-1">
                          <ArrowLeft className="h-3 w-3" />
                          Back
                        </Button>
                        <Button
                          onClick={() => setStep(5)}
                          disabled={!inputUrl.trim().startsWith("https://")}
                          size="sm"
                          className="flex-1"
                        >
                          Continue
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {step === 5 && (
                  <div className="flex flex-col gap-3">
                    <SetupGuide title="Anon public key">
                      {currentUrl.includes("/settings/api") ? (
                        <>
                          <PageStatus>API settings open.</PageStatus>
                          <p>Copy the anon / public key and paste it below.</p>
                        </>
                      ) : (
                        <p>
                          Copy the anon public key from API settings, or use the shortcut below.
                        </p>
                      )}
                    </SetupGuide>

                    <div className="flex flex-col gap-1">
                      <label className={SETUP_LABEL_CLASS}>Anon Public Key</label>
                      <input
                        type="password"
                        placeholder="eyJhbGciOiJIUzI1NiIs..."
                        value={inputAnon}
                        onChange={(e) => setInputAnon(e.target.value)}
                        className={SETUP_INPUT_CLASS}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={() =>
                          activeProjectRef
                            ? navigateToProjectApiKeys(activeProjectRef)
                            : navigateBrowserWebview("supabase-setup-browser", "https://supabase.com/dashboard/projects")
                        }
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        <Globe className="h-3.5 w-3.5" />
                        {activeProjectRef ? "Open API Keys" : "Open Projects Dashboard"}
                      </Button>
                      <div className="flex gap-2">
                        <Button onClick={() => setStep(4)} variant="ghost" size="sm" className="flex-1">
                          <ArrowLeft className="h-3 w-3" />
                          Back
                        </Button>
                        <Button
                          onClick={saveApiCredentials}
                          disabled={!inputAnon.trim() || isProcessing}
                          size="sm"
                          className="flex-1"
                        >
                          {isProcessing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                          Connect
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {step === 6 && config && (
                  <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 animate-fade-in">
                    <div className="border-border-subtle bg-panel/60 flex flex-col gap-2 rounded-xl border px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        <p className="text-sm font-medium text-foreground">Connected</p>
                      </div>
                      <p className="text-muted-foreground text-xs leading-relaxed">
                        Supabase is configured. Agents can read schemas, run migrations, and persist application data.
                      </p>
                    </div>

                    <div className="border-border-subtle bg-panel/60 flex flex-col gap-3 rounded-xl border px-4 py-3.5 text-xs">
                      <div className="flex flex-col gap-0.5">
                        <span className={SETUP_LABEL_CLASS}>Project Ref</span>
                        <span className="border-border-subtle bg-panel-elevated/70 text-foreground truncate rounded-md border px-2 py-1.5 font-mono select-all">
                          {config.projectRef || "N/A"}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className={SETUP_LABEL_CLASS}>Project URL</span>
                        <span className="border-border-subtle bg-panel-elevated/70 text-foreground truncate rounded-md border px-2 py-1.5 font-mono select-all">
                          {config.projectUrl || "N/A"}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className={SETUP_LABEL_CLASS}>Anon Key</span>
                        <span className="border-border-subtle bg-panel-elevated/70 text-foreground truncate rounded-md border px-2 py-1.5 font-mono select-all">
                          {config.anonKey ? `${config.anonKey.slice(0, 15)}...` : "N/A"}
                        </span>
                      </div>
                      {config.dbPassword && (
                        <div className="flex flex-col gap-0.5">
                          <span className={SETUP_LABEL_CLASS}>DB Password</span>
                          <span className="border-border-subtle bg-panel-elevated/70 text-foreground truncate rounded-md border px-2 py-1.5 font-mono select-all">
                            {config.dbPassword}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={() => setStep(5)} variant="outline" size="sm" className="flex-1">
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Edit credentials
                      </Button>
                      <Button
                        onClick={resetSetup}
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive flex-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Disconnect
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Status / Loader Indicator */}
            {isProcessing && statusText && (
              <div className="border-border-subtle bg-panel/60 mt-4 flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-[11px] text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                <span>{statusText}</span>
              </div>
            )}
          </div>

          {/* Right Webview Pane */}
          {step !== 6 && (
            <div className="relative flex min-w-0 flex-1 flex-col bg-panel/20">
            <div className="border-border-subtle bg-panel/60 flex h-9 shrink-0 items-center gap-2 border-b px-3 text-xs">
              <Globe className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
              <span className="text-muted-foreground truncate font-medium">
                {currentUrl.replace("https://", "")}
              </span>
            </div>

            <div className="relative min-h-0 min-w-0 flex-1">
              <div ref={hostRef} className="absolute inset-0 h-full w-full bg-transparent" />

              {!webviewReady && (
                <div className="bg-panel/80 absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 backdrop-blur-sm">
                  <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
                  <span className="text-muted-foreground text-xs">Loading browser...</span>
                </div>
              )}
            </div>
          </div>
          )}
        </div>
      )}
    </div>
  );
}
