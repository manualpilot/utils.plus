import { starterForm } from "./fields";
import { generateKey } from "./keys";
import { signToken } from "./sign";
import type { BuildResult, Form } from "./types";

export async function sampleToken(alg: string): Promise<{ form: Form; secret: string; signed: BuildResult }> {
  const form = starterForm();
  const secret = await generateKey(alg);
  const signed = await signToken({ alg, headers: form.headers, claims: form.claims, secret });
  return { form, secret, signed };
}
