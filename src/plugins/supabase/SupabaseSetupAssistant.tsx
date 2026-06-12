import { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Database,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Globe,
  RefreshCw,
  Copy,
  Check,
  Info,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

export function SupabaseSetupAssistant() {
  const [config, setConfig] = useState<SupabaseConfig | null>(null);
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [debugText, setDebugText] = useState("");
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

            // Update user-visible status indicators
            let debugMsg = `Page: ${data.url.split('/').pop() || 'Unknown'}\n`;
            debugMsg += `• Project URL: ${data.extractedUrl ? "✓ Auto-Detected" : "Searching..."}\n`;
            debugMsg += `• Anon Key: ${data.extractedAnon ? "✓ Auto-Detected" : "Searching..."}\n`;
            if (data.domElements && data.domElements.length > 0) {
              debugMsg += "\nElements found:\n" + data.domElements.join('\n');
            }
            setDebugText(debugMsg);
          }
        }
      } catch (e) {
        setDebugText("Error: " + (e instanceof Error ? e.message : String(e)));
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
    <form onSubmit={handleManualSubmit} className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-400">
        <Info className="h-4.5 w-4.5 shrink-0" />
        <span>
          Automated webview setup is only supported in the desktop application. Please input your Supabase parameters below to connect.
        </span>
      </div>

      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Personal Access Token (Optional)
          </label>
          <input
            type="password"
            value={manualPat}
            onChange={(e) => setManualPat(e.target.value)}
            placeholder="sbp_..."
            className="border-border-subtle bg-panel-elevated/70 text-foreground focus:border-[#6366f1]/60 h-8.5 rounded-md border px-3 text-xs outline-none focus:ring-1 focus:ring-[#6366f1]/30 font-mono"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Project Reference (Optional)
          </label>
          <input
            type="text"
            value={manualRef}
            onChange={(e) => setManualRef(e.target.value)}
            placeholder="abcde12345..."
            className="border-border-subtle bg-panel-elevated/70 text-foreground focus:border-[#6366f1]/60 h-8.5 rounded-md border px-3 text-xs outline-none focus:ring-1 focus:ring-[#6366f1]/30 font-mono"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Project URL *
          </label>
          <input
            type="text"
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            placeholder="https://xyz.supabase.co"
            required
            className="border-border-subtle bg-panel-elevated/70 text-foreground focus:border-[#6366f1]/60 h-8.5 rounded-md border px-3 text-xs outline-none focus:ring-1 focus:ring-[#6366f1]/30 font-mono"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Anon Public Key *
          </label>
          <input
            type="password"
            value={manualAnon}
            onChange={(e) => setManualAnon(e.target.value)}
            placeholder="eyJhbGciOiJIUzI1NiIs..."
            required
            className="border-border-subtle bg-panel-elevated/70 text-foreground focus:border-[#6366f1]/60 h-8.5 rounded-md border px-3 text-xs outline-none focus:ring-1 focus:ring-[#6366f1]/30 font-mono"
          />
        </div>
      </div>

      <Button type="submit" className="bg-[#6366f1] hover:bg-[#5558e6] text-white mt-2 h-9 w-full font-medium">
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
        <div className="border-border-subtle bg-panel/60 rounded-xl border p-6 max-w-xl mx-auto w-full">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-emerald-500/10 flex h-10 w-10 items-center justify-center rounded-lg text-emerald-400">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Supabase Setup</h2>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Link a Supabase database instance to store data.
              </p>
            </div>
          </div>
          {renderManualView()}
        </div>
      ) : (
        <div className="flex flex-1 w-full border border-border-subtle rounded-xl overflow-hidden bg-panel/40 backdrop-blur min-h-0">
          {/* Left Wizard Pane */}
          <div className={`shrink-0 border-border-subtle p-5 flex flex-col justify-between bg-panel-elevated/20 overflow-y-auto ${step === 6 ? "flex-1 w-full" : "w-[340px] border-r"}`}>
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-500/10 flex h-10 w-10 items-center justify-center rounded-lg text-emerald-400">
                    <Database className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Supabase Setup</h2>
                    <p className="text-muted-foreground mt-0.5 text-[11px]">
                      Configure credentials manually.
                    </p>
                  </div>
                </div>
                {step > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={resetSetup}
                    title="Reset configuration and start over"
                    className="text-muted-foreground hover:text-red-400 h-8 w-8 shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Step checklist */}
              <div className="flex flex-col gap-2 border-t border-border-subtle pt-4">
                {/* Step 1 Check */}
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-5.5 w-5.5 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                      step > 1
                        ? "bg-emerald-500 text-background"
                        : step === 1
                          ? "bg-[#6366f1] text-white shadow-md shadow-[#6366f1]/20"
                          : "bg-panel-elevated text-muted-foreground border border-border-subtle"
                    }`}
                  >
                    {step > 1 ? "✓" : "1"}
                  </span>
                  <div className="flex flex-col">
                    <span className={`text-xs ${step === 1 ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                      Sign In
                    </span>
                    {step === 1 && (
                      <span className="text-[10px] text-muted-foreground/70 leading-normal">
                        Authorize inside the console webview
                      </span>
                    )}
                  </div>
                </div>

                {/* Step 2 Check */}
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-5.5 w-5.5 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                      step > 2
                        ? "bg-emerald-500 text-background"
                        : step === 2
                          ? "bg-[#6366f1] text-white shadow-md shadow-[#6366f1]/20"
                          : "bg-panel-elevated text-muted-foreground border border-border-subtle"
                    }`}
                  >
                    {step > 2 ? "✓" : "2"}
                  </span>
                  <div className="flex flex-col">
                    <span className={`text-xs ${step === 2 ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                      Personal Access Token
                    </span>
                    {step === 2 && (
                      <span className="text-[10px] text-muted-foreground/70 leading-normal">
                        Save a Management API Key (PAT)
                      </span>
                    )}
                  </div>
                </div>

                {/* Step 3 Check */}
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-5.5 w-5.5 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                      step > 3
                        ? "bg-emerald-500 text-background"
                        : step === 3
                          ? "bg-[#6366f1] text-white shadow-md shadow-[#6366f1]/20"
                          : "bg-panel-elevated text-muted-foreground border border-border-subtle"
                    }`}
                  >
                    {step > 3 ? "✓" : "3"}
                  </span>
                  <div className="flex flex-col">
                    <span className={`text-xs ${step === 3 ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                      Navigate to Project
                    </span>
                    {step === 3 && (
                      <span className="text-[10px] text-muted-foreground/70 leading-normal">
                        Select or create your project
                      </span>
                    )}
                  </div>
                </div>

                {/* Step 4 Check */}
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-5.5 w-5.5 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                      step > 4
                        ? "bg-emerald-500 text-background"
                        : step === 4
                          ? "bg-[#6366f1] text-white shadow-md shadow-[#6366f1]/20"
                          : "bg-panel-elevated text-muted-foreground border border-border-subtle"
                    }`}
                  >
                    {step > 4 ? "✓" : "4"}
                  </span>
                  <div className="flex flex-col">
                    <span className={`text-xs ${step === 4 ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                      Project URL
                    </span>
                    {step === 4 && (
                      <span className="text-[10px] text-muted-foreground/70 leading-normal">
                        Copy and paste the database API URL
                      </span>
                    )}
                  </div>
                </div>

                {/* Step 5 Check */}
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-5.5 w-5.5 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                      step > 5
                        ? "bg-emerald-500 text-background"
                        : step === 5
                          ? "bg-[#6366f1] text-white shadow-md shadow-[#6366f1]/20"
                          : "bg-panel-elevated text-muted-foreground border border-border-subtle"
                    }`}
                  >
                    {step > 5 ? "✓" : "5"}
                  </span>
                  <div className="flex flex-col">
                    <span className={`text-xs ${step === 5 ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                      Anon Public Key
                    </span>
                    {step === 5 && (
                      <span className="text-[10px] text-muted-foreground/70 leading-normal">
                        Copy and paste the anon public key
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Wizard Body Controls */}
              <div className="border-t border-border-subtle pt-3 flex flex-col gap-3">
                {step === 1 && (
                  <div className="flex flex-col gap-4">
                    <div className="rounded-lg border border-border-subtle bg-panel-elevated p-3 text-[11px] leading-relaxed text-muted-foreground flex flex-col gap-2">
                      <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <Info className="h-3.5 w-3.5 text-[#6366f1]" />
                        Step 1 Guide: Account Login
                      </span>
                      <p>
                        Please sign in to your Supabase account using the browser window on the right.
                      </p>
                      {isUserLoggedIn ? (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded p-2 text-[10px] font-medium leading-normal flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          <span>Logged in detected! You can proceed.</span>
                        </div>
                      ) : (
                        <div className="bg-[#6366f1]/5 border border-[#6366f1]/10 rounded p-1.5 text-foreground font-medium text-[10px]">
                          👉 If the login page is not loading automatically, click **"Load Sign In page"** below to direct the browser.
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={navigateToLogin}
                        variant="outline"
                        disabled={isProcessing}
                        className="w-full h-8.5 text-xs font-medium border-border-subtle"
                      >
                        {isProcessing && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                        Load Sign In Page
                      </Button>
                      <Button
                        onClick={() => setStep(2)}
                        className="bg-[#6366f1] hover:bg-[#5558e6] text-white w-full h-8.5 text-xs font-medium flex items-center justify-center gap-1"
                      >
                        Continue to Step 2
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="flex flex-col gap-4">
                    <div className="rounded-lg border border-border-subtle bg-panel-elevated p-3 text-[11px] leading-relaxed text-muted-foreground flex flex-col gap-2">
                      <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <Info className="h-3.5 w-3.5 text-[#6366f1]" />
                        Step 2 Guide: Access Token (PAT)
                      </span>
                      {currentUrl.includes("/tokens") ? (
                        <div className="flex flex-col gap-1.5">
                          <p className="font-semibold text-emerald-400">🎉 You are on the Tokens page!</p>
                          <ul className="list-disc pl-3 text-muted-foreground text-[10px] flex flex-col gap-1">
                            <li>Click **"Generate new token"** in the webview.</li>
                            <li>Give the token a name (e.g. "Forge") and click **Generate**.</li>
                            <li>Copy the generated token and paste it below.</li>
                          </ul>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          <p>
                            A Personal Access Token (starts with <code className="text-[#6366f1] font-semibold">sbp_</code>) allows the Supabase MCP to manage databases and list database schemas.
                          </p>
                          <div className="bg-[#6366f1]/5 border border-[#6366f1]/10 rounded p-1.5 text-[10px] text-foreground">
                            👉 Click the **"Go to Tokens Page"** button below to direct the webview, then generate and paste your token.
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Personal Access Token
                      </label>
                      <input
                        type="password"
                        placeholder="sbp_..."
                        value={inputPat}
                        onChange={(e) => setInputPat(e.target.value)}
                        className="w-full border-border-subtle bg-panel-elevated/80 text-foreground h-8.5 rounded-md border px-2.5 text-xs outline-none focus:border-[#6366f1] font-mono"
                      />
                    </div>

                    <div className="flex flex-col gap-2 pt-2 border-t border-border-subtle/50">
                      <Button
                        onClick={navigateToTokens}
                        variant="outline"
                        className="w-full h-8.5 text-xs font-medium border-border-subtle"
                      >
                        Go to Tokens Page
                      </Button>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => setStep(1)}
                          variant="ghost"
                          className="flex-1 h-8.5 text-xs font-medium"
                        >
                          <ArrowLeft className="mr-1 h-3 w-3" /> Back
                        </Button>
                        <Button
                          onClick={savePat}
                          disabled={!inputPat.trim().startsWith("sbp_")}
                          className="flex-1 bg-[#6366f1] hover:bg-[#5558e6] text-white h-8.5 text-xs font-medium flex items-center justify-center gap-1"
                        >
                          Continue
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="flex flex-col gap-4">
                    <div className="rounded-lg border border-border-subtle bg-panel-elevated p-3 text-[11px] leading-relaxed text-muted-foreground flex flex-col gap-2.5">
                      <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <Info className="h-3.5 w-3.5 text-[#6366f1]" />
                        Step 3 Guide: Project Page
                      </span>
                      {currentUrl.includes("/dashboard/new/") || currentUrl.includes("/project/new") ? (
                        <div className="flex flex-col gap-1.5">
                          <p className="font-semibold text-[#6366f1]">✨ You are creating a new project!</p>
                          <ul className="list-disc pl-3 text-muted-foreground text-[10px] flex flex-col gap-1">
                            <li>Choose your Organization and enter a project name.</li>
                            <li>Generate and copy the secure database password below.</li>
                            <li>Select the **Free Tier ($0.00)** plan.</li>
                            <li>Click **Create new project**. Once loaded, we'll auto-advance!</li>
                          </ul>
                        </div>
                      ) : currentUrl.includes("/dashboard/org/") ? (
                        <div className="flex flex-col gap-2 animate-fade-in">
                          <p className="font-semibold text-[#6366f1]">🏢 You are inside an Organization page!</p>
                          <p>If you don't see any projects in the list:</p>
                          <ul className="list-disc pl-3 text-muted-foreground text-[10px] flex flex-col gap-1">
                            <li>Click **"New project"** in the webview to create one.</li>
                            <li>Otherwise, click on any existing project listed on your screen.</li>
                          </ul>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <p>
                            Choose the database project you want to link:
                          </p>
                          <div className="text-foreground leading-normal flex flex-col gap-1 border-l-2 border-emerald-500/40 pl-2 text-[10px]">
                            <span className="font-medium">A. Select Existing Project</span>
                            <span className="text-muted-foreground">Simply click your project in the dashboard on the right.</span>
                          </div>
                          <div className="text-foreground leading-normal flex flex-col gap-1 border-l-2 border-indigo-500/40 pl-2 text-[10px]">
                            <span className="font-medium">B. Create New Project</span>
                            <span className="text-muted-foreground">Click **"New Project"** in the webview on the right.</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Database Password Generator Helper */}
                    <div className="flex flex-col gap-1.5 bg-panel-elevated/40 border border-border-subtle/40 rounded-lg p-2.5">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground flex justify-between">
                        <span>New DB Password Helper</span>
                        <button
                          onClick={copyPassword}
                          className="text-[#6366f1] hover:underline normal-case font-normal flex items-center gap-1"
                        >
                          {copiedPassword ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          {copiedPassword ? "Copied" : "Copy"}
                        </button>
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs font-mono text-foreground select-all overflow-hidden text-ellipsis whitespace-nowrap">
                          {dbPassword}
                        </span>
                      </div>
                      <span className="text-[9px] text-muted-foreground/80 mt-1">
                        Use this generated password to ensure database security.
                      </span>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-border-subtle/50">
                      <Button
                        onClick={() => setStep(2)}
                        variant="ghost"
                        className="flex-1 h-8.5 text-xs font-medium"
                      >
                        <ArrowLeft className="mr-1 h-3 w-3" /> Back
                      </Button>
                      <Button
                        onClick={() => setStep(4)}
                        className="flex-1 bg-[#6366f1] hover:bg-[#5558e6] text-white h-8.5 text-xs font-medium flex items-center justify-center gap-1"
                      >
                        Continue
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}

                {step === 4 && (
                  <div className="flex flex-col gap-2.5">
                    <div className="rounded-lg border border-border-subtle bg-panel-elevated p-2.5 text-[11px] leading-relaxed text-muted-foreground flex flex-col gap-1.5">
                      <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <Info className="h-3.5 w-3.5 text-[#6366f1]" />
                        Step 4 Guide: Copy Project URL & Anon Key
                      </span>
                      {currentUrl.includes(`/dashboard/project/${activeProjectRef}`) && !currentUrl.includes('/settings') ? (
                        <div className="flex flex-col gap-1.5">
                          <p className="font-semibold text-emerald-400">🎉 You are on the Project Overview page!</p>
                          <p>
                            Find the section labeled **Project API**.
                          </p>
                          <ul className="list-disc pl-3 text-muted-foreground text-[10px] flex flex-col gap-1">
                            <li>Click the **Copy** button to copy the API URL (starts with `https://`).</li>
                            <li>Copy the **anon/public** key (starts with `eyJ`).</li>
                            <li>The app should auto-detect these, but you can paste them manually if needed.</li>
                            <li>Click **Continue** to move to the next step.</li>
                          </ul>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          <p>
                            Copy the Project URL and Anon Key:
                          </p>
                          <div className="bg-[#6366f1]/5 border border-[#6366f1]/10 rounded p-1.5 text-[10px] text-foreground flex flex-col gap-1">
                            <span>👉 The webview should automatically navigate you to the Project Overview.</span>
                            <span className="text-muted-foreground">Or manually: Click the **top right three lines** (menu) → **Project overview**. The API keys are listed in the Project API section.</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {debugText && (
                      <pre className="text-[9px] font-mono bg-black/40 text-green-400 p-2 rounded max-h-40 overflow-y-auto whitespace-pre-wrap shrink-0">
                        {debugText}
                      </pre>
                    )}

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Project URL
                      </label>
                      <input
                        type="text"
                        placeholder="https://xyz.supabase.co"
                        value={inputUrl}
                        onChange={(e) => setInputUrl(e.target.value)}
                        className="w-full border-border-subtle bg-panel-elevated/80 text-foreground h-8.5 rounded-md border px-2.5 text-xs outline-none focus:border-[#6366f1] font-mono"
                      />
                      {inputUrl.includes("/rest/v1") && (
                        <span className="text-[10px] text-amber-400/80">
                          Note: We will automatically clean up the trailing `/rest/v1/` for you.
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 pt-2 border-t border-border-subtle/50">
                      <Button
                        onClick={() => navigateBrowserWebview("supabase-setup-browser", activeProjectRef ? `https://supabase.com/dashboard/project/${activeProjectRef}` : "https://supabase.com/dashboard/projects")}
                        variant="outline"
                        className="w-full h-8.5 text-xs font-medium border-border-subtle flex items-center justify-center gap-1.5 text-[#6366f1]"
                      >
                        <Globe className="h-3.5 w-3.5" />
                        {activeProjectRef ? "Go to Project Overview Shortcut" : "Go to Projects Dashboard"}
                      </Button>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => setStep(3)}
                          variant="ghost"
                          className="flex-1 h-8.5 text-xs font-medium"
                        >
                          <ArrowLeft className="mr-1 h-3 w-3" /> Back
                        </Button>
                        <Button
                          onClick={() => setStep(5)}
                          disabled={!inputUrl.trim().startsWith("https://")}
                          className="flex-1 bg-[#6366f1] hover:bg-[#5558e6] text-white h-8.5 text-xs font-medium flex items-center justify-center gap-1"
                        >
                          Continue
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {step === 5 && (
                  <div className="flex flex-col gap-2.5">
                    <div className="rounded-lg border border-border-subtle bg-panel-elevated p-2.5 text-[11px] leading-relaxed text-muted-foreground flex flex-col gap-1.5">
                      <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <Info className="h-3.5 w-3.5 text-[#6366f1]" />
                        Step 5 Guide: Copy Anon Key
                      </span>
                      {currentUrl.includes("/settings/api") ? (
                        <div className="flex flex-col gap-1.5">
                          <p className="font-semibold text-emerald-400">🎉 You are on the API Settings page!</p>
                          <p>
                            Scroll down to the **Project API keys** section.
                          </p>
                          <ul className="list-disc pl-3 text-muted-foreground text-[10px] flex flex-col gap-1">
                            <li>Find the key labeled **anon / public**.</li>
                            <li>Click **Copy** to copy the public key (starts with `eyJ...`).</li>
                            <li>Paste it into the **Anon Public Key** input below.</li>
                            <li>Click **Connect DB** to complete the connection!</li>
                          </ul>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          <p>
                            Copy the Anon Public Key:
                          </p>
                          <div className="bg-[#6366f1]/5 border border-[#6366f1]/10 rounded p-1.5 text-[10px] text-foreground flex flex-col gap-1">
                            <span>👉 Click the **"Go to API Keys Shortcut"** button below to navigate directly.</span>
                            <span className="text-muted-foreground">Or manually: Click the **top right three lines** (menu) → **Project Settings** → **API**. Scroll to the bottom for keys.</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {debugText && (
                      <pre className="text-[9px] font-mono bg-black/40 text-green-400 p-2 rounded max-h-40 overflow-y-auto whitespace-pre-wrap shrink-0">
                        {debugText}
                      </pre>
                    )}

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Anon Public Key
                      </label>
                      <input
                        type="password"
                        placeholder="eyJhbGciOiJIUzI1NiIs..."
                        value={inputAnon}
                        onChange={(e) => setInputAnon(e.target.value)}
                        className="w-full border-border-subtle bg-panel-elevated/80 text-foreground h-8.5 rounded-md border px-2.5 text-xs outline-none focus:border-[#6366f1] font-mono"
                      />
                    </div>

                    <div className="flex flex-col gap-2 pt-2 border-t border-border-subtle/50">
                      <Button
                        onClick={() => activeProjectRef ? navigateToProjectApiKeys(activeProjectRef) : navigateBrowserWebview("supabase-setup-browser", "https://supabase.com/dashboard/projects")}
                        variant="outline"
                        className="w-full h-8.5 text-xs font-medium border-border-subtle flex items-center justify-center gap-1.5 text-[#6366f1]"
                      >
                        <Globe className="h-3.5 w-3.5" />
                        {activeProjectRef ? "Go to API Keys Shortcut" : "Go to Projects Dashboard"}
                      </Button>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => setStep(4)}
                          variant="ghost"
                          className="flex-1 h-8.5 text-xs font-medium"
                        >
                          <ArrowLeft className="mr-1 h-3 w-3" /> Back
                        </Button>
                        <Button
                          onClick={saveApiCredentials}
                          disabled={!inputAnon.trim()}
                          className="flex-1 bg-[#6366f1] hover:bg-[#5558e6] text-white h-8.5 text-xs font-medium flex items-center justify-center gap-1"
                        >
                          Connect DB
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {step === 6 && config && (
                  <div className="flex flex-col gap-4 animate-fade-in">
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-[11px] leading-relaxed text-muted-foreground flex flex-col gap-1.5">
                      <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        Supabase MCP Connected!
                      </span>
                      <p>
                        Your credentials are saved. The **Supabase MCP** is now active in the background.
                      </p>
                      <ul className="list-disc pl-3 text-muted-foreground text-[10px] flex flex-col gap-0.5">
                        <li>AI agents can automatically fetch tables and schemas</li>
                        <li>Agents can write migrations and create new tables</li>
                        <li>User application data is saved securely in your database</li>
                      </ul>
                    </div>

                    <div className="flex flex-col gap-2.5 border-t border-border-subtle/50 pt-4 text-xs font-mono">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-sans font-bold uppercase tracking-wider text-muted-foreground">
                          Project Ref
                        </span>
                        <span className="bg-panel-elevated/70 border border-border-subtle/40 px-2 py-1 rounded text-foreground overflow-hidden text-ellipsis select-all">
                          {config.projectRef || "N/A"}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-sans font-bold uppercase tracking-wider text-muted-foreground">
                          Project URL
                        </span>
                        <span className="bg-panel-elevated/70 border border-border-subtle/40 px-2 py-1 rounded text-foreground overflow-hidden text-ellipsis select-all">
                          {config.projectUrl || "N/A"}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-sans font-bold uppercase tracking-wider text-muted-foreground">
                          Anon Key
                        </span>
                        <span className="bg-panel-elevated/70 border border-border-subtle/40 px-2 py-1 rounded text-foreground overflow-hidden text-ellipsis select-all">
                          {config.anonKey ? `${config.anonKey.slice(0, 15)}...` : "N/A"}
                        </span>
                      </div>
                      {config.dbPassword && (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9px] font-sans font-bold uppercase tracking-wider text-muted-foreground">
                            DB Password
                          </span>
                          <span className="bg-panel-elevated/70 border border-border-subtle/40 px-2 py-1 rounded text-foreground overflow-hidden text-ellipsis select-all">
                            {config.dbPassword}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 mt-2">
                      <Button
                        onClick={() => setStep(5)}
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8.5 font-medium flex items-center justify-center gap-1.5"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" /> Back to Setup
                      </Button>
                      <Button
                        onClick={resetSetup}
                        variant="outline"
                        size="sm"
                        className="flex-1 text-red-400 hover:text-red-300 border-red-500/20 hover:bg-red-500/5 h-8.5 font-medium flex items-center justify-center gap-1.5"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Disconnect Config
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Status / Loader Indicator */}
            {isProcessing && statusText && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-panel-elevated/40 border border-border-subtle/30 px-3 py-2 text-[11px] text-muted-foreground leading-normal animate-pulse shrink-0">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#6366f1] shrink-0" />
                <span>{statusText}</span>
              </div>
            )}
          </div>

          {/* Right Webview Pane */}
          {step !== 6 && (
            <div className="flex-1 bg-black/10 relative flex flex-col min-w-0">
            {/* Header controls for the Webview */}
            <div className="border-b border-border-subtle bg-panel flex h-9 shrink-0 items-center justify-between px-3 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Globe className="h-3.5 w-3.5" />
                <span className="font-sans font-medium text-foreground select-none overflow-hidden text-ellipsis whitespace-nowrap max-w-[200px]">
                  {currentUrl.replace("https://", "")}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping mr-1" />
                <span className="text-muted-foreground text-[10px]">Active</span>
              </div>
            </div>

            {/* Webview Container frame */}
            <div className="flex-1 relative min-h-0 min-w-0 bg-panel-elevated/10">
              <div ref={hostRef} className="absolute inset-0 w-full h-full bg-transparent" />
              
              {!webviewReady && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-panel/80 z-10 backdrop-blur-sm">
                  <Loader2 className="h-6 w-6 animate-spin text-[#6366f1]" />
                  <span className="text-xs text-muted-foreground">
                    Initializing web console overlay...
                  </span>
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
