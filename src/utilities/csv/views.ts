import type { TablerIcon } from "@tabler/icons-react";
import { IconLayoutRows, IconPencil, IconTable } from "../../icons";

export const VIEWS = [
  { value: "split", label: "Split", Icon: IconLayoutRows },
  { value: "text", label: "Text", Icon: IconPencil },
  { value: "table", label: "Table", Icon: IconTable },
] as const satisfies readonly View[];

export const DEFAULT_VIEW: ViewId = "split";

export type ViewId = typeof VIEWS[number]["value"];

interface View {
  value: string;
  label: string;
  Icon: TablerIcon;
}

export function isView(value: string | null | undefined): value is ViewId {
  return VIEWS.some((view) => view.value === value);
}
