import { type ComponentType, use } from "react";
import { BUILD_TIME } from "./common/build-date";
import { type ManifestPath, manifestUrl, type PageManifest } from "./page-manifest";

export function PageLoader({ path }: { path: ManifestPath }) {
  const Page = use(loadPage(path));
  return <Page />;
}

const loaded = new Map<ManifestPath, Promise<ComponentType>>();

export function loadPage(path: ManifestPath): Promise<ComponentType> {
  let pending = loaded.get(path);
  if (!pending) {
    pending = fetchPage(path);
    pending.catch(() => loaded.delete(path));
    loaded.set(path, pending);
  }
  return pending;
}

async function fetchPage(path: ManifestPath): Promise<ComponentType> {
  const url = manifestUrl(path);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  const manifest: PageManifest = await response.json();

  if (manifest.build !== BUILD_TIME && reloadOnce(manifest.build)) return new Promise(() => {});

  const styles = manifest.css.map(stylesheet);
  manifest.imports.forEach(modulePreload);
  const [page] = await Promise.all([import(/* @vite-ignore */ manifest.module), ...styles]);
  return page.default;
}

function reloadOnce(build: string): boolean {
  try {
    if (sessionStorage.getItem(RELOADED_FOR) === build) return false;
    sessionStorage.setItem(RELOADED_FOR, build);
  } catch {
    return false;
  }
  location.reload();
  return true;
}

const RELOADED_FOR = "page-loader-reloaded-for";

function stylesheet(href: string): Promise<void> {
  if (document.querySelector(`link[rel="stylesheet"][href="${href}"]`)) return Promise.resolve();
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.crossOrigin = "";
  link.href = href;
  const settled = new Promise<void>((resolve) => {
    link.addEventListener("load", () => resolve());
    link.addEventListener("error", () => resolve());
  });
  document.head.append(link);
  return settled;
}

function modulePreload(href: string): void {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "modulepreload";
  link.crossOrigin = "";
  link.href = href;
  document.head.append(link);
}
