export interface Normalised {
  form: string;
  hint: string;
  text: string;
  characters: number;
  same: boolean;
}

export function normalisations(text: string): Normalised[] {
  return FORMS.map(({ form, hint }) => {
    const normalised = text.normalize(form);
    return { form, hint, text: normalised, characters: [...normalised].length, same: normalised === text };
  });
}

const FORMS = [
  { form: "NFC", hint: "Composed — what a file, a name or a URL should be stored as" },
  { form: "NFD", hint: "Decomposed — every accent written as a mark of its own" },
  { form: "NFKC", hint: "Composed, and compatibility characters replaced by what they stand for" },
  { form: "NFKD", hint: "Decomposed, and compatibility characters replaced by what they stand for" },
] as const;
