import { LOCAL_ZONE, TIME_ZONES } from "../../common/zone-clock";

export const KNOWN_ZONES = new Set(TIME_ZONES);

export function pickZones(value: unknown): string[] {
  if (!Array.isArray(value)) return LOCAL_ZONE === "UTC" ? ["UTC"] : [LOCAL_ZONE, "UTC"];
  return [...new Set(value.filter((zone): zone is string => KNOWN_ZONES.has(zone as string)))];
}

export function pickZone(value: unknown): string {
  return typeof value === "string" && KNOWN_ZONES.has(value) ? value : LOCAL_ZONE;
}
