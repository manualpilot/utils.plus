import type { TablerIcon } from "@tabler/icons-react";
import { IconBlockquote, IconBold, IconCode, IconH1, IconH2, IconH3, IconItalic, IconLink, IconList, IconListCheck, IconListNumbers, IconPhoto, IconSeparator, IconSourceCode, IconStrikethrough, IconTable } from "../../icons";
import type { FormatKind } from "./format";

export const FORMAT_GROUPS: FormatButton[][] = [
  [
    { kind: "bold", label: "Bold", Icon: IconBold, key: "Mod-b" },
    { kind: "italic", label: "Italic", Icon: IconItalic, key: "Mod-i" },
    { kind: "strike", label: "Strikethrough", Icon: IconStrikethrough },
    { kind: "code", label: "Inline Code", Icon: IconCode, key: "Mod-e" },
  ],
  [
    { kind: "h1", label: "Heading 1", Icon: IconH1 },
    { kind: "h2", label: "Heading 2", Icon: IconH2 },
    { kind: "h3", label: "Heading 3", Icon: IconH3 },
  ],
  [
    { kind: "quote", label: "Quote", Icon: IconBlockquote },
    { kind: "bullet", label: "Bullet List", Icon: IconList },
    { kind: "ordered", label: "Numbered List", Icon: IconListNumbers },
    { kind: "task", label: "Task List", Icon: IconListCheck },
  ],
  [
    { kind: "link", label: "Link", Icon: IconLink, key: "Mod-k" },
    { kind: "image", label: "Image", Icon: IconPhoto },
    { kind: "fence", label: "Code Block", Icon: IconSourceCode },
    { kind: "table", label: "Table", Icon: IconTable },
    { kind: "rule", label: "Horizontal Rule", Icon: IconSeparator },
  ],
];

export const FORMAT_BUTTONS = FORMAT_GROUPS.flat();

export interface FormatButton {
  kind: FormatKind;
  label: string;
  Icon: TablerIcon;
  key?: string;
}

export function shortcutLabel(key: string): string {
  const [modifier, ...rest] = key.split("-");
  const stroke = rest.join("-").toUpperCase();

  return modifier === "Mod" ? `${MAC ? "⌘" : "Ctrl+"}${stroke}` : `${modifier}+${stroke}`;
}

const MAC = typeof navigator !== "undefined" && /Mac|iP(?:hone|ad|od)/.test(navigator.userAgent);
