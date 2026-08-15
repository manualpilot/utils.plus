export function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value === null || typeof value !== "object") return value;

  const entries = Object.keys(value).sort().map((key) => [key, sortKeys((value as Record<string, unknown>)[key])]);
  return Object.fromEntries(entries);
}
