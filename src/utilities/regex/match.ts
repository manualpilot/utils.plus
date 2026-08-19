export interface Span {
  from: number;
  to: number;
}

export interface GroupSpan extends Span {
  index: number;
}

export interface MatchSpan extends Span {
  groups: GroupSpan[];
}

export interface MatchResult {
  matches: MatchSpan[];
  error: string | null;
  truncated: boolean;
}

const MAX_MATCHES = 5000;

export function findMatches(source: string, flags: string, text: string): MatchResult {
  if (!source) return { matches: [], error: null, truncated: false };

  let regex: RegExp;
  try {
    regex = new RegExp(source, flags.includes("d") ? flags : `${flags}d`);
  } catch (error) {
    return { matches: [], error: error instanceof Error ? error.message : String(error), truncated: false };
  }

  const matches: MatchSpan[] = [];
  const repeat = regex.global || regex.sticky;
  let truncated = false;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    matches.push(spanOf(match));
    if (!repeat) break;

    if (matches.length >= MAX_MATCHES) {
      truncated = true;
      break;
    }

    if (match[0].length === 0) {
      regex.lastIndex = afterOneCharacter(text, regex.lastIndex, regex.unicode || regex.unicodeSets);
    }
  }

  return { matches, error: null, truncated };
}

function spanOf(match: RegExpExecArray): MatchSpan {
  const groups: GroupSpan[] = [];

  for (let index = 1; index < match.length; index++) {
    const at = match.indices?.[index];
    if (at) groups.push({ index, from: at[0], to: at[1] });
  }

  return { from: match.index, to: match.index + match[0].length, groups };
}

function afterOneCharacter(text: string, at: number, unicode: boolean): number {
  const point = unicode ? text.codePointAt(at) : undefined;
  return at + (point !== undefined && point > 0xffff ? 2 : 1);
}

export function summarise(result: MatchResult): string {
  const count = result.matches.length;
  const found = count === 0 ? "No matches" : count === 1 ? "1 match" : `${count} matches`;
  return result.truncated ? `${found}, and the search stopped there` : found;
}
