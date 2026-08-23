import { type Adjustments, applyMatrix, isNeutral, matrixFor } from "./filters";
import type { OutputFormat } from "./formats";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Geometry {
  crop: Rect | null;
  width: number;
  height: number;
  rotate: number;
  flipX: boolean;
  flipY: boolean;
}

export type Source = HTMLImageElement | HTMLCanvasElement | ImageBitmap;

export function outputSize(geometry: Geometry): { width: number; height: number } {
  const turned = geometry.rotate === 90 || geometry.rotate === 270;
  return turned
    ? { width: geometry.height, height: geometry.width }
    : { width: geometry.width, height: geometry.height };
}

export function render(source: Source, geometry: Geometry, adjustments: Adjustments, matte: string): HTMLCanvasElement {
  const natural = naturalSize(source);
  const crop = geometry.crop ?? { x: 0, y: 0, width: natural.width, height: natural.height };
  const scaled = resample(source, crop, Math.max(1, geometry.width), Math.max(1, geometry.height));
  const turned = orient(scaled, geometry);
  return paint(turned, adjustments, matte);
}

export function encode(canvas: HTMLCanvasElement, format: OutputFormat, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, format.mime, format.lossy ? quality / 100 : undefined);
  });
}

export function naturalSize(source: Source): { width: number; height: number } {
  if (source instanceof HTMLImageElement) {
    return { width: source.naturalWidth || 300, height: source.naturalHeight || 150 };
  }
  return { width: source.width, height: source.height };
}

function resample(source: Source, crop: Rect, width: number, height: number): HTMLCanvasElement {
  let current = surface(Math.max(1, Math.round(crop.width)), Math.max(1, Math.round(crop.height)));
  draw(current, (context, canvas) => {
    context.drawImage(
      source as CanvasImageSource,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  });

  while (current.width >= width * 2 && current.height >= height * 2 && current.width > 2 && current.height > 2) {
    const next = surface(Math.max(width, current.width >> 1), Math.max(height, current.height >> 1));
    const from = current;
    draw(next, (context, canvas) => context.drawImage(from, 0, 0, canvas.width, canvas.height));
    current = next;
  }

  if (current.width === width && current.height === height) return current;
  const out = surface(width, height);
  const from = current;
  draw(out, (context, canvas) => context.drawImage(from, 0, 0, canvas.width, canvas.height));
  return out;
}

function orient(source: HTMLCanvasElement, geometry: Geometry): HTMLCanvasElement {
  if (geometry.rotate === 0 && !geometry.flipX && !geometry.flipY) return source;
  const turned = geometry.rotate === 90 || geometry.rotate === 270;
  const out = surface(turned ? source.height : source.width, turned ? source.width : source.height);
  draw(out, (context, canvas) => {
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate((geometry.rotate * Math.PI) / 180);
    context.scale(geometry.flipX ? -1 : 1, geometry.flipY ? -1 : 1);
    context.drawImage(source, -source.width / 2, -source.height / 2);
  });
  return out;
}

function paint(source: HTMLCanvasElement, adjustments: Adjustments, matte: string): HTMLCanvasElement {
  const needsMatte = matte !== "";
  if (!needsMatte && isNeutral(adjustments)) return source;

  const out = surface(source.width, source.height);
  draw(out, (context, canvas) => {
    if (needsMatte) {
      context.fillStyle = matte;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(source, 0, 0);
  });

  if (isNeutral(adjustments)) return out;
  const context = out.getContext("2d");
  if (!context) return out;
  const pixels = context.getImageData(0, 0, out.width, out.height);
  applyMatrix(pixels.data, matrixFor(adjustments));
  context.putImageData(pixels, 0, 0);
  return out;
}

function surface(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function draw(
  canvas: HTMLCanvasElement,
  paint: (context: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => void,
) {
  const context = canvas.getContext("2d");
  if (!context) return;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  paint(context, canvas);
}
