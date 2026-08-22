import { type Algorithm, hotp, timeStep } from "./hotp";
import { ocra, questionProblem, sessionProblem, type Suite } from "./ocra";
import { readSecret, type SecretFormat } from "./secret";
import { describeCrypto, type Mode } from "./settings";

export interface OtpSettings {
  mode: Mode;
  secret: string;
  format: SecretFormat;
  algorithm: Algorithm;
  digits: number | null;
  period: number | null;
  counter: number | null;
  seconds: number | null;
  suite: Suite | null;
  question: string;
  password: string;
  session: string;
}

export interface OtpResult {
  code: string;
  crypto: string;
  counted: { label: string; value: string }[];
}

export function computeCode(settings: OtpSettings): OtpResult | null {
  const key = keyBytes(settings.secret, settings.format);
  if (!key) return null;
  return settings.mode === "ocra" ? challengeCode(key, settings) : passwordCode(key, settings);
}

function passwordCode(key: Uint8Array, settings: OtpSettings): OtpResult | null {
  const { algorithm, digits, mode } = settings;
  if (digits === null) return null;
  const crypto = describeCrypto(algorithm, digits);

  if (mode === "hotp") {
    if (settings.counter === null) return null;
    return {
      code: hotp(key, BigInt(settings.counter), algorithm, digits),
      crypto,
      counted: [{ label: "Counter", value: String(settings.counter) }],
    };
  }

  if (settings.period === null || settings.seconds === null) return null;
  const step = timeStep(settings.seconds, settings.period);
  return { code: hotp(key, step, algorithm, digits), crypto, counted: [countedStep(step)] };
}

function challengeCode(key: Uint8Array, settings: OtpSettings): OtpResult | null {
  const { suite, question, session } = settings;
  if (!suite || !question || questionProblem(question, suite) || sessionProblem(session, suite)) return null;
  if (suite.counter && settings.counter === null) return null;
  if (suite.step && settings.seconds === null) return null;

  const counted: { label: string; value: string }[] = [];
  if (suite.counter) counted.push({ label: "Counter", value: String(settings.counter) });
  if (suite.step) counted.push(countedStep(BigInt(Math.floor((settings.seconds ?? 0) / suite.step))));

  const inputs = {
    counter: BigInt(settings.counter ?? 0),
    question,
    password: settings.password,
    session,
    seconds: settings.seconds ?? 0,
  };
  return { code: ocra(key, suite, inputs), crypto: describeCrypto(suite.algorithm, suite.digits), counted };
}

function countedStep(step: bigint): { label: string; value: string } {
  return { label: "Time step", value: `${step} · 0x${step.toString(16).toUpperCase()}` };
}

function keyBytes(secret: string, format: SecretFormat): Uint8Array | null {
  if (!secret) return null;
  try {
    return readSecret(secret, format);
  } catch {
    return null;
  }
}
