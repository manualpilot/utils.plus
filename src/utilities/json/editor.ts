import { json as jsonLanguage, jsonParseLinter } from "@codemirror/lang-json";
import { linter, lintGutter } from "@codemirror/lint";
import { EditorView, type Extension } from "@uiw/react-codemirror";
import { EDITOR_SURFACE } from "../../common/editor-theme";
import { CONTAINER_COUNTS } from "./counts";

const HELD = new Map<boolean, Extension[]>();

export function editorExtensions(counts: boolean): Extension[] {
  const held = HELD.get(counts);
  if (held) return held;

  const built = [
    jsonLanguage(),
    counts ? CONTAINER_COUNTS : [],
    linter(jsonParseLinter()),
    lintGutter(),
    EditorView.lineWrapping,
    ...EDITOR_SURFACE,
  ];

  HELD.set(counts, built);
  return built;
}
