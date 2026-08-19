import { RegExpParser, visitRegExpAST } from "@eslint-community/regexpp";
import type { AST } from "@eslint-community/regexpp";

export interface ExplainNode {
  label: string;
  raw: string;
  detail?: string;
  children: ExplainNode[];
}

export interface CaptureGroup {
  index: number;
  name: string | null;
}

export interface Explanation {
  nodes: ExplainNode[];
  captures: CaptureGroup[];
  error: string | null;
}

const parser = new RegExpParser();

export function explainPattern(source: string, flags: string): Explanation {
  if (!source) return { nodes: [], captures: [], error: null };

  let pattern: AST.Pattern;
  try {
    pattern = parser.parsePattern(source, 0, source.length, {
      unicode: flags.includes("u"),
      unicodeSets: flags.includes("v"),
    });
  } catch (error) {
    return { nodes: [], captures: [], error: error instanceof Error ? error.message : String(error) };
  }

  const numbers = groupNumbers(pattern);
  const captures = [...numbers].map(([group, index]) => ({ index, name: group.name }));

  return { nodes: patternNodes(pattern, numbers), captures, error: null };
}

type GroupNumbers = Map<AST.CapturingGroup, number>;

function groupNumbers(pattern: AST.Pattern): GroupNumbers {
  const found: AST.CapturingGroup[] = [];
  visitRegExpAST(pattern, { onCapturingGroupEnter: (group) => void found.push(group) });
  found.sort((left, right) => left.start - right.start);

  return new Map(found.map((group, index) => [group, index + 1]));
}

function patternNodes(pattern: AST.Pattern, numbers: GroupNumbers): ExplainNode[] {
  if (pattern.alternatives.length === 1) return elementNodes(pattern.alternatives[0].elements, numbers);

  return [{
    label: "Alternation",
    raw: pattern.raw,
    detail: `whichever of the ${pattern.alternatives.length} options matches first`,
    children: branchChildren(pattern.alternatives, numbers),
  }];
}

function branchChildren(alternatives: AST.Alternative[], numbers: GroupNumbers): ExplainNode[] {
  if (alternatives.length === 1) return elementNodes(alternatives[0].elements, numbers);

  return alternatives.map((alternative, index) => ({
    label: `Option ${index + 1}`,
    raw: alternative.raw,
    children: alternative.elements.length === 0
      ? [{ label: "Nothing", raw: "", detail: "this option matches without consuming anything", children: [] }]
      : elementNodes(alternative.elements, numbers),
  }));
}

function optionsDetail(alternatives: AST.Alternative[]): string | undefined {
  return alternatives.length > 1 ? `either of ${alternatives.length} options` : undefined;
}

function elementNodes(elements: AST.Element[], numbers: GroupNumbers): ExplainNode[] {
  const nodes: ExplainNode[] = [];
  let run: AST.Character[] = [];

  const flush = () => {
    if (run.length === 0) return;
    nodes.push(characterRunNode(run, run.length === 1 ? "Literal character" : "Literal text"));
    run = [];
  };

  for (const element of elements) {
    if (element.type === "Character") {
      run.push(element);
      continue;
    }
    flush();
    nodes.push(elementNode(element, numbers));
  }
  flush();

  return nodes;
}

function elementNode(element: AST.Element, numbers: GroupNumbers): ExplainNode {
  switch (element.type) {
    case "Assertion":
      return assertionNode(element, numbers);
    case "Backreference":
      return backreferenceNode(element);
    case "CapturingGroup":
      return capturingGroupNode(element, numbers);
    case "Character":
      return characterRunNode([element], "Literal character");
    case "CharacterClass":
      return characterClassNode(element, numbers);
    case "CharacterSet":
      return characterSetNode(element);
    case "ExpressionCharacterClass":
      return expressionClassNode(element, numbers);
    case "Group":
      return groupNode(element, numbers);
    case "Quantifier":
      return quantifierNode(element, numbers);
  }
}

