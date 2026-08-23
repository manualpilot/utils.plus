import { mapLines, withLines } from "./lines";

export function trimLines(text: string, variant: string): string {
  return mapLines(text, (line) => {
    if (variant === "start") return line.trimStart();
    if (variant === "end") return line.trimEnd();
    return line.trim();
  });
}

export function collapse(text: string, variant: string): string {
  if (variant === "spaces") return mapLines(text, (line) => line.replace(/\s+/gu, " "));
  if (variant === "blank") return withLines(text, (lines) => lines.filter((line) => line.trim() !== ""));
  return withLines(
    text,
    (lines) => lines.filter((line, index) => line.trim() !== "" || lines[index - 1]?.trim() !== ""),
  );
}

export function wrapText(text: string, width: number, variant: string): string {
  return mapLines(text, (line) => wrapLine(line, width, variant === "anywhere"));
}

export function parseWidth(value: string): number {
  const width = Number(value.trim());
  if (!Number.isInteger(width) || width < 1) throw new Error("Width must be a whole number of at least 1");
  return width;
}

function wrapLine(line: string, width: number, breakWords: boolean): string {
  const indent = line.match(/^[^\S\r\n]*/u)?.[0] ?? "";
  const words = line.slice(indent.length).split(/\s+/u).filter((word) => word !== "");
  if (words.length === 0) return line;

  const room = Math.max(1, width - indent.length);
  const wrapped: string[] = [];
  let current = "";
  const flush = () => {
    wrapped.push(indent + current);
    current = "";
  };

  for (const word of words) {
    let rest = word;
    while (breakWords && rest.length > room) {
      if (current !== "") flush();
      wrapped.push(indent + rest.slice(0, room));
      rest = rest.slice(room);
    }
    if (current === "") current = rest;
    else if (current.length + 1 + rest.length <= room) current += " " + rest;
    else {
      flush();
      current = rest;
    }
  }
  if (current !== "") flush();
  return wrapped.join("\n");
}
