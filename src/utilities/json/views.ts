export const DEFAULT_DOCUMENT = "{\n  \"hello\": \"world\"\n}";

export const DEFAULT_QUERY = "$.*";

export const INDENT_OPTIONS = [
  { value: "2", label: "2 Spaces" },
  { value: "4", label: "4 Spaces" },
  { value: "8", label: "8 Spaces" },
];

export type Mode = "edit" | "query";

export const MODE_OPTIONS = [{ value: "edit", label: "Edit" }, { value: "query", label: "Query" }];

export const isMode = (value: unknown): value is Mode => value === "edit" || value === "query";

export type Output = "values" | "paths";

export const OUTPUT_OPTIONS = [{ value: "values", label: "Values" }, { value: "paths", label: "Paths" }];

export const isOutput = (value: unknown): value is Output => value === "values" || value === "paths";

export const FOLD_LEVELS: { label: string; depth: number | null }[] = [
  { label: "Collapse all", depth: 0 },
  { label: "Show 1 level", depth: 1 },
  { label: "Show 2 levels", depth: 2 },
  { label: "Show 3 levels", depth: 3 },
  { label: "Expand all", depth: null },
];
