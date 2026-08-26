import { type ConfigValue, isRecord } from "./value";

export interface FlatEntry {
  path: string[];
  value: ConfigValue;
}

export function flatten(value: ConfigValue): { entries: FlatEntry[]; lost: string[] } {
  const entries: FlatEntry[] = [];
  const lost: string[] = [];

  const walk = (node: ConfigValue, path: string[]) => {
    if (Array.isArray(node)) {
      if (node.length === 0) return lost.push(displayPath(path));
      return node.forEach((item, index) => walk(item, [...path, String(index)]));
    }
    if (isRecord(node)) {
      const keys = Object.keys(node);
      if (keys.length === 0) return lost.push(displayPath(path));
      return keys.forEach((key) => walk(node[key], [...path, key]));
    }
    entries.push({ path, value: node });
  };

  walk(value, []);
  return { entries, lost };
}

export function nest(entries: FlatEntry[]): ConfigValue {
  const root: { [key: string]: ConfigValue } = {};

  for (const { path, value } of entries) {
    if (path.length === 0) continue;
    let node = root;
    for (const key of path.slice(0, -1)) {
      if (!isRecord(node[key])) node[key] = {};
      node = node[key] as { [key: string]: ConfigValue };
    }
    node[path[path.length - 1]] = value;
  }

  return arraysWhereIndexed(root);
}

export function displayPath(path: string[]): string {
  return path.length === 0 ? "(root)" : path.join(".");
}

function arraysWhereIndexed(node: ConfigValue): ConfigValue {
  if (!isRecord(node)) return node;

  const walked: { [key: string]: ConfigValue } = {};
  for (const key of Object.keys(node)) walked[key] = arraysWhereIndexed(node[key]);

  const keys = Object.keys(walked);
  const indexed = keys.length > 0 && keys.every((key, index) => key === String(index));
  return indexed ? keys.map((key) => walked[key]) : walked;
}
