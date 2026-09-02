import { Badge, Box, Button, Card, CheckIcon, Code, type ComboboxLikeRenderOptionInput, Group, Select, Skeleton, Stack, Table, Text, Title, Tooltip } from "@mantine/core";
import { useReducedMotion } from "@mantine/hooks";
import { type ReactNode, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import { FactTable } from "../../common/fact-table";
import { InfoMark } from "../../common/info-mark";
import { useInitialHashState, useRegisterShareState } from "../../common/share-state";
import { UtilityTitle } from "../../common/utility-title";
import { areaText, callingCodes, coordinates, currencyRows, decimalDegrees, demonymRows, languageRows, nativeNameRows } from "./facts";
import { borderCountries, type Country, COUNTRY_OPTIONS, countryFilter, findCountry, pickCountry, VIEW_OPTIONS } from "./list";
import { flight, type Framing, mapOf, type Place, prepare, VIEW_BOX } from "./map";
import { type Boundaries, DEFAULT_VIEW, pickView, useBoundaries } from "./shapes";

export default function Countries() {
  const initialState = useInitialHashState<{ country?: string; view?: string }>();

  const [country, setCountry] = useState(() => pickCountry(initialState?.country));
  const [view, setView] = useState(() => pickView(initialState?.view));

  useRegisterShareState(() => ({ country: country.cca2, view }));

  const borders = borderCountries(country);
  const prefixes = callingCodes(country);
  const currencies = currencyRows(country);
  const natives = nativeNameRows(country);

  return (
    <Stack gap="md">
      <UtilityTitle directory="countries" publications="Natural Earth">Countries</UtilityTitle>

      <Card withBorder shadow="sm" radius="md">
        <Select
          className="country-picker"
          label="Country"
          description="Searched by name, native name, translation, code, capital or domain"
          data={COUNTRY_OPTIONS}
          value={country.cca2}
          onChange={(code) => setCountry(pickCountry(code))}
          filter={countryFilter}
          leftSection={<Text span>{country.flag}</Text>}
          renderOption={renderCountryOption}
          allowDeselect={false}
          searchable
          selectFirstOptionOnChange
          nothingFoundMessage="No country by that name"
        />
      </Card>

      <Card withBorder shadow="sm" radius="md" data-country={country.cca2}>
        <Stack gap="sm">
          <Group gap="md" align="center" wrap="nowrap">
            <Text span className="country-flag">{country.flag}</Text>
            <Box miw={0}>
              <Title order={3}>{country.name.common}</Title>
              <Text size="sm" c="dimmed">{country.name.official}</Text>
            </Box>
          </Group>
          <Group gap="xs">
            <Marker>{country.region}</Marker>
            {country.subregion && <Marker>{country.subregion}</Marker>}
            <Marker>{country.unMember ? "UN member" : "Not a UN member"}</Marker>
            <Marker>{country.independent ? "Independent" : "Dependent territory"}</Marker>
            {country.landlocked && <Marker>Landlocked</Marker>}
            {country.status !== "officially-assigned" && <Marker>Code is {country.status.replace("-", " ")}</Marker>}
          </Group>
        </Stack>
      </Card>

      <Box className="card-columns">
        <Card withBorder shadow="sm" radius="md">
          <Stack gap="sm">
            <Title order={4}>Codes</Title>
            <FactTable
              rows={[
                { label: "ISO 3166-1 alpha-2", value: country.cca2 },
                { label: "ISO 3166-1 alpha-3", value: country.cca3 },
                { label: "ISO 3166-1 numeric", value: country.ccn3 },
                { label: "Olympic (IOC)", value: country.cioc },
                { label: "Internet domain", value: country.tld.join(", ") },
                { label: "Calling code", value: inlinePrefixes(prefixes) || country.idd.root },
              ]}
            />
            {prefixes.length > INLINE_PREFIXES && (
              <Box>
                <Text size="sm" c="dimmed" mb={6}>{prefixes.length} dialling prefixes</Text>
                <Group gap={4} className="country-prefixes">
                  {prefixes.map((prefix) => <Code key={prefix}>{prefix}</Code>)}
                </Group>
              </Box>
            )}
          </Stack>
        </Card>

        <Card withBorder shadow="sm" radius="md">
          <Stack gap="sm">
            <Title order={4}>Place</Title>
            <FactTable
              rows={[
                { label: "Capital", value: country.capital.join(", ") },
                { label: "Region", value: country.region },
                { label: "Subregion", value: country.subregion },
                { label: "UN regional group", value: country.unRegionalGroup },
                { label: "Area", value: areaText(country) },
                { label: "Coordinates", value: coordinates(country) },
                { label: "Decimal degrees", value: decimalDegrees(country) },
              ]}
            />
            <Box>
              <Text size="sm" c="dimmed" mb={6}>Land borders</Text>
              {borders.length === 0
                ? <Text size="sm">None</Text>
                : (
                  <Group gap="xs">
                    {borders.map((border) => (
                      <Button
                        key={border.cca2}
                        variant="default"
                        size="compact-sm"
                        onClick={() => setCountry(border)}
                      >
                        {border.flag} {border.name.common}
                      </Button>
                    ))}
                  </Group>
                )}
            </Box>
          </Stack>
        </Card>
      </Box>

      <Card withBorder shadow="sm" radius="md">
        <Stack gap="sm">
          <Group justify="space-between" align="flex-end">
            <Title order={4}>Map</Title>
            <Group className="country-view-row" gap={4} align="flex-end" wrap="nowrap">
              {view === DEFAULT_VIEW && <InfoMark label={DEFAULT_MEANS} />}
              <Select
                className="country-view"
                label="Point of view"
                data={VIEW_OPTIONS}
                value={view}
                onChange={(picked) => setView(pickView(picked))}
                renderOption={renderCountryOption}
                allowDeselect={false}
                comboboxProps={{ withinPortal: true }}
              />
            </Group>
          </Group>
          <CountryMap country={country} view={view} onSelect={setCountry} />
        </Stack>
      </Card>

      <Card withBorder shadow="sm" radius="md">
        <Stack gap="lg">
          <Section title="Currencies" empty={currencies.length === 0 && "None of its own"}>
            <ColumnTable
              head={["Code", "Name", "Symbol"]}
              rows={currencies.map((currency) => [currency.code, currency.name, currency.symbol])}
            />
          </Section>
          <Section title="Languages">
            <ColumnTable
              head={["Code", "Language"]}
              rows={languageRows(country).map((language) => [language.code, language.name])}
            />
          </Section>
        </Stack>
      </Card>

      <Card withBorder shadow="sm" radius="md">
        <Stack gap="lg">
          <Section title="Native names" empty={natives.length === 0 && "None recorded"}>
            <ColumnTable
              head={["Language", "Common", "Official"]}
              rows={natives.map((name) => [name.language, name.common, name.official])}
            />
          </Section>
          <Section title="Demonyms">
            <ColumnTable
              head={["Language", "Masculine", "Feminine"]}
              rows={demonymRows(country).map((demonym) => [demonym.language, demonym.masculine, demonym.feminine])}
            />
          </Section>
          <Section title="Alternative spellings">
            <Group gap={4}>{country.altSpellings.map((spelling) => <Code key={spelling}>{spelling}</Code>)}</Group>
          </Section>
        </Stack>
      </Card>
    </Stack>
  );
}

function CountryMap({ country, view, onSelect }: CountryMapProps) {
  const boundaries = useBoundaries(view);
  const [hovered, setHovered] = useState<string>();
  const still = useReducedMotion();
  const flying = useRef<SVGGElement>(null);
  const framing = useRef<Framing>(undefined);
  const [landing, land] = useReducer((count: number) => count + 1, 0);

  const prepared = useMemo(() => {
    if (!boundaries) return undefined;
    const world = prepare(boundaries.world);
    return { world, shapes: boundaries.shapes === boundaries.world ? world : prepare(boundaries.shapes) };
  }, [boundaries]);
  const drawn = useMemo(
    () =>
      prepared
      && mapOf(
        prepared.shapes,
        prepared.world,
        country.cca2,
        borderCountries(country).map((each) => each.cca2),
        placeOf(country),
        still ? undefined : framing.current,
      ),
    [prepared, country, still, landing],
  );

  useLayoutEffect(() => {
    framing.current = drawn?.framing;
    const group = flying.current;
    if (!group || !drawn?.from) return;

    const frames = flight(drawn.from, Number.parseFloat(getComputedStyle(group).strokeWidth) || 0);
    group.style.transform = String(frames[0].transform);
    group.style.strokeWidth = String(frames[0].strokeWidth);

    const moving = group.animate(frames, { duration: FLIGHT, easing: EASING, fill: "forwards" });
    const settle = () => {
      group.style.transform = "";
      group.style.strokeWidth = "";
      moving.cancel();
    };
    moving.finished.then(() => {
      settle();
      land();
    }, () => {});

    return settle;
  }, [drawn]);

  if (boundaries === undefined) return <Skeleton className="country-map" radius="sm" />;
  if (boundaries === null) return <Text size="sm" c="dimmed">The boundaries could not be read.</Text>;

  const under = hovered === undefined ? undefined : findCountry(hovered);
  const naming = (code: string) => ({
    onMouseEnter: () => setHovered(code),
    onMouseLeave: () => setHovered(undefined),
  });

  const reaching = (code: string) =>
    findCountry(code) ? { ...naming(code), onClick: () => onSelect(pickCountry(code)), "data-reachable": true } : {};

  return (
    <Stack gap={6}>
      {drawn && (
        <Tooltip.Floating label={under && <CountryName country={under} />} disabled={!under} position="top">
          <svg className="country-map" viewBox={VIEW_BOX} role="img" aria-label={mapLabel(country)}>
            <g ref={flying} className="country-map-flight">
              {drawn.rest.map((shape) => (
                <path
                  key={shape.code}
                  className="country-map-land"
                  fillRule="evenodd"
                  d={shape.path}
                  {...reaching(shape.code)}
                />
              ))}
              {drawn.borders.map((shape) => (
                <path
                  key={shape.code}
                  className="country-map-neighbour"
                  fillRule="evenodd"
                  d={shape.path}
                  {...reaching(shape.code)}
                />
              ))}
              {drawn.own && (
                <path className="country-map-own" fillRule="evenodd" d={drawn.own} {...naming(country.cca2)} />
              )}
            </g>
          </svg>
        </Tooltip.Floating>
      )}
      <Text size="xs" c="dimmed">{viewText(boundaries)}</Text>
      {country.cca2 in boundaries.absent && <Text size="xs" c="dimmed">{absentText(country, boundaries)}</Text>}
    </Stack>
  );
}

interface CountryMapProps {
  country: Country;
  view: string;
  onSelect: (country: Country) => void;
}

const FLIGHT = 520;

const EASING = "ease-in-out";

function CountryName({ country }: { country: Country }) {
  return (
    <Group gap={6} wrap="nowrap">
      <Text span>{country.flag}</Text>
      <Text span size="sm">{country.name.common}</Text>
    </Group>
  );
}

function viewText({ view }: Boundaries): string {
  const named = view !== DEFAULT_VIEW ? findCountry(view)?.name.common : undefined;
  return named
    ? `Boundaries as Natural Earth draws them for the ${named} point of view.`
    : "Boundaries as Natural Earth draws them by default, from the territory each country holds.";
}

function absentText(country: Country, { absent }: Boundaries): string {
  const holder = findCountry(absent[country.cca2])?.name.common;
  return holder
    ? `No boundary of its own in that view: this land is inside the shape filed under ${holder}.`
    : "No boundary of its own in that view.";
}

const DEFAULT_MEANS = "Default draws each country as the territory it holds rather than as anybody claims it — "
  + "this information is provided by Natural Earth";

function placeOf(country: Country): Place {
  const [latitude, longitude] = country.latlng;
  const across = country.area > 0 ? 2 * Math.sqrt(country.area) / KILOMETRES_TO_A_DEGREE : UNMEASURED;
  return { longitude, latitude, across };
}

const KILOMETRES_TO_A_DEGREE = 111;

const UNMEASURED = 6;

function mapLabel(country: Country): string {
  const borders = borderCountries(country).map((border) => border.name.common);
  return borders.length === 0
    ? `A map of ${country.name.common}, which has no land borders.`
    : `A map of ${country.name.common}, bordering ${borders.join(", ")}.`;
}

const INLINE_PREFIXES = 4;

function inlinePrefixes(prefixes: string[]): string {
  return prefixes.length <= INLINE_PREFIXES ? prefixes.join(", ") : "";
}

function renderCountryOption({ option, checked }: ComboboxLikeRenderOptionInput<{ value: string; label: string }>) {
  const flag = findCountry(option.value)?.flag;
  return (
    <Group gap="xs" wrap="nowrap">
      {checked && <CheckIcon size={12} />}
      {flag && <Text span>{flag}</Text>}
      <Text size="sm">{option.label}</Text>
    </Group>
  );
}

function Marker({ children }: { children: ReactNode }) {
  return <Badge variant="light" color="gray" size="sm" tt="none">{children}</Badge>;
}

function Section({ title, empty, children }: SectionProps) {
  return (
    <Box>
      <Title order={4} mb="xs">{title}</Title>
      {empty ? <Text size="sm">{empty}</Text> : children}
    </Box>
  );
}

interface SectionProps {
  title: string;
  empty?: string | false;
  children: ReactNode;
}

function ColumnTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <Table.ScrollContainer minWidth={360} type="native">
      <Table verticalSpacing={6} horizontalSpacing="xs" withRowBorders={false}>
        <Table.Thead>
          <Table.Tr>
            {head.map((column) => (
              <Table.Th key={column} fw={400}>
                <Text size="xs" c="dimmed">{column}</Text>
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row) => (
            <Table.Tr key={row.join(" ")}>
              {row.map((cell, column) => (
                <Table.Td key={head[column]}>
                  <Text size="sm">{cell}</Text>
                </Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
