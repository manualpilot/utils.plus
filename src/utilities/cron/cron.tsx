import { ActionIcon, Autocomplete, Box, Card, CopyButton, Group, SegmentedControl, Select, Stack, Table, Text, TextInput, Title, Tooltip } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import { useInitialHashState, useRegisterShareState } from "../../common/share-state";
import { UtilityTitle } from "../../common/utility-title";
import { LOCAL_ZONE } from "../../common/zone-clock";
import { IconCheck, IconCopy } from "../../icons";
import { DEFAULT_EXPRESSIONS, FIELD_SETS, FLAVOUR_HINTS, FLAVOURS, HORIZON_YEARS, RUN_COUNT, type Zone } from "./fields";
import { collapseSpaces, pickExpression, pickFlavour, readCron } from "./parse";
import { presetExpression, PRESETS, refit } from "./presets";
import { nextRuns, runFormatter, untilPhrase } from "./schedule";

export default function Cron() {
  const initialState = useInitialHashState<{
    flavour?: string;
    expression?: string;
    zone?: string;
  }>();

  const initialFlavour = pickFlavour(initialState?.flavour);
  const [flavour, setFlavour] = useState(initialFlavour);
  const [expression, setExpression] = useState(() => pickExpression(initialState?.expression, initialFlavour));
  const [zone, setZone] = useState<Zone>(initialState?.zone === "local" ? "local" : "utc");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useRegisterShareState(() => ({ flavour, expression, zone }));

  const specs = FIELD_SETS[flavour];
  const reading = useMemo(() => readCron(expression, flavour), [expression, flavour]);

  const tick = Math.floor(now / 1000);
  const timeZone = zone === "utc" ? "UTC" : LOCAL_ZONE;
  const runs = useMemo(
    () => reading.schedule ? nextRuns(reading.schedule, tick * 1000, timeZone, RUN_COUNT) : [],
    [reading, tick, timeZone],
  );

  const preset = PRESETS.find((item) => presetExpression(item, flavour) === expression.trim());
  const rowError = reading.fieldErrors.some((error) => error !== null);

  const setToken = (index: number, value: string) => {
    const tokens = [...reading.tokens];
    while (tokens.length < index) tokens.push("*");
    tokens[index] = value.trim();
    setExpression(tokens.join(" ").trimEnd());
  };

  const handleFlavour = (value: string | null) => {
    const next = pickFlavour(value);
    setExpression(refit(expression, flavour, next));
    setFlavour(next);
  };

  return (
    <Stack gap="md">
      <UtilityTitle directory="cron">Cron</UtilityTitle>

      <Card withBorder shadow="sm" radius="md">
        <Stack>
          <Box className="settings-row">
            <Select
              label="Flavour"
              description={FLAVOUR_HINTS[flavour]}
              data={FLAVOURS}
              value={flavour}
              onChange={handleFlavour}
              allowDeselect={false}
            />
            <Select
              label="Preset"
              description="A schedule to start from"
              placeholder="Custom"
              data={PRESETS.map((item) => item.label)}
              value={preset?.label ?? null}
              onChange={(value) => {
                const chosen = PRESETS.find((item) => item.label === value);
                if (chosen) setExpression(presetExpression(chosen, flavour));
              }}
            />
          </Box>

          <Box className={reading.error ? "settings-row has-error" : "settings-row"} mb={reading.error ? "md" : 0}>
            <TextInput
              label="Expression"
              placeholder={DEFAULT_EXPRESSIONS[flavour]}
              value={expression}
              onChange={(event) => setExpression(collapseSpaces(event.currentTarget.value))}
              error={reading.error}
              spellCheck={false}
              autoCapitalize="off"
              classNames={{ root: "relative-root", error: "absolute-error" }}
              styles={{ input: { fontFamily: "monospace" } }}
              rightSection={
                <CopyButton value={expression} timeout={2000}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? "Copied" : "Copy"} withArrow position="left">
                      <ActionIcon
                        color={copied ? "teal" : "gray"}
                        variant="subtle"
                        onClick={copy}
                        aria-label="Copy expression"
                      >
                        {copied ? <IconCheck size="1.1rem" /> : <IconCopy size="1.1rem" />}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              }
            />
          </Box>

          <Box className={rowError ? "settings-row has-error" : "settings-row"} mb={rowError ? "md" : 0}>
            {specs.map((spec, index) => (
              <Autocomplete
                key={spec.key}
                label={spec.label}
                description={spec.hint}
                data={spec.suggestions}
                value={reading.tokens[index] ?? ""}
                onChange={(value) => setToken(index, value)}
                error={reading.fieldErrors[index]}
                spellCheck={false}
                autoCapitalize="off"
                classNames={{ root: "relative-root", error: "absolute-error" }}
                styles={{ input: { fontFamily: "monospace" } }}
              />
            ))}
          </Box>
        </Stack>
      </Card>

      {reading.description && (
        <Card withBorder shadow="sm" radius="md">
          <Group gap="sm" align="baseline">
            <Title order={4}>{reading.description}</Title>
            {reading.note && <Text size="sm" c="dimmed">{reading.note}</Text>}
          </Group>
        </Card>
      )}

      {reading.schedule && (
        <Card withBorder shadow="sm" radius="md">
          <Stack gap="xs">
            <Group justify="space-between" gap="sm" wrap="nowrap">
              <Group gap="sm" align="baseline">
                <Title order={4}>Next runs</Title>
                <Text size="sm" c="dimmed">{timeZone}</Text>
              </Group>
              <SegmentedControl
                size="xs"
                value={zone}
                onChange={(value) => setZone(value as Zone)}
                data={[{ value: "local", label: "Local" }, { value: "utc", label: "UTC" }]}
              />
            </Group>
            {runs.length === 0
              ? <Text size="sm" c="dimmed">Nothing in the next {HORIZON_YEARS} years matches this expression</Text>
              : (
                <Table verticalSpacing={6} horizontalSpacing="xs" withRowBorders={false}>
                  <Table.Tbody>
                    {runs.map((run) => (
                      <Table.Tr key={run}>
                        <Table.Td w="1%" style={{ whiteSpace: "nowrap" }}>
                          <Text size="sm" c="dimmed">{untilPhrase(run, tick * 1000)}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" ff="monospace" style={{ overflowWrap: "anywhere" }}>
                            {runFormatter(timeZone).format(run)}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
