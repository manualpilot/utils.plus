import { Badge, Box, Card, Group, NumberInput, SegmentedControl, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { type ReactNode, useState } from "react";
import { FactTable } from "../../common/fact-table";
import { useInitialHashState, useRegisterShareState } from "../../common/share-state";
import { UtilityTitle } from "../../common/utility-title";
import { type Block, blockOf, holdsBlock, hostsOf, lastOf, maskFor, roleOf, sizeOf, split, splitCount, wildcardFor } from "./blocks";
import { BITS, type Family, familyOf, prefixOf, readCidr, type Reading, withPrefix } from "./parse";
import { FAMILIES, FAMILY_OPTIONS, pickAddress, pickFamily, pickSplit, pickText, SPLIT_LIMIT } from "./settings";
import { classify, REACH_COLOUR, REACH_LABEL } from "./special";
import { embeddedIpv4, writeAddress, writeArpa, writeBinary, writeCidr, writeCount, writeExpanded, writeHex, writeInteger, writeValue } from "./write";

export default function IpAddress() {
  const initialState = useInitialHashState<{
    family?: string;
    address?: string;
    contains?: string;
    split?: number;
  }>();

  const initialFamily = pickFamily(initialState?.family);
  const [family, setFamily] = useState<Family>(initialFamily);
  const [text, setText] = useState(() => pickAddress(initialState?.address, initialFamily));
  const [probe, setProbe] = useState(() => pickText(initialState?.contains));
  const [splitPrefix, setSplitPrefix] = useState<number | string>(() => pickSplit(initialState?.split, initialFamily));

  useRegisterShareState(() => ({
    family,
    address: text,
    contains: probe || undefined,
    split: typeof splitPrefix === "number" ? splitPrefix : undefined,
  }));

  const result = readCidr(text, family);
  const error = result.kind === "error" ? result.message : undefined;

  const onText = (value: string) => {
    setText(value);
    const named = familyOf(value);
    if (named && named !== family) {
      setFamily(named);
      setProbe("");
      setSplitPrefix("");
    }
  };

  const onFamily = (value: string) => {
    const picked = pickFamily(value);
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
            value={family}
            onChange={onFamily}
            aria-label="Which address family"
            data={FAMILY_OPTIONS}
          />
        }
      >
        {FAMILIES[family].title}
      </UtilityTitle>

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
          </Group>
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

      <Containment block={block} value={probe} onChange={onProbe} />
      {prefix < BITS[family] && <Splits block={block} prefix={splitPrefix} onChange={onSplitPrefix} />}
    </>
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
