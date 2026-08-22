import type { PhoneNumber } from "libphonenumber-js/max";

export interface Place {
  location: string;
  network: string;
  zones: string[];
}

export const NOWHERE: Place = { location: "", network: "", zones: [] };

const MAPS = import.meta.glob("./maps/*.json", { query: "?url", import: "default", eager: true }) as Record<
  string,
  string
>;

export function place(number: PhoneNumber): Promise<Place> {
  const held = places.get(number.number);
  if (held) return held;

  const asked = read(number);
  asked.catch(() => places.delete(number.number));
  places.set(number.number, asked);
  return asked;
}

const places = new Map<string, Promise<Place>>();

async function read(number: PhoneNumber): Promise<Place> {
  const [maps, zones] = await Promise.all([load<Maps>(number.countryCallingCode), load<Zones>("zones")]);
  const dialled = `${number.countryCallingCode}${number.nationalNumber}`;

  return {
    location: longest(maps?.geo, dialled) ?? "",
    network: longest(maps?.carrier, dialled) ?? "",
    zones: longest(zones, dialled) ?? [],
  };
}

interface Maps {
  geo: Record<string, string>;
  carrier: Record<string, string>;
}

type Zones = Record<string, string[]>;

function longest<T>(prefixes: Record<string, T> | undefined, digits: string): T | undefined {
  if (!prefixes) return undefined;
  for (let length = digits.length; length > 0; length--) {
    const found = prefixes[digits.slice(0, length)];
    if (found !== undefined) return found;
  }
  return undefined;
}

const files = new Map<string, Promise<unknown>>();

function load<T>(name: string): Promise<T | undefined> {
  const url = MAPS[`./maps/${name}.json`];
  if (!url) return Promise.resolve(undefined);

  const held = files.get(url);
  if (held) return held as Promise<T>;

  const file = fetch(url).then((response) => {
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    return response.json() as Promise<T>;
  });
  file.catch(() => files.delete(url));
  files.set(url, file);
  return file;
}

export function zoneWithOffset(zone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en", { timeZone: zone, timeZoneName: "shortOffset" }).formatToParts();
    const offset = parts.find((part) => part.type === "timeZoneName")?.value;
    return offset ? `${zone} (${offset})` : zone;
  } catch {
    return zone;
  }
}
