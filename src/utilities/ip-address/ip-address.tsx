import { Badge, Box, Card, Group, Loader, NumberInput, SegmentedControl, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { type ReactNode, useState } from "react";
import { FactTable } from "../../common/fact-table";
import { useInitialHashState, useRegisterShareState } from "../../common/share-state";
import { UtilityTitle } from "../../common/utility-title";
import { AS_PROBLEM, asWidth, readAsNumber, reservedUse, writeAsNumber } from "./asn";
import { type Block, blockOf, holdsBlock, hostsOf, lastOf, maskFor, roleOf, sizeOf, split, splitCount, wildcardFor } from "./blocks";
import { type Delegation, flagOf, useAsDelegation, useDelegation } from "./delegation";
import { type Address, BITS, type Family, familyOf, prefixOf, readCidr, type Reading, withPrefix } from "./parse";
import { administrationOf, asRangeOf, multicastGroup } from "./registry";
import { type Origins, useOrigins } from "./roa";
import { ASN, FAMILIES, type Mode, MODE_OPTIONS, pickAddress, pickAsn, pickFamily, pickMode, pickSplit, pickText, SPLIT_LIMIT, titleOf } from "./settings";
import type { Reading as ShardReading } from "./shards";
import { classify, REACH_COLOUR, REACH_LABEL } from "./special";
import { embeddedIpv4, writeAddress, writeArpa, writeBinary, writeCidr, writeCount, writeExpanded, writeHex, writeInteger, writeValue } from "./write";

export default function IpAddress() {
  const initialState = useInitialHashState<{
    mode?: string;
    family?: string;
    address?: string;
    asn?: string;
    contains?: string;
    split?: number;
  }>();

  const initialMode = pickMode(initialState?.mode ?? initialState?.family);
  const initialFamily = pickFamily(initialMode === "asn" ? initialState?.family : initialMode);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [family, setFamily] = useState<Family>(initialFamily);
  const [text, setText] = useState(() => pickAddress(initialState?.address, initialFamily));
  const [asnText, setAsnText] = useState(() => pickAsn(initialState?.asn));
  const [probe, setProbe] = useState(() => pickText(initialState?.contains));
  const [splitPrefix, setSplitPrefix] = useState<number | string>(() => pickSplit(initialState?.split, initialFamily));

  useRegisterShareState(() => ({
    mode,
    family: mode === "asn" ? undefined : family,
    address: mode === "asn" ? undefined : text,
    asn: mode === "asn" ? asnText : undefined,
    contains: mode === "asn" ? undefined : probe || undefined,
    split: mode !== "asn" && typeof splitPrefix === "number" ? splitPrefix : undefined,
  }));

  const result = readCidr(text, family);
  const error = result.kind === "error" ? result.message : undefined;

  const onText = (value: string) => {
    setText(value);
    const named = familyOf(value);
    if (named && named !== family) {
      setFamily(named);
      setMode(named);
      setProbe("");
      setSplitPrefix("");
    }
  };

  const onMode = (value: string) => {
    const picked = pickMode(value);
    setMode(picked);
    if (picked === "asn") return;

    setFamily(picked);
    setText(FAMILIES[picked].sample);
    setProbe("");
    setSplitPrefix("");
  };

  const onPrefix = (value: number | string) => {
    if (typeof value === "number") setText((current) => withPrefix(current, value));
  };

  return (
    <Stack gap="md">
      <UtilityTitle
        directory="ip-address"
        control={
          <SegmentedControl
            value={mode}
            onChange={onMode}
            aria-label="What to look up"
            data={MODE_OPTIONS}
          />
        }
      >
        {titleOf(mode)}
      </UtilityTitle>

      {mode === "asn"
        ? <AsNumber text={asnText} onText={setAsnText} />
        : (
          <>
            <Card withBorder shadow="sm" radius="md">
              <Box className={error ? "settings-row has-error" : "settings-row"} mb={error ? "md" : 0}>
                <TextInput
                  label="Address"
                  description="An address, a block in CIDR notation, or the whole number one of them is stored as"
                  placeholder={FAMILIES[family].hint}
                  value={text}
                  onChange={(event) => onText(event.currentTarget.value)}
                  error={error}
                  classNames={{ root: "relative-root", error: "absolute-error" }}
                  styles={{ input: { fontFamily: "monospace" } }}
                  spellCheck={false}
                  autoCapitalize="off"
                />
                <NumberInput
                  label="Prefix length"
                  description={`How much of it names the network, 0 to ${BITS[family]}`}
                  value={prefixOf(text, family) ?? ""}
                  onChange={onPrefix}
                  min={0}
                  max={BITS[family]}
                  clampBehavior="strict"
                  allowNegative={false}
                  allowDecimal={false}
                />
              </Box>
            </Card>

            {result.kind === "reading" && (
              <Analysis
                reading={result.reading}
                probe={probe}
                onProbe={setProbe}
                splitPrefix={splitPrefix}
                onSplitPrefix={setSplitPrefix}
              />
            )}
          </>
        )}
    </Stack>
  );
}

function Analysis({ reading, probe, onProbe, splitPrefix, onSplitPrefix }: AnalysisProps) {
  const { address, prefix } = reading;
  const block = blockOf(address, prefix);
  const family = address.family;
  const special = classify(address);
  const hosts = hostsOf(block);
  const size = sizeOf(block);

  const administration = administrationOf(address);
  const group = multicastGroup(address);
  const delegation = useDelegation(address);
  const origins = useOrigins(address);

  return (
    <>
      <Card withBorder shadow="sm" radius="md" data-overview>
        <Stack gap="sm">
          <Box miw={0}>
            <Text className="ip-address-figure">{writeAddress(address)}</Text>
            <Text size="sm" c="dimmed">{special.name} — {special.rfc}</Text>
          </Box>
          <Group gap="xs">
            <Badge variant="light" color={REACH_COLOUR[special.reach]} size="sm" tt="none">
              {REACH_LABEL[special.reach]}
            </Badge>
            <Marker>{writeCidr(block)}</Marker>
            <Marker>{roleOf(address, block)}</Marker>
            {group && <Marker>{group}</Marker>}
          </Group>
        </Stack>
      </Card>

      <Card withBorder shadow="sm" radius="md" data-registry>
        <Stack gap="sm">
          <CardTitle reading={delegation.reading}>Registry</CardTitle>
          <FactTable
            rows={[
              { label: "Administered by", value: administration?.designation ?? "" },
              { label: "IANA block", value: administration?.cidr ?? "" },
              { label: "IANA status", value: administration?.status ?? "" },
              { label: "IANA record", value: administration?.date ?? "" },
              ...delegationRows(delegation.answer, family),
              { label: "Whois", value: administration?.whois ?? "" },
              { label: "RDAP", value: administration?.rdap ?? "" },
            ]}
          />
          {delegation.answer?.country && (
            <Text size="sm" c="dimmed">
              The country is where the resource was registered, not where it is used or routed.
            </Text>
          )}
        </Stack>
      </Card>

      <Box className="card-columns">
        <Card withBorder shadow="sm" radius="md" data-address>
          <Stack gap="sm">
            <Title order={4}>Address</Title>
            <FactTable
              rows={[
                { label: "Canonical", value: writeAddress(address) },
                { label: "Expanded", value: family === "ipv6" ? writeExpanded(address) : "" },
                { label: "Integer", value: writeInteger(address) },
                { label: "Hexadecimal", value: writeHex(address) },
                { label: "Binary", value: family === "ipv4" ? writeBinary(address) : "" },
                { label: "Embedded IPv4", value: embeddedIpv4(address) },
                { label: "Zone", value: address.zone },
                { label: "Reverse DNS", value: writeArpa(address) },
              ]}
            />
          </Stack>
        </Card>

        <Card withBorder shadow="sm" radius="md" data-block>
          <Stack gap="sm">
            <Title order={4}>Block</Title>
            <FactTable
              rows={[
                { label: "CIDR", value: writeCidr(block) },
                { label: "Netmask", value: writeValue(maskFor(family, prefix), family) },
                { label: "Wildcard", value: family === "ipv4" ? writeValue(wildcardFor(family, prefix), family) : "" },
                { label: "Network", value: writeValue(block.network, family) },
                {
                  label: "Broadcast",
                  value: family === "ipv4" && size > 2n ? writeValue(lastOf(block), family) : "",
                },
                {
                  label: "First host",
                  value: family === "ipv4" && size > 1n ? writeValue(hosts.first, family) : "",
                },
                {
                  label: family === "ipv4" ? "Last host" : "Last address",
                  value: size > 1n ? writeValue(hosts.last, family) : "",
                },
                { label: "Usable hosts", value: family === "ipv4" ? writeCount(hosts.usable) : "" },
                { label: "Total addresses", value: writeCount(size) },
              ]}
            />
          </Stack>
        </Card>
      </Box>

      <Origin origins={origins} />
      <Containment block={block} value={probe} onChange={onProbe} />
      {prefix < BITS[family] && <Splits block={block} prefix={splitPrefix} onChange={onSplitPrefix} />}
    </>
  );
}

function Origin({ origins }: { origins: ShardReading<Origins> }) {
  const covering = [...origins.answer?.covering ?? []].sort((left, right) => right.prefix - left.prefix);
  const answered = origins.answer !== undefined;

  return (
    <Card withBorder shadow="sm" radius="md" data-origin>
      <Stack gap="sm">
        <CardTitle reading={origins.reading}>Route origin</CardTitle>
        {origins.reading
          ? <Text size="sm" c="dimmed">Reading the signed authorisations…</Text>
          : !answered
          ? <Text size="sm" c="dimmed">The authorisations for this address could not be read.</Text>
          : covering.length === 0
          ? (
            <>
              <Group gap="xs">
                <Badge variant="light" color="gray" size="sm" tt="none" data-verdict>No ROA published</Badge>
              </Group>
              <Text size="sm" c="dimmed">
                Nobody has signed an authorisation covering this address, so RPKI says nothing about who may originate
                it. About a third of routed IPv4 space is in this state.
              </Text>
            </>
          )
          : (
            <>
              <Group gap="xs">
                <Badge variant="light" color="teal" size="sm" tt="none" data-verdict>Authorised origin</Badge>
                {covering[0].origins.map((origin) => <Marker key={origin}>{writeAsNumber(origin)}</Marker>)}
              </Group>
              <Table verticalSpacing={6} horizontalSpacing="xs" withRowBorders={false}>
                <Table.Tbody>
                  {covering.map((roa) => (
                    <Table.Tr key={roa.cidr}>
                      <Table.Td w="1%" style={{ whiteSpace: "nowrap" }}>
                        <Text size="sm" ff="monospace">{roa.cidr}</Text>
                      </Table.Td>
                      <Table.Td w="1%" style={{ whiteSpace: "nowrap" }}>
                        <Text size="sm" c="dimmed">up to /{roa.maxLength}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" ff="monospace" style={{ overflowWrap: "anywhere" }}>
                          {roa.origins.map(writeAsNumber).join(", ")}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
              <Text size="sm" c="dimmed">
                Signed by the holder of the prefix, from the validated set of{" "}
                {origins.answer?.release}. This is who may originate it, not who was announcing it.
              </Text>
            </>
          )}
      </Stack>
    </Card>
  );
}

function AsNumber({ text, onText }: { text: string; onText: (value: string) => void }) {
  const result = readAsNumber(text);
  const error = result.kind === "error" ? result.message : undefined;
  const number = result.kind === "reading" ? result.number : undefined;

  const range = number === undefined ? undefined : asRangeOf(number);
  const reserved = number === undefined ? "" : reservedUse(number);
  const delegation = useAsDelegation(number);

  return (
    <>
      <Card withBorder shadow="sm" radius="md">
        <Box className={error ? "settings-row has-error" : "settings-row"} mb={error ? "md" : 0}>
          <TextInput
            label="AS number"
            description={AS_PROBLEM}
            placeholder={ASN.hint}
            value={text}
            onChange={(event) => onText(event.currentTarget.value)}
            error={error}
            classNames={{ root: "relative-root", error: "absolute-error" }}
            styles={{ input: { fontFamily: "monospace" } }}
            spellCheck={false}
            autoCapitalize="off"
          />
        </Box>
      </Card>

      {number !== undefined && (
        <>
          <Card withBorder shadow="sm" radius="md" data-overview>
            <Stack gap="sm">
              <Box miw={0}>
                <Text className="ip-address-figure">{writeAsNumber(number)}</Text>
                <Text size="sm" c="dimmed">{range?.designation ?? "Unallocated"}</Text>
              </Box>
              <Group gap="xs">
                <Badge variant="light" color={reserved ? "orange" : "teal"} size="sm" tt="none" data-verdict>
                  {reserved ? "Reserved, never delegated" : "Delegated to a registry"}
                </Badge>
                <Marker>{asWidth(number)}</Marker>
                {reserved && <Marker>{reserved}</Marker>}
              </Group>
            </Stack>
          </Card>

          <Card withBorder shadow="sm" radius="md" data-registry>
            <Stack gap="sm">
              <CardTitle reading={delegation.reading}>Registry</CardTitle>
              <FactTable
                rows={[
                  { label: "Administered by", value: range?.designation ?? "" },
                  { label: "IANA range", value: range ? asRangeText(range.first, range.last) : "" },
                  { label: "Decimal", value: String(number) },
                  ...delegationRows(delegation.answer, "asn"),
                  { label: "Whois", value: range?.whois ?? "" },
                  { label: "RDAP", value: range?.rdap ?? "" },
                ]}
              />
              {reserved && (
                <Text size="sm" c="dimmed">
                  A reserved number is used inside networks and appears in no registry, so nothing was delegated.
                </Text>
              )}
            </Stack>
          </Card>
        </>
      )}
    </>
  );
}

function delegationRows(delegation: Delegation | undefined, kind: Family | "asn") {
  if (!delegation) return [];
  const flag = flagOf(delegation.country);
  return [
    { label: "Delegated to", value: delegation.rir.toUpperCase() },
    { label: "Country", value: delegation.country ? `${flag} ${delegation.country}`.trim() : "" },
    { label: "Delegated", value: delegation.date },
    {
      label: kind === "asn" ? "Delegated range" : "Delegated block",
      value: kind === "asn"
        ? asRangeText(Number(delegation.first), Number(delegation.last))
        : `${writeValue(delegation.first, kind)} – ${writeValue(delegation.last, kind)}`,
    },
  ];
}

function asRangeText(first: number, last: number): string {
  return first === last ? writeAsNumber(first) : `${writeAsNumber(first)} – ${writeAsNumber(last)}`;
}

function CardTitle({ reading, children }: { reading: boolean; children: ReactNode }) {
  return (
    <Group gap="xs" align="center">
      <Title order={4}>{children}</Title>
      {reading && <Loader size="xs" type="dots" />}
    </Group>
  );
}

function Containment({ block, value, onChange }: ContainmentProps) {
  const result = readCidr(value, block.family);
  const error = result.kind === "error" ? result.message : undefined;
  const inner = result.kind === "reading" ? blockOf(result.reading.address, result.reading.prefix) : null;
  const inside = inner !== null && holdsBlock(block, inner);

  return (
    <Card withBorder shadow="sm" radius="md" data-contains>
      <Stack gap="sm">
        <Title order={4}>Containment</Title>
        <Box className={error ? "settings-row has-error" : "settings-row"} mb={error ? "md" : 0}>
          <TextInput
            label="Is inside this block?"
            description={`Tested against ${writeCidr(block)}`}
            placeholder={FAMILIES[block.family].probe}
            value={value}
            onChange={(event) => onChange(event.currentTarget.value)}
            error={error}
            classNames={{ root: "relative-root", error: "absolute-error" }}
            styles={{ input: { fontFamily: "monospace" } }}
            spellCheck={false}
            autoCapitalize="off"
          />
        </Box>
        {inner !== null && (
          <>
            <Group gap="xs">
              <Badge variant="light" color={inside ? "teal" : "orange"} size="sm" tt="none" data-verdict>
                {inside ? "Inside" : "Outside"}
              </Badge>
              <Marker>{writeCidr(inner)}</Marker>
            </Group>
            <FactTable
              rows={[
                {
                  label: "Offset from the network",
                  value: inside ? writeCount(inner.network - block.network) : "",
                },
              ]}
            />
          </>
        )}
      </Stack>
    </Card>
  );
}

function Splits({ block, prefix, onChange }: SplitsProps) {
  const bits = BITS[block.family];
  const target = typeof prefix === "number" ? prefix : null;
  const count = target === null ? 0n : splitCount(block, target);
  const parts = count === 0n ? [] : split(block, target as number, SPLIT_LIMIT);
  const error = target !== null && count === 0n
    ? `A prefix narrower than /${block.prefix}, up to /${bits}`
    : undefined;

  return (
    <Card withBorder shadow="sm" radius="md" data-split>
      <Stack gap="sm">
        <Title order={4}>Split</Title>
        <Box className={error ? "settings-row has-error" : "settings-row"} mb={error ? "md" : 0}>
          <NumberInput
            label="Into blocks of"
            description={`A prefix from /${block.prefix + 1} to /${bits}`}
            placeholder={`/${Math.min(block.prefix + 1, bits)}`}
            prefix="/"
            value={prefix}
            onChange={onChange}
            error={error}
            classNames={{ root: "relative-root", error: "absolute-error" }}
            min={block.prefix + 1}
            max={bits}
            allowNegative={false}
            allowDecimal={false}
          />
        </Box>
        {parts.length === 0
          ? (
            <Text size="sm" c="dimmed">
              Pick a narrower prefix to divide {writeCidr(block)} into equal blocks.
            </Text>
          )
          : (
            <>
              <Text size="sm" c="dimmed">
                {writeCount(count)} blocks of /{target}
                {count > BigInt(parts.length) && `, of which the first ${parts.length} are listed`}
              </Text>
              <Table.ScrollContainer minWidth={360} type="native">
                <Table verticalSpacing={6} horizontalSpacing="xs" withRowBorders={false}>
                  <Table.Tbody>
                    {parts.map((part) => (
                      <Table.Tr key={part.network.toString()}>
                        <Table.Td w="1%" style={{ whiteSpace: "nowrap" }}>
                          <Text size="sm" ff="monospace">{writeCidr(part)}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c="dimmed" ff="monospace" style={{ overflowWrap: "anywhere" }}>
                            {writeValue(part.network, part.family)} – {writeValue(lastOf(part), part.family)}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </>
          )}
      </Stack>
    </Card>
  );
}

function Marker({ children }: { children: ReactNode }) {
  return <Badge variant="light" color="gray" size="sm" tt="none">{children}</Badge>;
}

interface AnalysisProps {
  reading: Reading;
  probe: string;
  onProbe: (value: string) => void;
  splitPrefix: number | string;
  onSplitPrefix: (value: number | string) => void;
}

interface ContainmentProps {
  block: Block;
  value: string;
  onChange: (value: string) => void;
}

interface SplitsProps {
  block: Block;
  prefix: number | string;
  onChange: (value: number | string) => void;
}
