import rawTimeZones from "@vvo/tzdb/raw-time-zones.json";
import { fold, rankedFilter, type SearchTerms, termRank } from "../../common/option-search";
import { LOCAL_ZONE, TIME_ZONES } from "../../common/zone-clock";

export const KNOWN_ZONES = new Set(TIME_ZONES);

export function pickZones(value: unknown): string[] {
  if (!Array.isArray(value)) return LOCAL_ZONE === "UTC" ? ["UTC"] : [LOCAL_ZONE, "UTC"];
  return [...new Set(value.filter((zone): zone is string => KNOWN_ZONES.has(zone as string)))];
}

export function pickZone(value: unknown): string {
  return typeof value === "string" && KNOWN_ZONES.has(value) ? value : LOCAL_ZONE;
}

export const zoneFilter = rankedFilter((zone, needle) => termRank(ZONE_TERMS.get(zone)?.search, needle), zoneFold);

export function zoneMatches(zone: string, search: string): string[] {
  const needle = zoneFold(search.trim());
  if (!needle) return [];

  const kept: string[] = [];
  return (ZONE_TERMS.get(zone)?.places ?? []).flatMap((place) => {
    if (
      !place.folded.includes(needle) || kept.some((seen) => seen.includes(place.folded) || place.folded.includes(seen))
    ) {
      return [];
    }
    kept.push(place.folded);
    return [place.text];
  });
}

function zoneFold(value: string): string {
  return fold(value.replace(/_/g, " "));
}

const ZONE_FACTS = new Map<string, RawZone>([
  ...rawTimeZones.flatMap((zone) => zone.group.map((name) => [name, zone] as [string, RawZone])),
  ...rawTimeZones.map((zone) => [zone.name, zone] as [string, RawZone]),
]);

type RawZone = (typeof rawTimeZones)[number];

interface ZoneTerms {
  search: SearchTerms;
  places: { text: string; folded: string }[];
}

const ZONE_TERMS = new Map(TIME_ZONES.map((zone) => [zone, zoneTerms(zone)]));

function zoneTerms(zone: string): ZoneTerms {
  const name = zoneFold(zone);
  const facts = ZONE_FACTS.get(zone);
  if (!facts) return { search: { name, codes: new Set([name]), rest: [name] }, places: [] };

  const cities = facts.name === zone ? facts.mainCities : [];

  const [offset] = facts.rawFormat.split(" ");

  const bands = [
    [facts.countryName, facts.continentName],
    cities,
    [facts.abbreviation, facts.alternativeName, offset],
  ];

  return {
    search: {
      name,
      codes: new Set([zoneFold(facts.abbreviation)]),
      rest: bands.map((band) => zoneFold(band.join(" "))),
    },
    places: places(bands.flat(), name),
  };
}

function places(terms: string[], name: string): { text: string; folded: string }[] {
  const seen = new Set<string>();
  return terms.flatMap((text) => {
    const folded = zoneFold(text);
    if (!folded || seen.has(folded) || name.includes(folded)) return [];
    seen.add(folded);
    return [{ text, folded }];
  });
}
