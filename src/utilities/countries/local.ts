import rawTimeZones from "@vvo/tzdb/raw-time-zones.json";

export const FALLBACK_COUNTRY = "AU";

export function localCountryCode(): string {
  return zoneCountry() ?? languageRegion() ?? FALLBACK_COUNTRY;
}

function zoneCountry(): string | undefined {
  return ZONE_COUNTRIES.get(Intl.DateTimeFormat().resolvedOptions().timeZone);
}

const ZONE_COUNTRIES = new Map<string, string>(
  rawTimeZones.flatMap((zone) =>
    [zone.name, ...zone.group].map((name) => [name, zone.countryCode] as [string, string])
  ),
);

function languageRegion(): string | undefined {
  for (const tag of preferredLanguages()) {
    try {
      const region = new Intl.Locale(tag).region;
      if (region) return region;
    } catch {
    }
  }
  return undefined;
}

function preferredLanguages(): readonly string[] {
  const languages = navigator.languages;
  return languages?.length ? languages : navigator.language ? [navigator.language] : [];
}
