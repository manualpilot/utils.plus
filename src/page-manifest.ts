import { ATTRIBUTIONS_PATH, HOME_PATH, PAGE_META, type PagePath } from "./page-meta.ts";

export type ManifestPath = Exclude<PagePath, typeof HOME_PATH>;

export interface PageManifest {
  build: string;
  module: string;
  imports: string[];
  css: string[];
}

export function manifestPaths(): ManifestPath[] {
  return (Object.keys(PAGE_META) as PagePath[]).filter((path): path is ManifestPath => path !== HOME_PATH);
}

export function manifestUrl(path: ManifestPath): string {
  return `${path}/manifest.json`;
}

export function pageModule(path: ManifestPath): string {
  if (path === ATTRIBUTIONS_PATH) return "attributions.tsx";
  const name = path.slice(1);
  return `utilities/${name}/${name}.tsx`;
}
