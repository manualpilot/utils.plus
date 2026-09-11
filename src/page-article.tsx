import { Typography } from "@mantine/core";
import { type MouseEvent, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { articleHtml, type PageContent } from "./page-document";
import type { UtilityPath } from "./page-meta";

export function PageArticle({ path }: { path: UtilityPath }) {
  const content = usePageContent(path);
  const [, navigate] = useLocation();
  const html = useMemo(() => content && articleHtml(path, content), [path, content]);

  if (!html) return null;

  return (
    <Typography
      component="article"
      className="page-article"
      onClick={(event: MouseEvent<HTMLElement>) => followLink(event, navigate)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function followLink(event: MouseEvent<HTMLElement>, navigate: (path: string) => void) {
  if (
    event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
  ) {
    return;
  }
  const link = (event.target as Element).closest("a");
  const href = link?.getAttribute("href");
  if (!href?.startsWith("/") || link?.target) return;
  event.preventDefault();
  navigate(href);
}

const CONTENTS = import.meta.glob<PageContent>("./page-content/*.ts", { import: "default" });

const loaded = new Map<string, Promise<PageContent | undefined>>();

export function loadPageContent(path: string): Promise<PageContent | undefined> {
  let pending = loaded.get(path);
  if (!pending) {
    const load = CONTENTS[`./page-content${path}.ts`];
    pending = load
      ? load().catch(() => {
        loaded.delete(path);
        return undefined;
      })
      : Promise.resolve(undefined);
    loaded.set(path, pending);
  }
  return pending;
}

function usePageContent(path: string): PageContent | undefined {
  const [state, setState] = useState<{ path: string; content?: PageContent }>();

  useEffect(() => {
    let current = true;
    loadPageContent(path).then((content) => current && setState({ path, content }));
    return () => {
      current = false;
    };
  }, [path]);

  return state?.path === path ? state.content : undefined;
}
