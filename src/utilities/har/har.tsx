import { ActionIcon, Alert, Badge, Box, Button, Card, Code, Collapse, Group, Image, Progress, Select, Stack, Table, Tabs, Text, TextInput, Title, Tooltip, UnstyledButton } from "@mantine/core";
import { type ChangeEvent, type DragEvent, memo, type ReactNode, useCallback, useMemo, useState } from "react";
import { FactTable } from "../../common/fact-table";
import { useInitialHashState, useRegisterShareState } from "../../common/share-state";
import { UtilityTitle } from "../../common/utility-title";
import { IconChevronRight, IconPlus, IconTrash, IconUpload, IconX } from "../../icons";
import { MAX_BODY_CHARS, readShown } from "./body";
import { FIELD_OPTIONS, fieldOf } from "./fields";
import { blankCondition, comparatorOf, comparatorOptions, type Condition, conditionProblem, filterExchanges, readConditions, type SharedCondition, writeConditions } from "./filter";
import { type Archive, type Body, type Exchange, MAX_FILE_BYTES, message, type Pair, readArchive } from "./parse";
import { exchangeFacts, fileFacts, PHASE_COLOUR, recorderFacts, statusColour, writeMs, writeSize, writeStatus, writeTarget } from "./write";

export default function Har() {
  const initialState = useInitialHashState<{ conditions?: SharedCondition[] }>();

  const [conditions, setConditions] = useState<Condition[]>(() => readConditions(initialState?.conditions));
  const [archive, setArchive] = useState<Archive | null>(null);
  const [name, setName] = useState("");
  const [failure, setFailure] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set());

  useRegisterShareState(() => ({ conditions: writeConditions(conditions) }));

  const matched = useMemo(
    () => archive === null ? [] : filterExchanges(archive.exchanges, conditions),
    [archive, conditions],
  );

  const onTake = useCallback(async (file: File | null) => {
    if (!file) return;
    setFailure(null);
    if (file.size > MAX_FILE_BYTES) {
      setFailure(`That file is larger than the ${MAX_FILE_BYTES / 1024 / 1024} MB this reads.`);
      return;
    }
    setReading(true);
    try {
      const read = readArchive(await file.text());
      setArchive(read);
      setName(file.name || "recording.har");
      setOpen(new Set());
    } catch (error) {
      setArchive(null);
      setFailure(message(error));
    } finally {
      setReading(false);
    }
  }, []);

  const onClose = useCallback(() => {
    setArchive(null);
    setName("");
    setFailure(null);
    setOpen(new Set());
  }, []);

  const onToggle = useCallback((index: number) => {
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(index)) next.add(index);
      return next;
    });
  }, []);

  const onCondition = useCallback((key: number, change: Partial<Condition>) => {
    setConditions((current) =>
      current.map((condition) => condition.key === key ? { ...condition, ...change } : condition)
    );
  }, []);

  const onRemove = useCallback((key: number) => {
    setConditions((current) => {
      const left = current.filter((condition) => condition.key !== key);
      return left.length > 0 ? left : [blankCondition()];
    });
  }, []);

  const shown = matched.slice(0, MAX_SHOWN);
  const asked = conditions.some((condition) => condition.value.trim() !== "");

  return (
    <Stack gap="md">
      <UtilityTitle directory="har">HTTP Archive</UtilityTitle>

      {archive === null
        ? (
          <Card withBorder shadow="sm" radius="md">
            <Stack gap="sm">
              <Box
                component="label"
                className="file-dropzone"
                data-dragging={dragging || undefined}
                onDragOver={(event: DragEvent<HTMLLabelElement>) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={(event: DragEvent<HTMLLabelElement>) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
                }}
                onDrop={(event: DragEvent<HTMLLabelElement>) => {
                  event.preventDefault();
                  setDragging(false);
                  void onTake(event.dataTransfer.files.item(0));
                }}
              >
                <Stack align="center" gap={4}>
                  <IconUpload size="2rem" stroke={1.3} />
                  <Text size="sm">Click to choose a .har file, or drop one here</Text>
                  <Text size="xs" c="dimmed">
                    Nothing is uploaded — the recording is read in this tab and never leaves it
                  </Text>
                </Stack>
                <input
                  type="file"
                  hidden
                  accept=".har,application/json,application/har+json"
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    void onTake(event.currentTarget.files?.item(0) ?? null);
                    event.currentTarget.value = "";
                  }}
                />
              </Box>

              {reading && <Text size="sm" c="dimmed">Reading…</Text>}

              {failure && (
                <Alert color="red" icon={<IconX size="1rem" />} title="That file did not open">
                  {failure}
                </Alert>
              )}
            </Stack>
          </Card>
        )
        : (
          <Box className="card-columns">
            <Card withBorder shadow="sm" radius="md">
              <Stack gap="sm">
                <Group justify="space-between" wrap="nowrap" gap="sm">
                  <Title order={4}>File</Title>
                  <Tooltip label="Close this recording" withArrow position="left">
                    <ActionIcon variant="subtle" color="gray" onClick={onClose} aria-label="Close this recording">
                      <IconTrash size="1.1rem" />
                    </ActionIcon>
                  </Tooltip>
                </Group>
                <FactTable rows={fileFacts(archive, name)} />
              </Stack>
            </Card>
            <Card withBorder shadow="sm" radius="md">
              <Stack gap="sm">
                <Title order={4}>Recorder</Title>
                <FactTable rows={recorderFacts(archive)} />
              </Stack>
            </Card>
          </Box>
        )}

      {archive !== null && (
        <Card withBorder shadow="sm" radius="md">
          <Stack gap="sm">
            <Group justify="space-between" wrap="nowrap" gap="sm">
              <Title order={4}>Filter</Title>
              <Button
                variant="light"
                size="compact-sm"
                leftSection={<IconPlus size="0.9rem" />}
                onClick={() => setConditions((current) => [...current, blankCondition()])}
              >
                Add condition
              </Button>
            </Group>

            {conditions.map((condition, at) => (
              <ConditionRow
                key={condition.key}
                condition={condition}
                first={at === 0}
                onChange={onCondition}
                onRemove={onRemove}
              />
            ))}

            <Text size="sm" c="dimmed" data-har-count>
              {asked
                ? `${matched.length} of ${archive.exchanges.length} requests match`
                : `${archive.exchanges.length} requests`}
              {matched.length > shown.length && `, showing the first ${MAX_SHOWN}`}
            </Text>
          </Stack>
        </Card>
      )}

      {shown.map((exchange) => (
        <ExchangeCard
          key={exchange.index}
          exchange={exchange}
          from={archive?.startedAt ?? null}
          open={open.has(exchange.index)}
          onToggle={onToggle}
        />
      ))}

      {archive !== null && matched.length === 0 && (
        <Card withBorder shadow="sm" radius="md">
          <Text size="sm" c="dimmed">
            {archive.exchanges.length === 0
              ? "That recording holds no requests."
              : "No request matches every condition above."}
          </Text>
        </Card>
      )}
    </Stack>
  );
}

