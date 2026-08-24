import { EditorView, Prec } from "@uiw/react-codemirror";

export const EDITOR_BACKGROUND = "var(--mantine-color-dark-6)";

const ACTIVE_LINE_TINT = "rgba(255, 255, 255, 0.04)";

const PANEL_BACKGROUND = "var(--mantine-color-dark-7)";

const MATCH_TINT = "rgba(255, 112, 67, 0.28)";
const CURRENT_MATCH_TINT = "rgba(255, 112, 67, 0.45)";

const CONTROL_HEIGHT = "30px";
const CLOSE_SIZE = "22px";

const SEARCH_PANEL = EditorView.theme({
  ".cm-panels": {
    backgroundColor: PANEL_BACKGROUND,
    color: "var(--mantine-color-text)",
    fontFamily: "var(--mantine-font-family)",
  },
  ".cm-panels.cm-panels-bottom": { borderTop: "1px solid var(--mantine-color-default-border)" },
  ".cm-panels.cm-panels-top": { borderBottom: "1px solid var(--mantine-color-default-border)" },
  ".cm-panel.cm-search, .cm-panel.cm-dialog": {
    position: "relative",
    lineHeight: 0,
    padding: "calc(var(--mantine-spacing-xs) / 2) var(--mantine-spacing-xs)",
    paddingRight: `calc(var(--mantine-spacing-xs) * 2 + ${CLOSE_SIZE})`,
    "& input, & button, & label": {
      margin: "calc(var(--mantine-spacing-xs) / 2) var(--mantine-spacing-xs) calc(var(--mantine-spacing-xs) / 2) 0",
      verticalAlign: "middle",
    },
    "& label": {
      display: "inline-flex",
      alignItems: "center",
      height: CONTROL_HEIGHT,
      gap: "calc(var(--mantine-spacing-xs) / 2)",
      fontSize: "var(--mantine-font-size-xs)",
      color: "var(--mantine-color-dimmed)",
      whiteSpace: "nowrap",
      cursor: "pointer",
      userSelect: "none",
    },
    "& label input[type=checkbox]": {
      width: "14px",
      height: "14px",
      margin: 0,
      accentColor: "var(--mantine-primary-color-filled)",
      cursor: "pointer",
    },
  },
  ".cm-textfield": {
    boxSizing: "border-box",
    width: "14rem",
    maxWidth: "100%",
    height: CONTROL_HEIGHT,
    padding: "0 var(--mantine-spacing-xs)",
    font: "inherit",
    fontSize: "var(--mantine-font-size-xs)",
    color: "var(--mantine-color-text)",
    backgroundColor: "var(--mantine-color-default)",
    border: "1px solid var(--mantine-color-default-border)",
    borderRadius: "var(--mantine-radius-default)",
    "&::placeholder": { color: "var(--mantine-color-placeholder)" },
    "&:focus": { outline: "none", borderColor: "var(--mantine-primary-color-filled)" },
  },
  ".cm-button": {
    boxSizing: "border-box",
    height: CONTROL_HEIGHT,
    padding: "0 var(--mantine-spacing-sm)",
    font: "inherit",
    fontSize: "var(--mantine-font-size-xs)",
    fontWeight: 500,
    color: "var(--mantine-color-default-color)",
    backgroundColor: "var(--mantine-color-default)",
    backgroundImage: "none",
    border: "1px solid var(--mantine-color-default-border)",
    borderRadius: "var(--mantine-radius-default)",
    cursor: "pointer",
    "&:hover": { backgroundColor: "var(--mantine-color-default-hover)" },
    "&:active": { backgroundImage: "none", backgroundColor: "var(--mantine-color-default-hover)" },
    "&:focus-visible": { outline: "2px solid var(--mantine-primary-color-filled)", outlineOffset: "2px" },
  },
  ".cm-panel.cm-search [name=close], .cm-dialog-close": {
    position: "absolute",
    top: "var(--mantine-spacing-xs)",
    right: "var(--mantine-spacing-xs)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: CLOSE_SIZE,
    height: CLOSE_SIZE,
    padding: 0,
    font: "inherit",
    fontSize: "16px",
    lineHeight: 1,
    color: "var(--mantine-color-dimmed)",
    backgroundColor: "transparent",
    border: "none",
    borderRadius: "var(--mantine-radius-default)",
    cursor: "pointer",
    "&:hover": { backgroundColor: "var(--mantine-color-default-hover)", color: "var(--mantine-color-text)" },
    "&:focus-visible": { outline: "2px solid var(--mantine-primary-color-filled)", outlineOffset: "2px" },
  },
  ".cm-searchMatch": { backgroundColor: MATCH_TINT, outline: "none" },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: CURRENT_MATCH_TINT,
    outline: "1px solid var(--mantine-primary-color-filled)",
  },
});

export const EDITOR_SURFACE = [
  EditorView.theme({ "&.cm-focused": { outline: "none" } }),
  Prec.highest(EditorView.theme({
    "&": { backgroundColor: EDITOR_BACKGROUND },
    ".cm-gutters": { backgroundColor: EDITOR_BACKGROUND },
    ".cm-activeLine": { backgroundColor: ACTIVE_LINE_TINT },
    ".cm-activeLineGutter": { backgroundColor: ACTIVE_LINE_TINT },
  })),
  Prec.highest(SEARCH_PANEL),
];

export const EDITOR_STYLE = { height: "100%", fontSize: 14 };
