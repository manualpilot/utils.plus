export interface Verdict {
  text: string;
  colour: string;
}

export function validity(notBefore: Date | null, notAfter: Date | null, now: number): Verdict | null {
  if (notAfter === null) return null;
  if (notBefore !== null && now < notBefore.getTime()) {
    return { text: `Valid ${relative(notBefore.getTime(), now)}`, colour: "yellow" };
  }
  if (now > notAfter.getTime()) return { text: `Expired ${relative(notAfter.getTime(), now)}`, colour: "red" };
  const left = notAfter.getTime() - now;
  return { text: `Expires ${relative(notAfter.getTime(), now)}`, colour: left < SOON ? "yellow" : "teal" };
}

const SOON = 30 * 86400_000;

const NEAR: [Intl.RelativeTimeFormatUnit, number][] = [["day", 86400], ["hour", 3600], ["minute", 60], ["second", 1]];
const FAR: [Intl.RelativeTimeFormatUnit, number][] = [["year", 31536000], ["month", 2629746]];

const QUARTER = 90 * 86400;

const WORDS = new Intl.RelativeTimeFormat(undefined, { numeric: "always" });

export function relative(target: number, now: number): string {
  const seconds = Math.round((target - now) / 1000);
  const size = Math.abs(seconds);
  const units = size < QUARTER ? NEAR : FAR;
  const unit = units.find(([, span]) => size >= span) ?? units[units.length - 1];
  return WORDS.format(Math.trunc(seconds / unit[1]), unit[0]);
}