function characterRunNode(run: AST.Character[], label: string): ExplainNode {
  const raw = run.map((character) => character.raw).join("");
  const text = String.fromCodePoint(...run.map((character) => character.value));

  return {
    label,
    raw,
    detail: raw === text
      ? undefined
      : run.length === 1
      ? codePoint(run[0].value)
      : `matches ${JSON.stringify(text)}`,
    children: [],
  };
}

function quantifierNode(quantifier: AST.Quantifier, numbers: GroupNumbers): ExplainNode {
  return {
    label: `Repeat ${repetition(quantifier.min, quantifier.max)}`,
    raw: quantifier.raw,
    detail: quantifier.greedy
      ? "greedy, giving back only if the rest fails"
      : "lazy, taking more only if the rest fails",
    children: [elementNode(quantifier.element, numbers)],
  };
}

function capturingGroupNode(group: AST.CapturingGroup, numbers: GroupNumbers): ExplainNode {
  const number = numbers.get(group) ?? 1;

  return {
    label: group.name === null ? `Capturing group ${number}` : `Capturing group ${number}, named ${group.name}`,
    raw: group.raw,
    detail: optionsDetail(group.alternatives),
    children: branchChildren(group.alternatives, numbers),
  };
}

function groupNode(group: AST.Group, numbers: GroupNumbers): ExplainNode {
  return {
    label: "Non-capturing group",
    raw: group.raw,
    detail: [modifiersDetail(group.modifiers), optionsDetail(group.alternatives)].filter(Boolean).join(", ")
      || undefined,
    children: branchChildren(group.alternatives, numbers),
  };
}

function modifiersDetail(modifiers: AST.Modifiers | null): string | undefined {
  if (!modifiers) return undefined;

  const letters = (flags: AST.ModifierFlags | null) =>
    !flags ? "" : [flags.ignoreCase && "i", flags.multiline && "m", flags.dotAll && "s"].filter(Boolean).join("");
  const added = letters(modifiers.add);
  const removed = letters(modifiers.remove);

  return [added && `${added} on`, removed && `${removed} off`].filter(Boolean).join(" and ") || undefined;
}

function assertionNode(assertion: AST.Assertion, numbers: GroupNumbers): ExplainNode {
  if (assertion.kind === "lookahead" || assertion.kind === "lookbehind") {
    const ahead = assertion.kind === "lookahead";
    const around = ahead ? "lookahead" : "lookbehind";

    return {
      label: assertion.negate ? `Negative ${around}` : `${around[0].toUpperCase()}${around.slice(1)}`,
      raw: assertion.raw,
      detail: `what ${ahead ? "follows" : "comes before"} ${
        assertion.negate ? "must not match this" : "must match this"
      }, and stays out of the match`,
      children: branchChildren(assertion.alternatives, numbers),
    };
  }

  if (assertion.kind === "word") {
    return assertion.negate
      ? leaf(assertion, "Not a word boundary", "both sides are word characters, or neither is")
      : leaf(assertion, "Word boundary", "the edge between a word character and anything else");
  }

  return assertion.kind === "start"
    ? leaf(assertion, "Start of the text", "or of a line, with the m flag set")
    : leaf(assertion, "End of the text", "or of a line, with the m flag set");
}

function backreferenceNode(backreference: AST.Backreference): ExplainNode {
  const target = typeof backreference.ref === "number"
    ? `group ${backreference.ref}`
    : `the group named ${backreference.ref}`;
  return leaf(backreference, `Backreference to ${target}`, "matches the same text that group matched");
}

function characterClassNode(characterClass: AST.CharacterClass, numbers: GroupNumbers): ExplainNode {
  return {
    label: characterClass.negate ? "Any one character except" : "Any one character of",
    raw: characterClass.raw,
    children: classElementNodes(characterClass.elements, numbers),
  };
}

