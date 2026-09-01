export function keyLines(text: string): string[] {
  return text.split("\n").map((line) => line.trim()).filter((line) => line !== "" && !line.startsWith("#"));
}

export async function identityRecipients(text: string): Promise<string[]> {
  const { identityToRecipient } = await import("age-encryption");
  return Promise.all(
    keyLines(text).map(async (line) => {
      try {
        return await identityToRecipient(line);
      } catch {
        throw new Error(`That is not an age identity: ${shortened(line)}`);
      }
    }),
  );
}

export function shortened(line: string): string {
  return line.length > SHOWN ? `${line.slice(0, SHOWN)}…` : line;
}

const SHOWN = 24;
