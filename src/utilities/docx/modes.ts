import type { TablerIcon } from "@tabler/icons-react";
import { IconEye, IconPencil } from "../../icons";

export const MODES = [
  { value: "view", label: "View", Icon: IconEye },
  { value: "edit", label: "Edit", Icon: IconPencil },
] as const satisfies readonly Mode[];

export type ModeId = typeof MODES[number]["value"];

export const DEFAULT_MODE: ModeId = "view";

export function isMode(value: unknown): value is ModeId {
  return MODES.some((mode) => mode.value === value);
}

interface Mode {
  value: string;
  label: string;
  Icon: TablerIcon;
}
