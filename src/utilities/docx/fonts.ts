import { defineFontResolver, type FontSource, type FontSourceSubstitution, type MarkedFontResolver } from "@docx-editor.dev/core";
import { loadDefaultFonts } from "@docx-editor.dev/fonts";
import robotoRegular from "@expo-google-fonts/roboto/400Regular/Roboto_400Regular.ttf?url";
import robotoItalic from "@expo-google-fonts/roboto/400Regular_Italic/Roboto_400Regular_Italic.ttf?url";
import robotoBold from "@expo-google-fonts/roboto/700Bold/Roboto_700Bold.ttf?url";
import robotoBoldItalic from "@expo-google-fonts/roboto/700Bold_Italic/Roboto_700Bold_Italic.ttf?url";
import { DEFAULT_FAMILY, DEFAULT_SIZE, type Hosted, isPackaged, normalise, packagedFamilyOf, type Reading, reading } from "./substitutes";

const FACES = [
  { weight: 400, style: "normal" },
  { weight: 700, style: "normal" },
  { weight: 400, style: "italic" },
  { weight: 700, style: "italic" },
] as const;

const ROBOTO = [
  { ...FACES[0], url: robotoRegular },
  { ...FACES[1], url: robotoBold },
  { ...FACES[2], url: robotoItalic },
  { ...FACES[3], url: robotoBoldItalic },
];

export function documentFonts(onRead: (readings: Reading[]) => void): MarkedFontResolver {
  return defineFontResolver(async ({ families, signal }) => {
    const readings = distinct(families).map(reading);
    onRead(readings);

    const hosted = new Set<Hosted>([DEFAULT_FAMILY]);
    for (const { face } of readings) if (face) hosted.add(face);
    const loaded = await loadHosted([...hosted], signal);

    const substitutions: FontSourceSubstitution[] = [];
    for (const { family, face, kind } of readings) {
      if (!face || kind === "own") continue;
      for (const { weight, style } of FACES) {
        const packaged = isPackaged(family)
          && loaded.substitutions.find(({ from }) =>
            normalise(from.family) === normalise(family) && from.weight === weight && from.style === style
          );
        substitutions.push(
          packaged || { from: { family, weight, style }, to: { family: face, weight, style } },
        );
      }
    }

    return {
      sources: loaded.sources,
      substitutions,
      defaultFont: { family: DEFAULT_FAMILY, sizeHalfPoints: DEFAULT_SIZE },
    };
  });
}

async function loadHosted(hosted: Hosted[], signal?: AbortSignal) {
  const families = hosted.map(packagedFamilyOf).filter((family) => family !== null);
  const [packaged, roboto] = await Promise.all([
    families.length > 0 ? loadDefaultFonts({ families, ...(signal ? { signal } : {}) }) : null,
    hosted.includes("Roboto") ? loadRoboto(signal) : [],
  ]);
  return {
    sources: [...(packaged?.sources ?? []), ...roboto],
    substitutions: packaged?.substitutions ?? [],
  };
}

async function loadRoboto(signal?: AbortSignal): Promise<FontSource[]> {
  const faces = await Promise.all(ROBOTO.map(async ({ weight, style, url }) => {
    try {
      const response = await fetch(url, signal ? { signal } : {});
      if (!response.ok) return null;
      const bytes = new Uint8Array(await response.arrayBuffer());
      return {
        request: { family: DEFAULT_FAMILY, weight, style },
        id: `roboto:${weight}:${style}`,
        bytes,
        hash: await sha256(bytes),
        faceIndex: 0,
      } satisfies FontSource;
    } catch (error) {
      if (signal?.aborted) throw signal.reason ?? error;
      return null;
    }
  }));
  return faces.filter((face) => face !== null);
}

function distinct(families: readonly string[]): string[] {
  const seen = new Set<string>();
  return families.filter((family) => {
    const key = normalise(family);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
  return `sha256:${Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
