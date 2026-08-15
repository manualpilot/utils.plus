import { type KeyboardEvent as ReactKeyboardEvent, useRef, useState } from "react";

export function useRovingFocus(count: number, columns: number, enabled: (index: number) => boolean) {
  const [focused, setFocused] = useState(0);
  const nodes = useRef<(HTMLElement | null)[]>([]);

  const search = (from: number, stride: number): number | null => {
    for (let index = from; index >= 0 && index < count; index += stride) {
      if (enabled(index)) return index;
    }
    return null;
  };

  const start = Math.min(focused, count - 1);
  const active = search(start, 1) ?? search(start, -1) ?? 0;

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    const strides: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns };
    const stride = strides[event.key];
    const target = stride !== undefined
      ? search(active + stride, stride)
      : event.key === "Home"
      ? search(0, 1)
      : event.key === "End"
      ? search(count - 1, -1)
      : null;

    if (target === null) return;
    event.preventDefault();
    setFocused(target);
    nodes.current[target]?.focus();
  };

  const itemProps = (index: number): RovingItemProps => ({
    tabIndex: index === active ? 0 : -1,
    onFocus: () => setFocused(index),
    ref: (node: HTMLElement | null) => {
      nodes.current[index] = node;
    },
  });

  const focus = (index: number) => {
    const target = search(Math.min(index, count - 1), -1) ?? search(0, 1);
    if (target === null) return;
    setFocused(target);
    nodes.current[target]?.focus();
  };

  return { active, focus, handleKeyDown, itemProps };
}

export interface RovingItemProps {
  tabIndex: number;
  onFocus: () => void;
  ref: (node: HTMLElement | null) => void;
}

export const ALWAYS = () => true;

export function keepFocus(event: { preventDefault: () => void }) {
  event.preventDefault();
}

export const BITS_PER_ROW = 32;

export function chunk(indexes: number[], size: number): number[][] {
  const groups: number[][] = [];
  for (let start = 0; start < indexes.length; start += size) groups.push(indexes.slice(start, start + size));
  return groups;
}
