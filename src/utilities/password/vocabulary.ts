import adjectiveList from "../../../inline/top_english_adjs_lower_10000.json";
import nounList from "../../../inline/top_english_nouns_lower_10000.json";
import verbList from "../../../inline/top_english_verbs_lower_10000.json";
import { composition } from "../../common/composition";
import { randomBelow, shuffle } from "../../common/random";
import { type Casing, CASINGS, type Separator, SEPARATORS, WORD_KEYS, type WordKey, type WordWeights } from "./words";

export const LISTS: Record<WordKey, string[]> = {
  nouns: usable(nounList),
  verbs: usable(verbList),
  adjectives: usable(adjectiveList),
};

function usable(list: string[]): string[] {
  return list.filter((word) => /^[a-z]{3,}$/.test(word));
}

export function generatePassphrase(
  words: number,
  weights: WordWeights,
  casing: Casing,
  separator: Separator,
): string {
  const counts = composition(words, weights);
  const picked: string[] = [];

  for (const key of WORD_KEYS) {
    const list = LISTS[key];
    for (let i = 0; i < counts[key]; i++) {
      picked.push(CASINGS[casing].apply(list[randomBelow(list.length)]));
    }
  }

  shuffle(picked);
  return picked.join(SEPARATORS[separator].character);
}