function classElementNodes(
  elements: readonly (AST.CharacterClassElement | AST.ClassSetOperand)[],
  numbers: GroupNumbers,
): ExplainNode[] {
  const nodes: ExplainNode[] = [];
  let run: AST.Character[] = [];

  const flush = () => {
    if (run.length === 0) return;
    nodes.push(characterRunNode(run, run.length === 1 ? "The character" : "These characters"));
    run = [];
  };

  for (const element of elements) {
    if (element.type === "Character") {
      run.push(element);
      continue;
    }
    flush();
    nodes.push(classElementNode(element, numbers));
  }
  flush();

  return nodes;
}

function classElementNode(
  element: Exclude<AST.CharacterClassElement | AST.ClassSetOperand, AST.Character>,
  numbers: GroupNumbers,
): ExplainNode {
  switch (element.type) {
    case "CharacterClassRange":
      return leaf(element, "A character in the range", `${describe(element.min)} to ${describe(element.max)}`);
    case "CharacterSet":
      return characterSetNode(element);
    case "CharacterClass":
      return characterClassNode(element, numbers);
    case "ExpressionCharacterClass":
      return expressionClassNode(element, numbers);
    case "ClassStringDisjunction":
      return {
        label: "Any one of these strings",
        raw: element.raw,
        children: element.alternatives.map((alternative) => ({
          label: alternative.elements.length === 0 ? "The empty string" : "The string",
          raw: alternative.raw,
          children: [],
        })),
      };
  }
}

function characterSetNode(set: AST.CharacterSet): ExplainNode {
  if (set.kind === "any") return leaf(set, "Any character", "except a line break, unless the s flag is set");

  if (set.kind === "property") {
    if (set.value === null) {
      return leaf(
        set,
        set.negate
          ? `Any character without the unicode property ${set.key}`
          : `A character with the unicode property ${set.key}`,
      );
    }
    return leaf(
      set,
      set.negate
        ? `Any character whose ${set.key} is not ${set.value}`
        : `A character whose ${set.key} is ${set.value}`,
    );
  }

  const kind = ESCAPE_SETS[set.kind];
  return leaf(set, set.negate ? kind.negated : kind.label, kind.detail);
}

const ESCAPE_SETS = {
  digit: { label: "A digit", negated: "Anything but a digit", detail: "0 to 9" },
  space: {
    label: "Whitespace",
    negated: "Anything but whitespace",
    detail: "a space, a tab, a line break or the like",
  },
  word: {
    label: "A word character",
    negated: "Anything but a word character",
    detail: "a letter, a digit or an underscore",
  },
};

function expressionClassNode(characterClass: AST.ExpressionCharacterClass, numbers: GroupNumbers): ExplainNode {
  return {
    label: characterClass.negate ? "Any one character except" : "Any one character of",
    raw: characterClass.raw,
    children: [setExpressionNode(characterClass.expression, numbers)],
  };
}

function setExpressionNode(
  expression: AST.ClassIntersection | AST.ClassSubtraction | AST.ClassSetOperand,
  numbers: GroupNumbers,
): ExplainNode {
  if (expression.type === "Character") return characterRunNode([expression], "The character");
  if (expression.type !== "ClassIntersection" && expression.type !== "ClassSubtraction") {
    return classElementNode(expression, numbers);
  }

  const intersection = expression.type === "ClassIntersection";
  return {
    label: intersection ? "In both of these" : "In the first of these and not the second",
    raw: expression.raw,
    children: [setExpressionNode(expression.left, numbers), setExpressionNode(expression.right, numbers)],
  };
}

function leaf(node: { raw: string }, label: string, detail?: string): ExplainNode {
  return { label, raw: node.raw, detail, children: [] };
}

function describe(character: AST.Character): string {
  return character.raw === String.fromCodePoint(character.value) ? character.raw : codePoint(character.value);
}

function codePoint(value: number): string {
  return `U+${value.toString(16).toUpperCase().padStart(4, "0")}`;
}

function repetition(min: number, max: number): string {
  if (min === max) return min === 1 ? "once" : `exactly ${min} times`;
  if (max === Infinity) {
    return min === 0 ? "any number of times, including none" : min === 1 ? "one or more times" : `${min} or more times`;
  }
  return min === 0 && max === 1 ? "once or not at all" : `between ${min} and ${max} times`;
}
