import { Accordion, Anchor, Badge, Box, Card, Group, Loader, Stack, Text, TextInput, Title } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import attributions from "../attribution/attributions.json";
import gplUrl from "../attribution/canonical/GPL-3.0.txt?url";
import postgresUrl from "../attribution/canonical/PostgreSQL.txt?url";
import pythonUrl from "../attribution/canonical/Python-2.0.txt?url";
import { shuffle } from "./common/random";
import { IconSearch } from "./icons";

export default function Attributions() {
  const [query, setQuery] = useState("");
  const [opened, setOpened] = useState<string | null>(null);

  const needle = query.trim().toLowerCase();
  const matches = useMemo(
    () => needle ? packages.filter((p) => `${p.name} ${p.license}`.toLowerCase().includes(needle)) : packages,
    [needle],
  );

  return (
    <Stack gap="md">
      <Title order={2} lh={1.15}>Attributions</Title>

      <Card withBorder shadow="sm" radius="md">
        <Stack gap="sm">
          <Text size="sm">
            utils+ is open source under the{" "}
            <Anchor href={`${REPO}/blob/main/LICENSE`} target="_blank" rel="noopener noreferrer" inherit>
              Apache License 2.0
            </Anchor>
            , and is built on the {packages.length}{" "}
            open source packages listed below. Every one of them is served from this site along with the rest of the
            page, so their licences travel with it — this page is where they are kept. Build tooling that never reaches
            your browser is not listed.
          </Text>
          <Text size="sm" c="dimmed">
            Licence texts are reproduced from the packages themselves. Where a package ships none, the canonical text
            for the licence it declares stands in and is marked as such.
          </Text>
        </Stack>
      </Card>

      <Card withBorder shadow="sm" radius="md">
        <Stack gap="sm">
          <Title order={4}>Licences in use</Title>
          <Group gap="xs">
            {summary.map(([license, count]) => (
              <Badge key={license} variant="light" color="gray" size="lg" tt="none">
                {license} · {count}
              </Badge>
            ))}
          </Group>
        </Stack>
      </Card>

      <Card withBorder shadow="sm" radius="md">
        <Stack gap="sm">
          <TextInput
            label="Packages"
            description={`${matches.length} of ${packages.length} shown, in no particular order`}
            placeholder="Filter by name or licence"
            leftSection={<IconSearch size="1rem" stroke={1.5} />}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />

          <Accordion variant="separated" value={opened} onChange={setOpened}>
            {matches.map((pkg) => (
              <Accordion.Item key={pkg.name} value={pkg.name}>
                <Accordion.Control>
                  <Group gap="xs" wrap="wrap">
                    <Text size="sm" ff="monospace">{pkg.name}</Text>
                    <Text size="sm" c="dimmed" ff="monospace">{pkg.version}</Text>
                    <Badge variant="light" color="gray" size="sm" tt="none">{pkg.license}</Badge>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  {opened === pkg.name && (
                    <Stack gap="xs">
                      <Group gap="sm">
                        {pkg.url && (
                          <Anchor href={pkg.url} target="_blank" rel="noopener noreferrer" size="sm">Source</Anchor>
                        )}
                        {pkg.publisher && <Text size="sm" c="dimmed">{pkg.publisher}</Text>}
                      </Group>
                      {pkg.reconstructed && (
                        <Text size="xs" c="dimmed">
                          This package ships no licence file; below is the canonical {pkg.license} text.
                        </Text>
                      )}
                      <Licence url={LICENCES[pkg.file]} />
                    </Stack>
                  )}
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        </Stack>
      </Card>

      <Card withBorder shadow="sm" radius="md">
        <Stack gap="lg">
          <Box>
            <Title order={4}>Pyodide</Title>
            <Text size="sm" mt={4}>
              The interpreter behind <Anchor href="/python" inherit>Python</Anchor> is{" "}
              <Anchor href="https://github.com/pyodide/pyodide" target="_blank" rel="noopener noreferrer" inherit>
                Pyodide
              </Anchor>
              {pyodide && ` ${pyodide.version}`}, licensed under the{" "}
              <strong>Mozilla Public License 2.0</strong>. The copy served here is the unmodified npm release, kept as
              its own files rather than merged into the rest of the site, and the source it was built from is behind the
              link above. What those files carry is CPython and its standard library, under the{" "}
              <strong>Python Software Foundation License 2.0</strong>, reproduced at the bottom of this page.
            </Text>
          </Box>

          <Box>
            <Title order={4}>PGlite</Title>
            <Text size="sm" mt={4}>
              The Postgres mode of <Anchor href="/sql" inherit>SQL</Anchor> runs on{" "}
              <Anchor href="https://github.com/electric-sql/pglite" target="_blank" rel="noopener noreferrer" inherit>
                PGlite
              </Anchor>
              {pglite && ` ${pglite.version}`}, licensed under the{" "}
              <strong>Apache License 2.0</strong>. The copy served here is the unmodified npm release, its WebAssembly
              kept as files of its own rather than merged into the rest of the site, and the source it was built from is
              behind the link above. What those files carry is PostgreSQL itself, under the{" "}
              <strong>PostgreSQL Licence</strong>, reproduced at the bottom of this page.
            </Text>
          </Box>

          <Box>
            <Title order={4}>SQLite Wasm</Title>
            <Text size="sm" mt={4}>
              The SQLite mode of <Anchor href="/sql" inherit>SQL</Anchor> runs on{" "}
              <Anchor href="https://github.com/sqlite/sqlite-wasm" target="_blank" rel="noopener noreferrer" inherit>
                the SQLite project's own Wasm build
              </Anchor>, wrapped as a module under the{" "}
              <strong>Apache License 2.0</strong>. The engine inside that wrapper is SQLite, which its authors have{" "}
              <Anchor href="https://sqlite.org/copyright.html" target="_blank" rel="noopener noreferrer" inherit>
                dedicated to the public domain
              </Anchor>
              : it is under no licence at all and asks for no notice, so it is named here rather than listed above.
            </Text>
          </Box>

          <Box>
            <Title order={4}>DOMPurify</Title>
            <Text size="sm" mt={4}>
              The preview on <Anchor href="/markdown" inherit>Markdown</Anchor> is sanitised with{" "}
              <Anchor href="https://github.com/cure53/DOMPurify" target="_blank" rel="noopener noreferrer" inherit>
                DOMPurify
              </Anchor>, which its authors offer under either the Mozilla Public License 2.0 or version 2.0 of the
              Apache License. utils+ takes it under{" "}
              <strong>Apache-2.0</strong>, which is the text the package itself ships and the licence utils+ is released
              under.
            </Text>
          </Box>

          <Box>
            <Title order={4}>Roboto</Title>
            <Text size="sm" mt={4}>
              The typeface is{" "}
              <Anchor
                href="https://github.com/googlefonts/roboto-classic"
                target="_blank"
                rel="noopener noreferrer"
                inherit
              >
                Roboto
              </Anchor>, self-hosted here under the{" "}
              <strong>SIL Open Font License 1.1</strong>. It is served unmodified and under its own name, and it is not
              sold, on its own or with anything else. The PDF that <Anchor href="/markdown" inherit>Markdown</Anchor>
              {" "}
              writes is typeset by pdfmake, which carries a copy of the same typeface of its own and embeds it in the
              file it writes: the same faces, arriving inside a package rather than as files beside it, and named here
              for the reason the served copy is.
            </Text>
          </Box>
          <Box>
            <Title order={4}>Twemoji Country Flags</Title>
            <Text size="sm" mt={4}>
              The flags on <Anchor href="/countries" inherit>Countries</Anchor> are drawn from the{" "}
              <Anchor
                href="https://github.com/talkjs/country-flag-emoji-polyfill"
                target="_blank"
                rel="noopener noreferrer"
                inherit
              >
                Twemoji Country Flags
              </Anchor>{" "}
              font, self-hosted here because Windows draws a flag emoji as the letter pair it is built from and no stack
              of system fonts can be asked for one instead. The build is TalkJS's, under the{" "}
              <strong>MIT licence</strong>, and is served unmodified; the artwork in it is{" "}
              <Anchor href="https://github.com/jdecked/twemoji" target="_blank" rel="noopener noreferrer" inherit>
                Twemoji
              </Anchor>, used under the{" "}
              <Anchor
                href="https://creativecommons.org/licenses/by/4.0/"
                target="_blank"
                rel="noopener noreferrer"
                inherit
              >
                Creative Commons Attribution 4.0 International licence
              </Anchor>, the change made to it being the packaging of those flags as a font.
            </Text>
          </Box>
          <Box>
            <Title order={4}>world-countries</Title>
            <Text size="sm" mt={4}>
              Everything <Anchor href="/countries" inherit>Countries</Anchor> shows comes from{" "}
              <Anchor href="https://github.com/mledoze/countries" target="_blank" rel="noopener noreferrer" inherit>
                world-countries
              </Anchor>
              {worldCountries && ` ${worldCountries.version}`}, which is the one licence here covering a body of data
              rather than a body of code: the{" "}
              <strong>Open Database License 1.0</strong>, whose full text is above. The copy served is the unmodified
              npm release, read by that page and by nothing else, and utils+ has produced no derived database from it.
            </Text>
          </Box>
          <Box>
            <Title order={4}>Natural Earth</Title>
            <Text size="sm" mt={4}>
              The map on <Anchor href="/countries" inherit>Countries</Anchor> is drawn from{" "}
              <Anchor href="https://www.naturalearthdata.com/" target="_blank" rel="noopener noreferrer" inherit>
                Natural Earth
              </Anchor>, whose authors have placed every version of its map data in the{" "}
              <strong>public domain</strong>: no permission is asked for and no notice is required, and this one is here
              because a boundary is somebody's work whether or not they ask to be named for it. The boundaries are taken
              at build time from a pinned release of{" "}
              <Anchor
                href="https://github.com/nvkelso/natural-earth-vector"
                target="_blank"
                rel="noopener noreferrer"
                inherit
              >
                natural-earth-vector
              </Anchor>{" "}
              and simplified for drawing, so what is served here is derived from that data rather than a copy of it —
              which is also why no package above names it. The points of view are Natural Earth's own: it publishes a
              default set of boundaries drawn from who holds the ground, and a separate set for each of thirty-one
              countries drawn as that country's own law and conventions have them. Which one a reader is shown follows
              the country their browser reports, and the map says underneath it which one that was.
            </Text>
          </Box>
          <Box>
            <Title order={4}>libphonenumber</Title>
            <Text size="sm" mt={4}>
              Everything <Anchor href="/phone-number" inherit>Phone Number</Anchor> reads comes out of Google's{" "}
              <Anchor href="https://github.com/google/libphonenumber" target="_blank" rel="noopener noreferrer" inherit>
                libphonenumber
              </Anchor>, under the{" "}
              <strong>Apache License 2.0</strong>, whose full text is above. The numbering plans are the copy compiled
              into{" "}
              <Anchor
                href="https://gitlab.com/catamphetamine/libphonenumber-js"
                target="_blank"
                rel="noopener noreferrer"
                inherit
              >
                libphonenumber-js
              </Anchor>
              {libphonenumberJs && ` ${libphonenumberJs.version}`}, which is listed above under its own{" "}
              <strong>MIT licence</strong>{" "}
              and whose own file says nothing about the plans inside it. The geocoding, carrier and timezone maps are
              taken unmodified from that repository's published releases at build time and served here as files of their
              own, which is why no package above names them.
            </Text>
          </Box>
          <Box>
            <Title order={4}>OpenPGP.js</Title>
            <Text size="sm" mt={4}>
              The PGP keys on <Anchor href="/keygen" inherit>Keygen</Anchor> are generated by{" "}
              <Anchor href="https://github.com/openpgpjs/openpgpjs" target="_blank" rel="noopener noreferrer" inherit>
                OpenPGP.js
              </Anchor>
              {openpgp && ` ${openpgp.version}`}, which is licensed under the{" "}
              <strong>GNU Lesser General Public License, version 3 or later</strong>. utils+ uses it as a library and
              has not modified it: the copy served here is the unmodified npm release, kept in its own file rather than
              merged into the rest of the site, so it can be swapped for another build of the same library. The full
              source of utils+ is at{" "}
              <Anchor href={REPO} target="_blank" rel="noopener noreferrer" inherit>{REPO_LABEL}</Anchor>, which is
              everything needed to rebuild this site against a modified OpenPGP.js. Both licence texts the LGPL calls
              for are at the bottom of this page.
            </Text>
          </Box>
        </Stack>
      </Card>

      <Card withBorder shadow="sm" radius="md">
        <Stack gap="sm">
          <Title order={4}>The PostgreSQL Licence</Title>
          <Text size="sm" c="dimmed">
            Reproduced because the PostgreSQL server PGlite carries is served from this site, and it arrives inside a
            package rather than as one. It does not govern utils+ itself.
          </Text>
          <Licence url={postgresUrl} />
        </Stack>
      </Card>
      <Card withBorder shadow="sm" radius="md">
        <Stack gap="sm">
          <Title order={4}>Python Software Foundation License, version 2</Title>
          <Text size="sm" c="dimmed">
            Reproduced because the Python standard library Pyodide carries is served from this site, and it is the one
            licence here that arrives inside a package rather than as one. It does not govern utils+ itself.
          </Text>
          <Licence url={pythonUrl} />
        </Stack>
      </Card>
      <Card withBorder shadow="sm" radius="md">
        <Stack gap="sm">
          <Title order={4}>GNU General Public License, version 3</Title>
          <Text size="sm" c="dimmed">
            Reproduced because the GNU LGPL v3, which covers OpenPGP.js above, is written as a set of additional
            permissions on top of this licence and calls for both texts to be conveyed together. It does not govern
            utils+ itself.
          </Text>
          <Licence url={gplUrl} />
        </Stack>
      </Card>
    </Stack>
  );
}

function Licence({ url }: { url: string | undefined }) {
  const [text, setText] = useState<string | null | undefined>(() => LOADED.get(url ?? ""));

  useEffect(() => {
    if (text !== undefined) return;
    let reading = true;
    read(url).then((loaded) => reading && setText(loaded));
    return () => {
      reading = false;
    };
  }, [url, text]);

  if (text === undefined) {
    return (
      <Group gap="xs">
        <Loader size="xs" />
        <Text size="sm" c="dimmed">Reading the licence…</Text>
      </Group>
    );
  }

  if (text === null) {
    return <Text size="sm" c="dimmed">This licence could not be read; the source is linked above.</Text>;
  }
  return <LicenceText>{text}</LicenceText>;
}

function LicenceText({ children }: { children: string }) {
  return (
    <Text
      component="pre"
      size="xs"
      ff="monospace"
      style={{ whiteSpace: "pre-wrap", maxHeight: "22rem", overflow: "auto", margin: 0 }}
    >
      {children}
    </Text>
  );
}

function read(url: string | undefined): Promise<string | null> {
  if (!url) return Promise.resolve(null);

  const reading = READING.get(url) ?? fetch(url)
    .then((response) => response.ok ? response.text() : null)
    .catch(() => null)
    .then((body) => {
      const text = body === null ? null : body.trim();
      if (text === null) READING.delete(url);
      else LOADED.set(url, text);
      return text;
    });

  READING.set(url, reading);
  return reading;
}

const READING = new Map<string, Promise<string | null>>();
const LOADED = new Map<string, string>();

interface Attribution {
  name: string;
  version: string;
  license: string;
  publisher: string;
  url: string;
  file: string;
  reconstructed?: boolean;
}

const packages = [...(attributions.packages as Attribution[])];
shuffle(packages);

const LICENCES: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob("../attribution/license/*.txt", { query: "?url", import: "default", eager: true }) as Record<
      string,
      string
    >,
  ).map(([path, url]) => [path.slice(path.lastIndexOf("/") + 1, -".txt".length), url]),
);
const openpgp = packages.find((pkg) => pkg.name === "openpgp");
const pyodide = packages.find((pkg) => pkg.name === "pyodide");
const pglite = packages.find((pkg) => pkg.name === "@electric-sql/pglite");
const worldCountries = packages.find((pkg) => pkg.name === "world-countries");
const libphonenumberJs = packages.find((pkg) => pkg.name === "libphonenumber-js");

const summary = Object.entries(
  packages.reduce<Record<string, number>>((counts, pkg) => {
    counts[pkg.license] = (counts[pkg.license] ?? 0) + 1;
    return counts;
  }, {}),
).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

const REPO_LABEL = "manualpilot/utils.plus";
const REPO = `https://github.com/${REPO_LABEL}`;
