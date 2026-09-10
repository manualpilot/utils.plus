import { json as jsonLanguage, jsonParseLinter } from "@codemirror/lang-json";
import { linter, lintGutter } from "@codemirror/lint";
import { EditorView, type Extension } from "@uiw/react-codemirror";
import { EDITOR_SURFACE } from "../../common/editor-theme";
import { CONTAINER_COUNTS } from "./counts";
import { isJsonLines } from "./lines";

const HELD = new Map<boolean, Extension[]>();

export function editorExtensions(counts: boolean): Extension[] {
  const held = HELD.get(counts);
  if (held) return held;

  const built = [
    jsonLanguage(),
    counts ? CONTAINER_COUNTS : [],
    linter(documentLinter),
    lintGutter(),
    EditorView.lineWrapping,
    ...EDITOR_SURFACE,
  ];

  HELD.set(counts, built);
  return built;
}

const parseLinter = jsonParseLinter();

function documentLinter(view: EditorView) {
  const found = parseLinter(view);
  return found.length && isJsonLines(view.state.doc.toString()) ? [] : found;
}

const RESULTS = new Map<boolean, Extension[]>();

export function resultExtensions(counts: boolean): Extension[] {
  const held = RESULTS.get(counts);
  if (held) return held;

  const built = [
    jsonLanguage(),
    counts ? CONTAINER_COUNTS : [],
    EditorView.editable.of(false),
    EditorView.contentAttributes.of({ "aria-label": "Query result" }),
    EditorView.lineWrapping,
    ...EDITOR_SURFACE,
  ];

  RESULTS.set(counts, built);
  return built;
}
