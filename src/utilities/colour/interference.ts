import { type RefObject, useEffect, useRef, useState } from "react";
import { opaque } from "./contrast";
import { parseColour } from "./parse";
import type { Rgba } from "./rgba";

export interface Interference {
  id: string;
  message: string;
}

export interface Expected {
  background: Rgba;
  colour: Rgba;
}

export interface Painting {
  background: string;
  colour: string;
  filter: string | null;
  forcedColours: boolean;
}

export function useInterference(preview: RefObject<HTMLElement | null>, expected: Expected): Interference | null {
  const [found, setFound] = useState<Interference | null>(null);
  const expectedRef = useRef(expected);
  expectedRef.current = expected;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let waited = false;

    const run = () => {
      waited = true;
      const node = preview.current;
      if (node) setFound(judgePainting(readPainting(node), expectedRef.current));
      timer = setTimeout(run, CHECK_INTERVAL);
    };

    const restart = () => {
      clearTimeout(timer);
      timer = undefined;
      if (document.visibilityState === "visible") timer = setTimeout(run, waited ? 0 : FIRST_CHECK);
    };

    restart();
    document.addEventListener("visibilitychange", restart);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", restart);
    };
  }, [preview]);

  return found;
}

export function judgePainting(painting: Painting, expected: Expected): Interference | null {
  if (painting.forcedColours) return FORCED_COLOURS;
  if (painting.filter) return FILTERED;

  const background = parseColour(painting.background);
  const colour = parseColour(painting.colour);
  if (!background || !colour) return null;

  const moved = hasMoved(background, opaque(expected.background)) || hasMoved(colour, expected.colour);
  return moved ? REPAINTED : null;
}

export function readPainting(node: HTMLElement): Painting {
  const painted = getComputedStyle(node);
  return {
    background: painted.backgroundColor,
    colour: painted.color,
    filter: filterAbove(node),
    forcedColours: window.matchMedia("(forced-colors: active)").matches,
  };
}

const FORCED_COLOURS: Interference = {
  id: "forced-colours",
  message:
    "Your browser is in forced-colours mode, so what is drawn here is the system palette rather than the colour being"
    + " converted. Every swatch, the contrast preview and the simulations are affected; the values in the boxes are not.",
};

const FILTERED: Interference = {
  id: "filter",
  message:
    "A filter is being drawn over this page, which is usually a dark-mode or colour-correction extension. Every swatch,"
    + " the contrast preview and the simulations are repainted before they reach you; the values in the boxes are not.",
};

const REPAINTED: Interference = {
  id: "repaint",
  message:
    "Something is rewriting the colours on this page, usually a dark-mode extension such as Dark Reader or a user"
    + " stylesheet. What is drawn here is not the colour being converted; the values in the boxes still are.",
};

const FIRST_CHECK = 10_000;

const CHECK_INTERVAL = 60_000;

const CHANNEL_SLACK = 2;
const ALPHA_SLACK = 0.02;

function hasMoved(painted: Rgba, asked: Rgba): boolean {
  return Math.abs(painted.r - asked.r) > CHANNEL_SLACK
    || Math.abs(painted.g - asked.g) > CHANNEL_SLACK
    || Math.abs(painted.b - asked.b) > CHANNEL_SLACK
    || Math.abs(painted.a - asked.a) > ALPHA_SLACK;
}

function filterAbove(node: HTMLElement): string | null {
  for (let above: HTMLElement | null = node; above; above = above.parentElement) {
    const { filter } = getComputedStyle(above);
    if (filter && filter !== "none") return filter;
  }
  return null;
}
