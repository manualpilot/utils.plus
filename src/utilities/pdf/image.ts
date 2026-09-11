export interface Size {
  width: number;
  height: number;
}

export interface Placeable {
  url: string;
  size: Size;
}

export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

export const PLACED_BOX: Size = { width: 240, height: 240 };

export const LONGEST_SIDE = 2400;

export async function placeable(file: File): Promise<Placeable> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("That picture could not be read. A PNG, JPEG, WebP or GIF will go on the page.");
  }
  const drawn = fitWithin({ width: bitmap.width, height: bitmap.height }, {
    width: LONGEST_SIDE,
    height: LONGEST_SIDE,
  });
  const canvas = new OffscreenCanvas(Math.max(1, Math.round(drawn.width)), Math.max(1, Math.round(drawn.height)));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const type = file.type === "image/jpeg" ? "image/jpeg" : "image/png";
  const blob = await canvas.convertToBlob({ type, quality: 0.92 });
  return { url: URL.createObjectURL(blob), size: fitWithin(drawn, PLACED_BOX) };
}

export function fitWithin(size: Size, box: Size): Size {
  const scale = Math.min(1, box.width / size.width, box.height / size.height);
  return { width: size.width * scale, height: size.height * scale };
}
