import { AsYouType } from "libphonenumber-js/max";
import type { CountryCode } from "./regions";

export interface Edit {
  value: string;
  caret: number;
  previous: string;
}

export interface Typed {
  value: string;
  caret: number;
}

export function retype(edit: Edit, region: CountryCode): Typed {
  if (!PLAIN.test(edit.value)) return unformatted(edit);

  const typed = significant(edit.value);
  const before = significant(edit.value.slice(0, edit.caret)).length;

  const separator = edit.value.length < edit.previous.length && typed === significant(edit.previous);
  const at = separator ? Math.max(before - 1, 0) : before;
  const kept = separator ? typed.slice(0, at) + typed.slice(before) : typed;

  const value = format(kept, region);
  return { value, caret: caretAfter(value, at) };
}

export function retypeAll(value: string, region: CountryCode): string {
  return PLAIN.test(value) ? format(significant(value), region) : value;
}

function unformatted(edit: Edit): Typed {
  const typing = PLAIN.test(edit.previous) && edit.value.length === edit.previous.length + 1;
  if (!typing) return { value: edit.value, caret: edit.caret };

  const dropped = [...edit.value.slice(0, edit.caret)].filter((character) => !kept(character)).length;
  return { value: [...edit.value].filter(kept).join(""), caret: edit.caret - dropped };
}

function kept(character: string): boolean {
  return SIGNIFICANT.test(character) || !SEPARATOR.test(character);
}

const PLAIN = /^[+\d\s().\-/]*$/;

const SEPARATOR = /[\s().\-/]/;

function significant(text: string): string {
  const digits = text.replace(/\D/g, "");
  return text.trimStart().startsWith("+") ? `+${digits}` : digits;
}

function format(typed: string, region: CountryCode): string {
  return new AsYouType(region).input(typed);
}

function caretAfter(value: string, count: number): number {
  if (count <= 0) return 0;
  let seen = 0;
  for (let at = 0; at < value.length; at++) {
    if (SIGNIFICANT.test(value[at]) && ++seen === count) return at + 1;
  }
  return value.length;
}

const SIGNIFICANT = /[+\d]/;