const MAX_SHOWN = 200;

function ConditionRow({ condition, first, onChange, onRemove }: ConditionRowProps) {
  const field = fieldOf(condition.field);
  const comparator = comparatorOf(condition.comparator, field.kind);
  const problem = conditionProblem(condition);

  const onField = (value: string | null) => {
    const picked = fieldOf(value ?? undefined);
    onChange(condition.key, {
      field: picked.id,
      comparator: comparatorOf(condition.comparator, picked.kind).id,
    });
  };

  return (
    <Group align="flex-end" wrap="nowrap" gap="sm" mb={problem ? "md" : 0} data-har-condition>
      <Box className={problem ? "settings-row has-error" : "settings-row"} style={{ flex: 1, minWidth: 0 }}>
        <Select
          label={first ? "Field" : undefined}
          aria-label="Field"
          data={FIELD_OPTIONS}
          value={field.id}
          onChange={onField}
          searchable
          allowDeselect={false}
          comboboxProps={{ withinPortal: true }}
        />
        <Select
          label={first ? "Comparator" : undefined}
          aria-label="Comparator"
          data={comparatorOptions(field.kind)}
          value={comparator.id}
          onChange={(value) => onChange(condition.key, { comparator: comparatorOf(value ?? undefined, field.kind).id })}
          allowDeselect={false}
          comboboxProps={{ withinPortal: true }}
        />
        <TextInput
          label={first ? "Value" : undefined}
          aria-label="Value"
          placeholder={field.unit === "bytes" ? "bytes" : field.unit === "ms" ? "milliseconds" : "Anything to look for"}
          value={condition.value}
          onChange={(event) => onChange(condition.key, { value: event.currentTarget.value })}
          error={problem || undefined}
          classNames={{ root: "relative-root", error: "absolute-error" }}
          spellCheck={false}
          autoCapitalize="off"
        />
      </Box>
      <Tooltip label="Remove this condition" withArrow position="left">
        <ActionIcon
          variant="subtle"
          color="gray"
          size="lg"
          onClick={() => onRemove(condition.key)}
          aria-label="Remove this condition"
        >
          <IconX size="1.1rem" />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}

interface ConditionRowProps {
  condition: Condition;
  first: boolean;
  onChange: (key: number, change: Partial<Condition>) => void;
  onRemove: (key: number) => void;
}

const ExchangeCard = memo(function ExchangeCard({ exchange, from, open, onToggle }: ExchangeCardProps) {
  return (
    <Card withBorder shadow="sm" radius="md" p="sm" data-har-entry={exchange.index}>
      <UnstyledButton
        onClick={() => onToggle(exchange.index)}
        aria-expanded={open}
        aria-label={`${open ? "Close" : "Open"} ${exchange.method} ${exchange.url}`}
        w="100%"
      >
        <Group gap="xs" wrap="nowrap" align="center">
          <IconChevronRight className="panel-chevron" data-open={open || undefined} size="1.1rem" />
          <Badge
            variant="light"
            color={statusColour(exchange.status)}
            size="sm"
            tt="none"
            miw={44}
            data-har-status
          >
            {writeStatus(exchange)}
          </Badge>
          <Text size="sm" ff="monospace" fw={600} miw={40} data-har-method>{exchange.method}</Text>
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Text size="sm" truncate="end" data-har-target>{writeTarget(exchange)}</Text>
            {exchange.host && <Text size="xs" c="dimmed" truncate="end">{exchange.host}</Text>}
          </Box>
          <Group gap="sm" wrap="nowrap" className="har-meta">
            <Text size="xs" c="dimmed">{exchange.resourceType}</Text>
            <Text size="xs" c="dimmed">{writeSize(exchange.transferSize)}</Text>
            <Text size="xs" c="dimmed">{writeMs(exchange.time)}</Text>
          </Group>
        </Group>
      </UnstyledButton>

      <Collapse expanded={open} keepMounted={false}>
        <Details exchange={exchange} from={from} />
      </Collapse>
    </Card>
  );
});

interface ExchangeCardProps {
  exchange: Exchange;
  from: number | null;
  open: boolean;
  onToggle: (index: number) => void;
}

function Details({ exchange, from }: { exchange: Exchange; from: number | null }) {
  return (
    <Tabs defaultValue="overview" mt="sm" keepMounted={false}>
      <Tabs.List>
        <Tabs.Tab value="overview">Overview</Tabs.Tab>
        <Tabs.Tab value="request">Request</Tabs.Tab>
        <Tabs.Tab value="response">Response</Tabs.Tab>
        <Tabs.Tab value="timings">Timings</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="overview" pt="sm">
        <FactTable rows={exchangeFacts(exchange, from)} />
      </Tabs.Panel>

      <Tabs.Panel value="request" pt="sm">
        <Stack gap="md">
          <Section title="Query string">
            <PairTable pairs={exchange.queryParams} />
          </Section>
          <Section title="Headers">
            <PairTable pairs={exchange.requestHeaders} />
          </Section>
          <Section title="Cookies">
            <PairTable pairs={exchange.requestCookies} />
          </Section>
          <Section title="Body">
            <BodyPanel body={exchange.requestBody} />
          </Section>
        </Stack>
      </Tabs.Panel>

      <Tabs.Panel value="response" pt="sm">
        <Stack gap="md">
          <Section title="Headers">
            <PairTable pairs={exchange.responseHeaders} />
          </Section>
          <Section title="Cookies">
            <PairTable pairs={exchange.responseCookies} />
          </Section>
          <Section title="Body">
            <BodyPanel body={exchange.responseBody} />
          </Section>
        </Stack>
      </Tabs.Panel>

      <Tabs.Panel value="timings" pt="sm">
        <Timings exchange={exchange} />
      </Tabs.Panel>
    </Tabs>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack gap={4}>
      <Title order={6} c="dimmed">{title}</Title>
      {children}
    </Stack>
  );
}

function PairTable({ pairs }: { pairs: Pair[] }) {
  if (pairs.length === 0) return <Text size="sm" c="dimmed">None recorded</Text>;
  return (
    <Table verticalSpacing={4} horizontalSpacing="xs" withRowBorders={false} data-har-pairs>
      <Table.Tbody>
        {pairs.map((pair, at) => (
          <Table.Tr key={`${pair.name}-${at}`}>
            <Table.Td w="1%" style={{ whiteSpace: "nowrap", verticalAlign: "top" }}>
              <Text size="xs" c="dimmed" ff="monospace">{pair.name}</Text>
            </Table.Td>
            <Table.Td>
              <Text size="xs" ff="monospace" style={{ overflowWrap: "anywhere" }}>{pair.value}</Text>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

function BodyPanel({ body }: { body: Body | null }) {
  const shown = readShown(body);
  if (!body || !shown) return <Text size="sm" c="dimmed">None recorded</Text>;

  return (
    <Stack gap={4}>
      {body.params.length > 0 && <PairTable pairs={body.params} />}
      {shown.image && <Image src={shown.image} alt="The response body" fit="contain" className="har-image" />}
      {shown.note && <Text size="sm" c="dimmed">{shown.note}</Text>}
      {shown.text && <Code block className="har-body">{shown.text}</Code>}
      {shown.truncated && (
        <Text size="xs" c="dimmed">
          The first {MAX_BODY_CHARS.toLocaleString()} characters, which is where this stops reading one.
        </Text>
      )}
      {shown.pretty && <Text size="xs" c="dimmed">Indented here; the recording holds it as it was served.</Text>}
    </Stack>
  );
}

function Timings({ exchange }: { exchange: Exchange }) {
  const measured = exchange.phases;
  if (measured.length === 0) return <Text size="sm" c="dimmed">No phase of this request was measured.</Text>;

  const total = measured.reduce((sum, phase) => sum + phase.ms, 0);
  return (
    <Stack gap="sm">
      <Progress.Root size="xl" radius="sm" data-har-timings>
        {measured.map((phase) => (
          <Tooltip key={phase.name} label={`${phase.name} — ${writeMs(phase.ms)}`} withArrow>
            <Progress.Section value={(phase.ms / total) * 100} color={PHASE_COLOUR[phase.name]} />
          </Tooltip>
        ))}
      </Progress.Root>
      <Table verticalSpacing={4} horizontalSpacing="xs" withRowBorders={false}>
        <Table.Tbody>
          {measured.map((phase) => (
            <Table.Tr key={phase.name} data-har-phase={phase.name}>
              <Table.Td w={84}>
                <Badge fullWidth variant="light" color={PHASE_COLOUR[phase.name]} size="xs" tt="none">
                  {phase.name}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Text size="sm" ff="monospace">{writeMs(phase.ms)}</Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <Text size="xs" c="dimmed">
        {writeMs(total)} measured{exchange.time !== null && `, ${writeMs(exchange.time)} recorded in all`}
      </Text>
    </Stack>
  );
}
