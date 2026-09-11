import type { ComboboxParsedItem, OptionsFilter } from "@mantine/core";

export function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export const NO_MATCH = Number.MAX_SAFE_INTEGER;

export function rankedFilter(
  rankOf: (value: string, needle: string) => number,
  needleOf: (search: string) => string = fold,
): OptionsFilter {
  return ({ options, search }) => {
    const needle = needleOf(search.trim());
    if (!needle) return options;

    return options
      .flatMap((option) => {
        const rank = isItem(option) ? rankOf(String(option.value), needle) : NO_MATCH;
        return rank === NO_MATCH ? [] : [{ option, rank }];
      })
      .sort((a, b) => a.rank - b.rank)
      .map((match) => match.option);
  };
}

export interface SearchTerms {
  name: string;
  codes: Set<string>;
  whole: Set<string>;
  aliases: Set<string>;
  rest: string[];
}

export function termRank(terms: SearchTerms | undefined, needle: string): number {
  if (!terms) return NO_MATCH;
  if (terms.codes.has(needle)) return 0;
  if (terms.whole.has(needle)) return 1;
  if (terms.aliases.has(needle)) return 2;
  if (terms.name.startsWith(needle)) return 3;
  if (terms.name.includes(needle)) return 4;

  const band = terms.rest.findIndex((text) => text.includes(needle));
  return band === -1 ? NO_MATCH : 5 + band;
}

function isItem(option: ComboboxParsedItem): option is Extract<ComboboxParsedItem, { value: unknown }> {
  return "value" in option;
}
