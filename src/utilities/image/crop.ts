import type { Rect } from "./render";

export type Handle = "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w" | "move";

export interface Bounds {
  width: number;
  height: number;
}

export const ASPECTS = [
  { value: "free", label: "Free", ratio: 0 },
  { value: "1:1", label: "Square", ratio: 1 },
  { value: "4:3", label: "4:3", ratio: 4 / 3 },
  { value: "3:2", label: "3:2", ratio: 3 / 2 },
  { value: "16:9", label: "16:9", ratio: 16 / 9 },
  { value: "3:4", label: "3:4", ratio: 3 / 4 },
  { value: "2:3", label: "2:3", ratio: 2 / 3 },
  { value: "9:16", label: "9:16", ratio: 9 / 16 },
];

export function ratioOf(aspect: string): number {
  return ASPECTS.find((entry) => entry.value === aspect)?.ratio ?? 0;
}

export function wholeImage(bounds: Bounds): Rect {
  return { x: 0, y: 0, width: bounds.width, height: bounds.height };
}

export function sameRect(left: Rect | null, right: Rect | null): boolean {
  if (!left || !right) return left === right;
  return left.x === right.x && left.y === right.y && left.width === right.width && left.height === right.height;
}

export function isWhole(rect: Rect | null, bounds: Bounds): boolean {
  return rect === null || sameRect(rect, wholeImage(bounds));
}

export function clampRect(rect: Rect, bounds: Bounds): Rect {
  const width = Math.max(MIN_SIDE, Math.min(Math.round(rect.width), bounds.width));
  const height = Math.max(MIN_SIDE, Math.min(Math.round(rect.height), bounds.height));
  return {
    x: Math.max(0, Math.min(Math.round(rect.x), bounds.width - width)),
    y: Math.max(0, Math.min(Math.round(rect.y), bounds.height - height)),
    width,
    height,
  };
}

export function dragRect(
  anchor: { x: number; y: number },
  to: { x: number; y: number },
  bounds: Bounds,
  ratio: number,
): Rect {
  let width = Math.abs(to.x - anchor.x);
  let height = Math.abs(to.y - anchor.y);
  if (ratio > 0) {
    if (width / ratio > height) height = width / ratio;
    else width = height * ratio;
  }
  const x = to.x < anchor.x ? anchor.x - width : anchor.x;
  const y = to.y < anchor.y ? anchor.y - height : anchor.y;
  return clampRect({ x, y, width, height }, bounds);
}

export function moveRect(rect: Rect, dx: number, dy: number, bounds: Bounds): Rect {
  const width = Math.min(rect.width, bounds.width);
  const height = Math.min(rect.height, bounds.height);
  return {
    x: Math.max(0, Math.min(Math.round(rect.x + dx), bounds.width - width)),
    y: Math.max(0, Math.min(Math.round(rect.y + dy), bounds.height - height)),
    width,
    height,
  };
}

export function resizeRect(
  rect: Rect,
  handle: Handle,
  to: { x: number; y: number },
  bounds: Bounds,
  ratio: number,
): Rect {
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  let { x, y } = rect;
  let width = rect.width;
  let height = rect.height;

  if (handle.includes("w")) {
    x = Math.min(to.x, right - MIN_SIDE);
    width = right - x;
  }
  if (handle.includes("e")) width = Math.max(MIN_SIDE, to.x - rect.x);
  if (handle.includes("n")) {
    y = Math.min(to.y, bottom - MIN_SIDE);
    height = bottom - y;
  }
  if (handle.includes("s")) height = Math.max(MIN_SIDE, to.y - rect.y);

  if (ratio > 0) {
    const horizontal = handle === "e" || handle === "w" || width / ratio > height;
    if (horizontal) height = width / ratio;
    else width = height * ratio;
    if (handle.includes("n")) y = bottom - height;
    if (handle.includes("w")) x = right - width;
  }
  return clampRect({ x, y, width, height }, bounds);
}

export function handleAt(point: { x: number; y: number }, rect: Rect, tolerance: number): Handle | null {
  const near = (value: number, edge: number) => Math.abs(value - edge) <= tolerance;
  const withinX = point.x >= rect.x - tolerance && point.x <= rect.x + rect.width + tolerance;
  const withinY = point.y >= rect.y - tolerance && point.y <= rect.y + rect.height + tolerance;
  if (!withinX || !withinY) return null;

  const left = near(point.x, rect.x);
  const right = near(point.x, rect.x + rect.width);
  const top = near(point.y, rect.y);
  const bottom = near(point.y, rect.y + rect.height);
  if (top && left) return "nw";
  if (top && right) return "ne";
  if (bottom && left) return "sw";
  if (bottom && right) return "se";
  if (top) return "n";
  if (bottom) return "s";
  if (left) return "w";
  if (right) return "e";
  return "move";
}

export function fitAspect(rect: Rect, bounds: Bounds, ratio: number): Rect {
  if (ratio <= 0) return rect;
  let width = rect.width;
  let height = width / ratio;
  if (height > bounds.height) {
    height = bounds.height;
    width = height * ratio;
  }
  if (width > bounds.width) {
    width = bounds.width;
    height = width / ratio;
  }
  const centre = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  return clampRect({ x: centre.x - width / 2, y: centre.y - height / 2, width, height }, bounds);
}

export const CURSORS: Record<Handle, string> = {
  nw: "nwse-resize",
  se: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  move: "move",
};

export const CORNERS: Handle[] = ["nw", "ne", "sw", "se"];

const MIN_SIDE = 8;

export interface Preview {
  width: number;
  height: number;
  frame: Bounds;
}

export function fitPreview(natural: Bounds, room: Bounds, turned: boolean): Preview {
  const across = turned ? natural.height : natural.width;
  const down = turned ? natural.width : natural.height;
  const share = Math.min(1, room.width / Math.max(across, 1), room.height / Math.max(down, 1));
  const width = Math.max(1, Math.round(natural.width * share));
  const height = Math.max(1, Math.round(natural.height * share));
  return { width, height, frame: { width: turned ? height : width, height: turned ? width : height } };
}

export function turnTransform(rotate: number, flipX: boolean, flipY: boolean): string {
  return `rotate(${rotate}deg) scale(${flipX ? -1 : 1}, ${flipY ? -1 : 1})`;
}

export function localPoint(
  point: { x: number; y: number },
  centre: { x: number; y: number },
  size: Bounds,
  rotate: number,
  flipX: boolean,
  flipY: boolean,
): { x: number; y: number } {
  const radians = (-rotate * Math.PI) / 180;
  const dx = point.x - centre.x;
  const dy = point.y - centre.y;
  let x = dx * Math.cos(radians) - dy * Math.sin(radians);
  let y = dx * Math.sin(radians) + dy * Math.cos(radians);
  if (flipX) x = -x;
  if (flipY) y = -y;
  return { x: x + size.width / 2, y: y + size.height / 2 };
}
