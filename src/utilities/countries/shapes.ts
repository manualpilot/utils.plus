import { useEffect, useState } from "react";
import { localCountryCode } from "../../common/local-country";
import worldUrl from "./world.json?url";

export type Ring = readonly number[];

export type Polygon = readonly Ring[];

export type Shape = readonly Polygon[];

export type World = Readonly<Record<string, Shape>>;

export interface Boundaries {
  shapes: World;
  world: World;
  absent: Readonly<Record<string, string>>;
  viewer: string | undefined;
}

export function useBoundaries(): Boundaries | null | undefined {
  const [boundaries, setBoundaries] = useState<Boundaries | null>();

  useEffect(() => {
    let showing = true;
    read().then(
      (found) => showing && setBoundaries(found),
      () => showing && setBoundaries(null),
    );
    return () => {
      showing = false;
    };
  }, []);

  return boundaries;
}

export interface View {
  absent: Record<string, string>;
  shapes: Record<string, Shape>;
}

export function boundariesOf(base: View, view: View | undefined, viewer: string | undefined): Boundaries {
  const world = base.shapes;
  if (!view) return { shapes: world, world, absent: base.absent, viewer: undefined };

  const shapes: Record<string, Shape> = { ...world, ...view.shapes };
  for (const [code, inside] of Object.entries(view.absent)) {
    if (inside) delete shapes[code];
  }

  return { shapes, world, absent: { ...base.absent, ...view.absent }, viewer };
}

const VIEWS = import.meta.glob("./views/*.json", { query: "?url", import: "default", eager: true }) as Record<
  string,
  string
>;

let asked: Promise<Boundaries> | undefined;

function read(): Promise<Boundaries> {
  if (!asked) {
    asked = load();
    asked.catch(() => {
      asked = undefined;
    });
  }
  return asked;
}

async function load(): Promise<Boundaries> {
  const viewer = localCountryCode();
  const url = VIEWS[`./views/${viewer}.json`];
  const [base, view] = await Promise.all([json<View>(worldUrl), url ? json<View>(url) : undefined]);
  return boundariesOf(base, view, url ? viewer : undefined);
}

async function json<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return await response.json() as T;
}
