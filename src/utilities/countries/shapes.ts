import { useEffect, useState } from "react";
import { localCountryCode } from "../../common/local-country";
import worldUrl from "./world.json?url";

export type Ring = readonly number[];

export type Polygon = readonly Ring[];

export type Shape = readonly Polygon[];

export type World = Readonly<Record<string, Shape>>;

export const DEFAULT_VIEW = "default";

export interface Boundaries {
  shapes: World;
  world: World;
  absent: Readonly<Record<string, string>>;
  view: string;
}

export function useBoundaries(view: string): Boundaries | null | undefined {
  const [boundaries, setBoundaries] = useState<Boundaries | null>();

  useEffect(() => {
    let showing = true;
    read(view).then(
      (found) => showing && setBoundaries(found),
      () => showing && setBoundaries(null),
    );
    return () => {
      showing = false;
    };
  }, [view]);

  return boundaries;
}

export interface View {
  absent: Record<string, string>;
  shapes: Record<string, Shape>;
}

export function boundariesOf(base: View, patch: View | undefined, view: string): Boundaries {
  const world = base.shapes;
  if (!patch) return { shapes: world, world, absent: base.absent, view: DEFAULT_VIEW };

  const shapes: Record<string, Shape> = { ...world, ...patch.shapes };
  for (const [code, inside] of Object.entries(patch.absent)) {
    if (inside) delete shapes[code];
  }

  return { shapes, world, absent: { ...base.absent, ...patch.absent }, view };
}

const VIEWS = import.meta.glob("./views/*.json", { query: "?url", import: "default", eager: true }) as Record<
  string,
  string
>;

export const VIEW_CODES: readonly string[] = Object.keys(VIEWS)
  .map((path) => path.slice("./views/".length, -".json".length))
  .sort();

export function pickView(code: unknown): string {
  if (code === DEFAULT_VIEW) return DEFAULT_VIEW;
  const named = typeof code === "string" ? code.toUpperCase() : undefined;
  return named && VIEW_CODES.includes(named) ? named : localView();
}

export function localView(): string {
  const code = localCountryCode();
  return VIEW_CODES.includes(code) ? code : DEFAULT_VIEW;
}

const READ = new Map<string, Promise<Boundaries>>();

function read(view: string): Promise<Boundaries> {
  let asked = READ.get(view);
  if (!asked) {
    READ.set(view, asked = load(view));
    asked.catch(() => READ.delete(view));
  }
  return asked;
}

async function load(view: string): Promise<Boundaries> {
  const url = VIEWS[`./views/${view}.json`];
  const [base, patch] = await Promise.all([world(), url ? json<View>(url) : undefined]);
  return boundariesOf(base, patch, view);
}

let reading: Promise<View> | undefined;

function world(): Promise<View> {
  if (!reading) {
    reading = json<View>(worldUrl);
    reading.catch(() => {
      reading = undefined;
    });
  }
  return reading;
}

async function json<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return await response.json() as T;
}
