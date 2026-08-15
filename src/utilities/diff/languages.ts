import { StreamLanguage } from "@codemirror/language";
import type { Extension } from "@uiw/react-codemirror";

export interface LanguageEntry {
  value: string;
  label: string;
  load: (() => Promise<Extension>) | null;
}

export const LANGUAGES: LanguageEntry[] = [
  { value: "text", label: "Plain Text", load: null },
  { value: "cpp", label: "C / C++", load: () => import("@codemirror/lang-cpp").then((m) => m.cpp()) },
  { value: "css", label: "CSS", load: () => import("@codemirror/lang-css").then((m) => m.css()) },
  { value: "go", label: "Go", load: () => import("@codemirror/lang-go").then((m) => m.go()) },
  { value: "html", label: "HTML", load: () => import("@codemirror/lang-html").then((m) => m.html()) },
  { value: "java", label: "Java", load: () => import("@codemirror/lang-java").then((m) => m.java()) },
  {
    value: "javascript",
    label: "JavaScript",
    load: () => import("@codemirror/lang-javascript").then((m) => m.javascript({ jsx: true })),
  },
  { value: "json", label: "JSON", load: () => import("@codemirror/lang-json").then((m) => m.json()) },
  { value: "markdown", label: "Markdown", load: () => import("@codemirror/lang-markdown").then((m) => m.markdown()) },
  { value: "php", label: "PHP", load: () => import("@codemirror/lang-php").then((m) => m.php()) },
  { value: "python", label: "Python", load: () => import("@codemirror/lang-python").then((m) => m.python()) },
  { value: "rust", label: "Rust", load: () => import("@codemirror/lang-rust").then((m) => m.rust()) },
  {
    value: "shell",
    label: "Shell",
    load: () => import("@codemirror/legacy-modes/mode/shell").then((m) => StreamLanguage.define(m.shell)),
  },
  { value: "sql", label: "SQL", load: () => import("@codemirror/lang-sql").then((m) => m.sql()) },
  {
    value: "typescript",
    label: "TypeScript",
    load: () => import("@codemirror/lang-javascript").then((m) => m.javascript({ jsx: true, typescript: true })),
  },
  { value: "xml", label: "XML", load: () => import("@codemirror/lang-xml").then((m) => m.xml()) },
  { value: "yaml", label: "YAML", load: () => import("@codemirror/lang-yaml").then((m) => m.yaml()) },
];

export const LANGUAGE_OPTIONS = LANGUAGES.map(({ value, label }) => ({ value, label }));

export function isLanguage(value: string | undefined): value is string {
  return LANGUAGES.some((entry) => entry.value === value);
}
