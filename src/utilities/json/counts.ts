import { syntaxTree } from "@codemirror/language";
import type { SyntaxNode } from "@lezer/common";
import { Decoration, type DecorationSet, type EditorState, EditorView, type Range, ViewPlugin, type ViewUpdate, WidgetType } from "@uiw/react-codemirror";

const VALUES = new Set(["True", "False", "Null", "Number", "String", "Object", "Array"]);

export interface ContainerCount {
  count: number;
  unit: "key" | "element";
}

export interface CountPill {
  at: number;
  label: string;
}

export const countLabel = ({ count, unit }: ContainerCount) => `${count} ${unit}${count === 1 ? "" : "s"}`;

export function countPills(state: EditorState, from: number, to: number): CountPill[] {
  const pills = new Map<number, string>();

  syntaxTree(state).iterate({
    from,
    to,
    enter: (node) => {
      const held = contents(node.node);
      if (!held) return;

      const opener = state.doc.lineAt(node.from);
      pills.set(node.to <= opener.to ? node.to : opener.to, countLabel(held));
    },
  });

  return [...pills].map(([at, label]) => ({ at, label })).sort((first, second) => first.at - second.at);
}

function contents(node: SyntaxNode): ContainerCount | null {
  if (node.name === "Object") return { count: node.getChildren("Property").length, unit: "key" };
  if (node.name !== "Array") return null;

  let count = 0;
  for (let child = node.firstChild; child; child = child.nextSibling) if (VALUES.has(child.name)) count++;
  return { count, unit: "element" };
}

class CountWidget extends WidgetType {
  constructor(readonly label: string) {
    super();
  }

  eq(other: CountWidget): boolean {
    return other.label === this.label;
  }

  toDOM(): HTMLElement {
    const pill = document.createElement("span");
    pill.className = "cm-container-count";
    pill.dataset.count = this.label;
    return pill;
  }
}

const widgetAt = (label: string) => Decoration.widget({ widget: new CountWidget(label), side: 1 });

function countWidgets(view: EditorView): DecorationSet {
  const marks: Range<Decoration>[] = [];
  const drawn = new Set<number>();

  for (const { from, to } of view.visibleRanges) {
    for (const { at, label } of countPills(view.state, from, to)) {
      if (drawn.has(at)) continue;
      drawn.add(at);
      marks.push(widgetAt(label).range(at));
    }
  }

  return Decoration.set(marks, true);
}

export const CONTAINER_COUNTS = [
  ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = countWidgets(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged || syntaxTree(update.startState) !== syntaxTree(update.state)) {
          this.decorations = countWidgets(update.view);
        }
      }
    },
    { decorations: (plugin) => plugin.decorations },
  ),
  EditorView.theme({
    ".cm-container-count::after": { content: "attr(data-count)" },
    ".cm-container-count": {
      display: "inline-block",
      margin: "0 0.5ch 0 1ch",
      padding: "0 0.6em",
      fontSize: "0.75em",
      lineHeight: "1.6",
      verticalAlign: "middle",
      color: "var(--mantine-color-dimmed)",
      backgroundColor: "var(--mantine-color-dark-4)",
      borderRadius: "var(--mantine-radius-xl)",
      userSelect: "none",
      WebkitUserSelect: "none",
      pointerEvents: "none",
    },
  }),
];
