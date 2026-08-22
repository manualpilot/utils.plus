import { hmac } from "@noble/hashes/hmac.js";
import { type Algorithm, counterBytes, HASHES, truncate } from "./hotp";

export type QuestionFormat = "N" | "A" | "H";

export interface Question {
  format: QuestionFormat;
  length: number;
}

export interface Suite {
  text: string;
  algorithm: Algorithm;
  digits: number;
  counter: boolean;
  question: Question;
  password: Algorithm | null;
  session: number;
  step: number;
}

export interface OcraInputs {
  counter: bigint;
  question: string;
  password: string;
  session: string;
  seconds: number;
}

export const DEFAULT_SUITE = "OCRA-1:HOTP-SHA1-6:QN08";

const QUESTION_BYTES = 128;

export function ocra(key: Uint8Array, suite: Suite, inputs: OcraInputs): string {
  const parts: Uint8Array[] = [utf8(suite.text), new Uint8Array(1)];
  if (suite.counter) parts.push(counterBytes(inputs.counter));
  parts.push(questionBytes(inputs.question, suite.question));
  if (suite.password) parts.push(HASHES[suite.password](utf8(inputs.password)));
  if (suite.session) parts.push(sessionBytes(inputs.session, suite.session));
  if (suite.step) parts.push(counterBytes(BigInt(Math.floor(inputs.seconds / suite.step))));
  return truncate(hmac(HASHES[suite.algorithm], key, concat(parts)), suite.digits);
}

export function parseSuite(text: string): Suite {
  const suite = text.trim();
  const parts = suite.split(":");
  if (parts.length !== 3) throw new Error("A suite is three parts: OCRA-1:CryptoFunction:DataInput");
  if (!/^OCRA-1$/i.test(parts[0])) throw new Error(`"${parts[0]}" is not a version: only OCRA-1 has been defined`);

  const crypto = /^HOTP-(SHA1|SHA256|SHA512)-(\d{1,2})$/i.exec(parts[1]);
  if (!crypto) throw new Error(`"${parts[1]}" is not a crypto function: it is HOTP, a hash and a digit count`);
  const digits = Number(crypto[2]);
  if (digits !== 0 && (digits < 4 || digits > 10)) throw new Error("A digit count is 4 to 10, or 0 for no truncation");

  return { text: suite, algorithm: crypto[1].toUpperCase() as Algorithm, digits, ...dataInput(parts[2]) };
}

export function questionProblem(question: string, suite: Suite): string | null {
  const { format } = suite.question;
  if (!question) return null;
  if (format === "N" && !/^\d+$/.test(question)) return "A numeric question is digits only";
  if (format === "H" && !/^[0-9a-fA-F]+$/.test(question)) return "A hexadecimal question is 0-9 and A-F only";
  return questionSize(question, format) > QUESTION_BYTES ? `A question is at most ${QUESTION_BYTES} bytes` : null;
}

function questionSize(question: string, format: QuestionFormat): number {
  if (format === "A") return utf8(question).length;
  const hex = format === "N" ? BigInt(question).toString(16) : question;
  return Math.ceil(hex.length / 2);
}

export function questionNoun(format: QuestionFormat): string {
  return format === "N" ? "digits" : format === "H" ? "hex characters" : "bytes";
}

export function sessionProblem(session: string, suite: Suite): string | null {
  const size = utf8(session).length;
  return size > suite.session ? `This suite takes up to ${suite.session} bytes of session information` : null;
}

function dataInput(text: string): Omit<Suite, "text" | "algorithm" | "digits"> {
  const input: Draft = { counter: false, question: null, password: null, session: 0, step: 0 };

  for (const token of text.split("-")) {
    const read = TOKENS.find((candidate) => candidate.pattern.test(token));
    if (!read) throw new Error(`"${token}" is not an input a suite can ask for`);
    if (read.taken(input)) throw new Error(`"${token}" names an input the suite already asked for`);
    read.apply(input, read.pattern.exec(token) as RegExpExecArray);
  }

  if (!input.question) throw new Error("A suite has to name a question, such as QN08");
  return { ...input, question: input.question };
}

type Draft = { counter: boolean; question: Question | null; password: Algorithm | null; session: number; step: number };

const TOKENS: {
  pattern: RegExp;
  taken: (draft: Draft) => boolean;
  apply: (draft: Draft, match: RegExpExecArray) => void;
}[] = [
  {
    pattern: /^C$/i,
    taken: (draft) => draft.counter,
    apply: (draft) => {
      draft.counter = true;
    },
  },
  {
    pattern: /^Q([ANH])(\d{2})$/i,
    taken: (draft) => draft.question !== null,
    apply: (draft, match) => {
      const length = Number(match[2]);
      if (length < 4 || length > 64) throw new Error("A question is 4 to 64 long");
      draft.question = { format: match[1].toUpperCase() as QuestionFormat, length };
    },
  },
  {
    pattern: /^P(SHA1|SHA256|SHA512)?$/i,
    taken: (draft) => draft.password !== null,
    apply: (draft, match) => {
      draft.password = (match[1]?.toUpperCase() ?? "SHA1") as Algorithm;
    },
  },
  {
    pattern: /^S(\d{3})?$/i,
    taken: (draft) => draft.session !== 0,
    apply: (draft, match) => {
      const session = Number(match[1] ?? "064");
      if (session < 1 || session > 512) throw new Error("Session information is 1 to 512 bytes");
      draft.session = session;
    },
  },
  {
    pattern: /^T(?:(\d{1,2})([SMH]))?$/i,
    taken: (draft) => draft.step !== 0,
    apply: (draft, match) => {
      const size = Number(match[1] ?? "1");
      const unit = (match[2] ?? "M").toUpperCase() as keyof typeof STEP_UNITS;
      if (size < 1 || size > STEP_UNITS[unit].max) {
        throw new Error(`A time step in ${STEP_UNITS[unit].noun} is 1 to ${STEP_UNITS[unit].max}`);
      }
      draft.step = size * STEP_UNITS[unit].seconds;
    },
  },
];

const STEP_UNITS = {
  S: { seconds: 1, max: 59, noun: "seconds" },
  M: { seconds: 60, max: 59, noun: "minutes" },
  H: { seconds: 3600, max: 48, noun: "hours" },
};

function questionBytes(question: string, spec: Question): Uint8Array<ArrayBuffer> {
  const hex = spec.format === "N"
    ? BigInt(question || "0").toString(16)
    : spec.format === "H"
    ? question
    : hexOf(utf8(question));
  return hexBytes(hex.padEnd(256, "0").slice(0, 256));
}

function sessionBytes(session: string, length: number): Uint8Array<ArrayBuffer> {
  const bytes = utf8(session).slice(0, length);
  const field = new Uint8Array(length);
  field.set(bytes, length - bytes.length);
  return field;
}

function hexBytes(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index++) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function hexOf(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function concat(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const message = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let at = 0;
  for (const part of parts) {
    message.set(part, at);
    at += part.length;
  }
  return message;
}

const ENCODER = new TextEncoder();

function utf8(text: string): Uint8Array<ArrayBuffer> {
  return ENCODER.encode(text);
}
