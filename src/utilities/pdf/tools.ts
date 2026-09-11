import type { AnnotationToolOverride } from "@embedpdf/plugin-annotation";
import type { TablerIcon } from "@tabler/icons-react";
import { IconArrowUpRight, IconCircle, IconHighlight, IconLine, IconPencil, IconSquare, IconStrikethrough, IconTypography, IconUnderline } from "../../icons";

export type StyleKind = "markup" | "ink" | "shape" | "text";

export const TOOLS = [
  { id: "highlight", label: "Highlight", hint: "Drag across text to highlight it", Icon: IconHighlight },
  { id: "underline", label: "Underline", hint: "Drag across text to underline it", Icon: IconUnderline },
  { id: "strikeout", label: "Strike through", hint: "Drag across text to strike it through", Icon: IconStrikethrough },
  { id: "ink", label: "Draw", hint: "Draw freehand on the page", Icon: IconPencil },
  { id: "freeText", label: "Text", hint: "Click the page to type on it", Icon: IconTypography },
  { id: "square", label: "Rectangle", hint: "Drag to draw a rectangle", Icon: IconSquare },
  { id: "circle", label: "Ellipse", hint: "Drag to draw an ellipse", Icon: IconCircle },
  { id: "line", label: "Line", hint: "Drag to draw a line", Icon: IconLine },
  { id: "lineArrow", label: "Arrow", hint: "Drag to draw an arrow", Icon: IconArrowUpRight },
] as const satisfies readonly Tool[];

export type ToolId = typeof TOOLS[number]["id"];

const STYLES: Record<string, StyleKind> = {
  highlight: "markup",
  underline: "markup",
  strikeout: "markup",
  squiggly: "markup",
  ink: "ink",
  inkHighlighter: "ink",
  square: "shape",
  circle: "shape",
  line: "shape",
  lineArrow: "shape",
  polyline: "shape",
  polygon: "shape",
  freeText: "text",
};

export function styleOf(toolId: string | undefined | null): StyleKind | null {
  return (toolId && STYLES[toolId]) || null;
}

export function styleTarget(
  selectedTool: string | null | undefined,
  activeTool: string | null | undefined,
): Target | null {
  const selectedKind = styleOf(selectedTool);
  if (selectedKind) return { kind: selectedKind, selection: true, tool: selectedTool === activeTool };
  const toolKind = styleOf(activeTool);
  return toolKind ? { kind: toolKind, selection: false, tool: true } : null;
}

export interface Target {
  kind: StyleKind;
  selection: boolean;
  tool: boolean;
}

export const COLOURS = [
  { value: "#E44234", name: "Red" },
  { value: "#FF8D00", name: "Orange" },
  { value: "#FFCD45", name: "Yellow" },
  { value: "#5CC96E", name: "Green" },
  { value: "#25D2D1", name: "Teal" },
  { value: "#597CE2", name: "Blue" },
  { value: "#C544CE", name: "Purple" },
  { value: "#000000", name: "Black" },
  { value: "#FFFFFF", name: "White" },
] as const;

export const WIDTHS = [1, 2, 3, 4, 6, 10, 16] as const;

export const FONT_SIZES = [8, 10, 12, 14, 18, 24, 32, 48] as const;

export function colourPatch(kind: StyleKind, colour: string): Record<string, string> {
  if (kind === "text") return { fontColor: colour };
  if (kind === "shape") return { strokeColor: colour };
  return { strokeColor: colour, color: colour };
}

export function colourOf(kind: StyleKind, fields: StyleFields): string | undefined {
  return kind === "text" ? fields.fontColor : fields.strokeColor ?? fields.color;
}

export function hasWidth(kind: StyleKind): boolean {
  return kind === "ink" || kind === "shape";
}

export const LINK_CATEGORY = "link";

export const TOOL_OVERRIDES: AnnotationToolOverride[] = [
  {
    id: "freeText",
    defaults: { fontColor: "#000000", fontSize: 12 },
    behavior: { deactivateToolAfterCreate: true },
  },
  { id: "ink", defaults: { strokeWidth: 3 } },
  { id: "square", defaults: { strokeWidth: 3 } },
  { id: "circle", defaults: { strokeWidth: 3 } },
  { id: "line", defaults: { strokeWidth: 3 } },
  { id: "lineArrow", defaults: { strokeWidth: 3 } },
  { id: "stamp", behavior: { showGhost: true, deactivateToolAfterCreate: true } },
  { id: "link", categories: [LINK_CATEGORY] },
];

export const ACCENT = "var(--mantine-color-orange-6)";

export interface StyleFields {
  color?: string;
  strokeColor?: string;
  fontColor?: string;
  strokeWidth?: number;
  fontSize?: number;
}

interface Tool {
  id: string;
  label: string;
  hint: string;
  Icon: TablerIcon;
}
