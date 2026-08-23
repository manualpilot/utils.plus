export interface Panel {
  id: string;
  title: string;
}

export const PANELS: Panel[] = [
  { id: "shape", title: "Size and shape" },
  { id: "colour", title: "Colour" },
];

export const PANEL_ORDER: string[] = PANELS.map((panel) => panel.id);

export function panelTitle(id: string): string {
  return PANELS.find((panel) => panel.id === id)?.title ?? id;
}

export function reorderPanels(order: string[], active: string, over: string): string[] {
  const from = order.indexOf(active);
  const to = order.indexOf(over);
  if (from < 0 || to < 0 || from === to) return order;
  const moved = [...order];
  moved.splice(to, 0, moved.splice(from, 1)[0]);
  return moved;
}

export function togglePanel(closed: string[], id: string): string[] {
  return closed.includes(id) ? closed.filter((shut) => shut !== id) : [...closed, id];
}
