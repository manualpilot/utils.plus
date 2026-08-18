import type { TablerIcon } from "@tabler/icons-react";
import { IconColumns2, IconEye, IconPencil } from "../../icons";

export const VIEWS = [
  { value: "split", label: "Split", Icon: IconColumns2 },
  { value: "editor", label: "Editor", Icon: IconPencil },
  { value: "preview", label: "Preview", Icon: IconEye },
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
