import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import css from "highlight.js/lib/languages/css";
import go from "highlight.js/lib/languages/go";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import kotlin from "highlight.js/lib/languages/kotlin";
import python from "highlight.js/lib/languages/python";
import ruby from "highlight.js/lib/languages/ruby";
import rust from "highlight.js/lib/languages/rust";
import shell from "highlight.js/lib/languages/shell";
import sql from "highlight.js/lib/languages/sql";
import swift from "highlight.js/lib/languages/swift";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";

hljs.registerLanguage("python", python);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("go", go);
hljs.registerLanguage("java", java);
hljs.registerLanguage("kotlin", kotlin);
hljs.registerLanguage("swift", swift);
hljs.registerLanguage("ruby", ruby);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("shell", shell);
hljs.registerLanguage("json", json);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("css", css);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("c", c);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("csharp", csharp);

const LANGUAGE_LABELS: Record<string, string> = {
  text: "Plain text",
  plaintext: "Plain text",
  python: "Python",
  py: "Python",
  javascript: "JavaScript",
  js: "JavaScript",
  typescript: "TypeScript",
  ts: "TypeScript",
  tsx: "TypeScript",
  jsx: "JavaScript",
  rust: "Rust",
  rs: "Rust",
  go: "Go",
  java: "Java",
  kotlin: "Kotlin",
  swift: "Swift",
  ruby: "Ruby",
  rb: "Ruby",
  bash: "Bash",
  sh: "Shell",
  shell: "Shell",
  json: "JSON",
  yaml: "YAML",
  yml: "YAML",
  html: "HTML",
  css: "CSS",
  sql: "SQL",
  csharp: "C#",
  cs: "C#",
  cpp: "C++",
  c: "C",
};

const HLJS_ALIASES: Record<string, string> = {
  py: "python",
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  rs: "rust",
  sh: "bash",
  shell: "bash",
  yml: "yaml",
  cs: "csharp",
  "c++": "cpp",
  "c#": "csharp",
};

export function languageDisplayName(language: string): string {
  const key = language.trim().toLowerCase();
  return LANGUAGE_LABELS[key] ?? (key ? key.charAt(0).toUpperCase() + key.slice(1) : "Code");
}

const RUNNABLE_SHELL_LANGUAGES = new Set([
  "bash",
  "sh",
  "shell",
  "zsh",
  "fish",
  "powershell",
  "ps1",
  "pwsh",
  "cmd",
  "bat",
  "console",
  "terminal",
]);

/** Shell/terminal fences that can be executed via Run. */
export function isRunnableShellLanguage(language: string): boolean {
  const raw = language.trim().toLowerCase();
  return RUNNABLE_SHELL_LANGUAGES.has(HLJS_ALIASES[raw] ?? raw);
}

function resolveHljsLanguage(language: string): string | null {
  const raw = language.trim().toLowerCase();
  if (!raw || raw === "text" || raw === "plaintext") return null;
  const id = HLJS_ALIASES[raw] ?? raw;
  return hljs.getLanguage(id) ? id : null;
}

/** Highlight code as HTML using highlight.js + VS Code Dark+ colors in CSS. */
export function highlightCodeHtml(code: string, language: string): string {
  const lang = resolveHljsLanguage(language);
  if (lang) {
    try {
      return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
    } catch {
      /* fall through */
    }
  }
  return hljs.highlightAuto(code).value;
}
