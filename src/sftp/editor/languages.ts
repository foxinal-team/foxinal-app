import { json } from "@codemirror/lang-json";
import { yaml } from "@codemirror/lang-yaml";
import { markdown } from "@codemirror/lang-markdown";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { sql } from "@codemirror/lang-sql";
import { rust } from "@codemirror/lang-rust";
import { StreamLanguage } from "@codemirror/language";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { nginx } from "@codemirror/legacy-modes/mode/nginx";
import { dockerFile } from "@codemirror/legacy-modes/mode/dockerfile";
import { toml } from "@codemirror/legacy-modes/mode/toml";
import { properties } from "@codemirror/legacy-modes/mode/properties";
import { xml } from "@codemirror/legacy-modes/mode/xml";
import { diff } from "@codemirror/legacy-modes/mode/diff";
import type { Extension } from "@codemirror/state";

export type SupportedLanguageId =
  | "plaintext"
  | "json"
  | "yaml"
  | "markdown"
  | "shell"
  | "nginx"
  | "dockerfile"
  | "env"
  | "toml"
  | "xml"
  | "javascript"
  | "typescript"
  | "python"
  | "html"
  | "css"
  | "sql"
  | "rust"
  | "diff";

export interface LanguageOption {
  id: SupportedLanguageId;
  label: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { id: "plaintext", label: "Plain Text" },
  { id: "shell", label: "Shell / Bash" },
  { id: "nginx", label: "Nginx" },
  { id: "dockerfile", label: "Dockerfile" },
  { id: "env", label: "Env / Config (.env, .ini)" },
  { id: "yaml", label: "YAML" },
  { id: "json", label: "JSON" },
  { id: "toml", label: "TOML" },
  { id: "markdown", label: "Markdown" },
  { id: "python", label: "Python" },
  { id: "javascript", label: "JavaScript" },
  { id: "typescript", label: "TypeScript" },
  { id: "html", label: "HTML" },
  { id: "css", label: "CSS" },
  { id: "sql", label: "SQL" },
  { id: "rust", label: "Rust" },
  { id: "xml", label: "XML" },
  { id: "diff", label: "Diff / Patch" },
];

// Singleton instances for stability and performance
const LANG_MAP: Record<SupportedLanguageId, Extension[]> = {
  plaintext: [],
  json: [json()],
  yaml: [yaml()],
  markdown: [markdown()],
  javascript: [javascript({ jsx: true })],
  typescript: [javascript({ typescript: true, jsx: true })],
  python: [python()],
  html: [html()],
  css: [css()],
  sql: [sql()],
  rust: [rust()],
  shell: [StreamLanguage.define(shell)],
  nginx: [StreamLanguage.define(nginx)],
  dockerfile: [StreamLanguage.define(dockerFile)],
  toml: [StreamLanguage.define(toml)],
  env: [StreamLanguage.define(properties)],
  xml: [StreamLanguage.define(xml)],
  diff: [StreamLanguage.define(diff)],
};

export function getLanguageExtension(id: SupportedLanguageId): Extension[] {
  return LANG_MAP[id] ?? [];
}

/**
 * Automatically detect language from filename or extension.
 */
export function detectLanguageByFileName(fileName: string): SupportedLanguageId {
  const lower = fileName.toLowerCase().trim();

  // Exact file name checks
  if (lower === "dockerfile" || lower.startsWith("dockerfile.")) return "dockerfile";
  if (lower === "nginx.conf" || lower.endsWith(".nginx") || lower.includes("nginx")) return "nginx";
  if (lower === "caddyfile") return "nginx";
  if (lower.startsWith(".env") || lower.endsWith(".env")) return "env";
  if (lower === "cargo.lock" || lower === "cargo.toml") return "toml";
  if (lower === ".bashrc" || lower === ".zshrc" || lower === ".profile" || lower === ".bash_profile" || lower === ".zprofile") return "shell";
  if (lower === ".gitignore" || lower === ".npmignore" || lower === ".dockerignore") return "shell";

  const dotIdx = lower.lastIndexOf(".");
  if (dotIdx === -1) {
    return "plaintext";
  }

  const ext = lower.slice(dotIdx + 1);

  switch (ext) {
    case "sh":
    case "bash":
    case "zsh":
    case "fish":
    case "ksh":
    case "csh":
    case "command":
      return "shell";

    case "conf":
    case "cfg":
      if (lower.includes("nginx")) return "nginx";
      return "env";

    case "ini":
    case "env":
    case "properties":
    case "service":
    case "service-template":
    case "timer":
    case "socket":
      return "env";

    case "yml":
    case "yaml":
      return "yaml";

    case "json":
    case "jsonc":
    case "json5":
    case "babelrc":
    case "eslintrc":
    case "prettierrc":
      return "json";

    case "toml":
      return "toml";

    case "md":
    case "markdown":
    case "mdown":
    case "mkd":
      return "markdown";

    case "js":
    case "mjs":
    case "cjs":
    case "jsx":
      return "javascript";

    case "ts":
    case "mts":
    case "cts":
    case "tsx":
      return "typescript";

    case "py":
    case "pyw":
    case "wsgi":
      return "python";

    case "html":
    case "htm":
    case "xhtml":
    case "svg":
      return "html";

    case "css":
    case "scss":
    case "sass":
    case "less":
      return "css";

    case "sql":
    case "psql":
    case "mysql":
      return "sql";

    case "rs":
      return "rust";

    case "xml":
    case "plist":
    case "xaml":
      return "xml";

    case "diff":
    case "patch":
      return "diff";

    default:
      return "plaintext";
  }
}
