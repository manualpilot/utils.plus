import { ActionIcon, Autocomplete, Box, Card, CopyButton, Group, SegmentedControl, Select, Stack, Table, Text, TextInput, Title, Tooltip } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import { useInitialHashState, useRegisterShareState } from "../common/share-state";
import { UtilityTitle } from "../common/utility-title";
import { formatterFor, LOCAL_ZONE, type WallClock, wallKey, zoneClock, zoneInstant } from "../common/zone-clock";
import { IconCheck, IconCopy } from "../icons";

export default function Cron() {
  const initialState = useInitialHashState<{
    flavour?: string;
    expression?: string;
    zone?: string;
  }>();

  const initialFlavour = pickFlavour(initialState?.flavour);
  const [flavour, setFlavour] = useState(initialFlavour);
  const [expression, setExpression] = useState(() => pickExpression(initialState?.expression, initialFlavour));
  const [zone, setZone] = useState<Zone>(initialState?.zone === "utc" ? "utc" : "local");
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
      <UtilityTitle file="cron.tsx">Cron</UtilityTitle>

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

export type Flavour = "unix" | "seconds" | "quartz";

type Zone = "local" | "utc";

const RUN_COUNT = 6;
const HORIZON_YEARS = 100;
const SEARCH_LIMIT = 20000;

const FLAVOURS = [
  { value: "unix", label: "Unix (5 fields)" },
  { value: "seconds", label: "Seconds (6 fields)" },
  { value: "quartz", label: "Quartz (6 or 7 fields)" },
];

const FLAVOUR_HINTS: Record<Flavour, string> = {
  unix: "crontab, where Sunday is 0 and 7",
  seconds: "crontab with a second in front",
  quartz: "Sunday is 1, and ? L W # are on offer",
};

const FLAVOUR_NAMES: Record<Flavour, string> = {
  unix: "Unix cron",
  seconds: "Cron with seconds",
  quartz: "Quartz",
};

const DEFAULT_EXPRESSIONS: Record<Flavour, string> = {
  unix: "0 9 * * MON-FRI",
  seconds: "0 0 9 * * MON-FRI",
  quartz: "0 0 9 ? * MON-FRI",
};

const MACROS: Record<string, string> = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
};

const MONTH_NAMES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const MONTH_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface FieldSpec {
  key: "second" | "minute" | "hour" | "dom" | "month" | "dow" | "year";
  label: string;
  noun: string;
  plural: string;
  min: number;
  max: number;
  names?: readonly string[];
  fullNames?: readonly string[];
  weekday?: boolean;
  calendar?: boolean;
  optional?: boolean;
  hint: string;
  suggestions: string[];
}

const SECOND_FIELD: FieldSpec = {
  key: "second",
  label: "Second",
  noun: "second",
  plural: "seconds",
  min: 0,
  max: 59,
  hint: "0-59",
  suggestions: ["*", "0", "*/5", "*/10", "*/15", "*/30"],
};

const MINUTE_FIELD: FieldSpec = {
  key: "minute",
  label: "Minute",
  noun: "minute",
  plural: "minutes",
  min: 0,
  max: 59,
  hint: "0-59",
  suggestions: ["*", "0", "*/5", "*/10", "*/15", "*/30", "0,30"],
};

const HOUR_FIELD: FieldSpec = {
  key: "hour",
  label: "Hour",
  noun: "hour",
  plural: "hours",
  min: 0,
  max: 23,
  hint: "0-23",
  suggestions: ["*", "0", "9", "12", "*/2", "*/6", "9-17"],
};

const DOM_FIELD: FieldSpec = {
  key: "dom",
  label: "Day of month",
  noun: "day-of-month",
  plural: "day-of-month",
  min: 1,
  max: 31,
  calendar: true,
  hint: "1-31",
  suggestions: ["*", "1", "15", "1,15", "*/2"],
};

const MONTH_FIELD: FieldSpec = {
  key: "month",
  label: "Month",
  noun: "month",
  plural: "months",
  min: 1,
  max: 12,
  names: MONTH_NAMES,
  fullNames: MONTH_FULL,
  calendar: true,
  hint: "1-12 or JAN-DEC",
  suggestions: ["*", "1", "*/3", "JAN", "JAN-MAR", "JAN,APR,JUL,OCT"],
};

const DOW_FIELD: FieldSpec = {
  key: "dow",
  label: "Day of week",
  noun: "day-of-week",
  plural: "day-of-week",
  min: 0,
  max: 7,
  names: DAY_NAMES,
  fullNames: DAY_FULL,
  weekday: true,
  calendar: true,
  hint: "0-7 or SUN-SAT",
  suggestions: ["*", "MON-FRI", "SAT,SUN", "MON", "1-5", "0,6"],
};

const YEAR_FIELD: FieldSpec = {
  key: "year",
  label: "Year",
  noun: "year",
  plural: "years",
  min: 1970,
  max: 2099,
  calendar: true,
  optional: true,
  hint: "1970-2099, optional",
  suggestions: ["*", "2026", "2026-2030"],
};

const QUARTZ_DOM_FIELD: FieldSpec = {
  ...DOM_FIELD,
  hint: "1-31, L or W",
  suggestions: ["?", "*", "1", "15", "1,15", "L", "LW", "15W", "L-3"],
};

const QUARTZ_DOW_FIELD: FieldSpec = {
  ...DOW_FIELD,
  min: 1,
  max: 7,
  hint: "1-7, SUN-SAT, L, #",
  suggestions: ["?", "*", "MON-FRI", "SAT,SUN", "MON", "FRI#3", "FRIL"],
};

const FIELD_SETS: Record<Flavour, FieldSpec[]> = {
  unix: [MINUTE_FIELD, HOUR_FIELD, DOM_FIELD, MONTH_FIELD, DOW_FIELD],
  seconds: [SECOND_FIELD, MINUTE_FIELD, HOUR_FIELD, DOM_FIELD, MONTH_FIELD, DOW_FIELD],
  quartz: [SECOND_FIELD, MINUTE_FIELD, HOUR_FIELD, QUARTZ_DOM_FIELD, MONTH_FIELD, QUARTZ_DOW_FIELD, YEAR_FIELD],
};

type Term =
  | { kind: "all" }
  | { kind: "value"; value: number }
  | { kind: "range"; from: number; to: number }
  | { kind: "step"; from: number; to: number; step: number; whole: boolean }
  | { kind: "last-day"; offset: number }
  | { kind: "last-weekday" }
  | { kind: "nearest-weekday"; day: number }
  | { kind: "last-dow"; day: number }
  | { kind: "nth-dow"; day: number; nth: number };

export interface ParsedField {
  spec: FieldSpec;
  text: string;
  terms: Term[];
  values: number[];
  specials: Term[];
  open: boolean;
}

export interface Schedule {
  second: ParsedField | null;
  minute: ParsedField;
  hour: ParsedField;
  dom: ParsedField;
  month: ParsedField;
  dow: ParsedField;
  year: ParsedField | null;
  orDays: boolean;
}

export interface CronReading {
  tokens: string[];
  fieldErrors: (string | null)[];
  error: string | null;
  schedule: Schedule | null;
  description: string;
  note: string;
  startup: boolean;
}

export function readCron(text: string, flavour: Flavour): CronReading {
  const trimmed = text.trimEnd();
  if (!trimmed.trim()) return blankReading(flavour);
  if (trimmed.startsWith("@")) return readMacro(trimmed, flavour);
  return readTokens(splitTokens(trimmed), flavour, "");
}

function blankReading(flavour: Flavour): CronReading {
  return {
    tokens: [],
    fieldErrors: FIELD_SETS[flavour].map(() => null),
    error: null,
    schedule: null,
    description: "",
    note: "",
    startup: false,
  };
}

function readMacro(text: string, flavour: Flavour): CronReading {
  const name = text.toLowerCase();
  const blank = blankReading(flavour);
  if (flavour === "quartz") return { ...blank, error: "Quartz has no @ shorthands" };
  if (name === "@reboot") {
    return { ...blank, description: "When cron starts", note: "@reboot has no clock of its own", startup: true };
  }
  const expansion = MACROS[name];
  if (!expansion) return { ...blank, error: `No shorthand is spelled ${text}` };
  const full = flavour === "unix" ? expansion : `0 ${expansion}`;
  return readTokens(splitTokens(full), flavour, `the same as ${full}`);
}

function readTokens(tokens: string[], flavour: Flavour, note: string): CronReading {
  const specs = FIELD_SETS[flavour];
  const fields: (ParsedField | null)[] = [];
  const fieldErrors: (string | null)[] = [];

  for (let index = 0; index < specs.length; index++) {
    const token = tokens[index] ?? "";
    if (token === "") {
      fields.push(null);
      fieldErrors.push(null);
      continue;
    }
    const result = parseField(token, specs[index], flavour);
    fields.push(result.field ?? null);
    fieldErrors.push(result.error ?? null);
  }

  const filled = tokens.filter((token) => token !== "").length;
  const required = specs.filter((spec) => !spec.optional).length;
  const gap = specs.findIndex((spec, index) => !spec.optional && (tokens[index] ?? "") === "");

  let error: string | null = null;
  if (filled < required || filled > specs.length) {
    error = `${FLAVOUR_NAMES[flavour]} takes ${fieldCount(required, specs.length)}; this has ${filled}`;
  } else if (gap !== -1) {
    error = `${specs[gap].label} is empty`;
  } else if (flavour === "quartz") {
    error = quartzDayProblem(tokens);
  }

  const settled = error === null && fieldErrors.every((field) => field === null);
  const schedule = settled ? buildSchedule(fields as ParsedField[], specs) : null;

  return {
    tokens,
    fieldErrors,
    error,
    schedule,
    description: schedule ? describeSchedule(schedule) : "",
    note: schedule ? note : "",
    startup: false,
  };
}

function fieldCount(required: number, total: number): string {
  return required === total ? `${required} fields` : `${required} or ${total} fields`;
}

function quartzDayProblem(tokens: string[]): string | null {
  const dom = tokens[3] === "?";
  const dow = tokens[5] === "?";
  if (dom && dow) return "Only one day field takes ?, the other needs a value";
  if (!dom && !dow) return "Quartz wants ? in day of month or day of week";
  return null;
}

function buildSchedule(fields: ParsedField[], specs: FieldSpec[]): Schedule {
  const byKey = new Map(specs.map((spec, index) => [spec.key, fields[index]]));
  const dom = byKey.get("dom")!;
  const dow = byKey.get("dow")!;
  return {
    second: byKey.get("second") ?? null,
    minute: byKey.get("minute")!,
    hour: byKey.get("hour")!,
    dom,
    month: byKey.get("month")!,
    dow,
    year: byKey.get("year") ?? null,
    orDays: !dom.open && !dow.open,
  };
}

interface FieldResult {
  field?: ParsedField;
  error?: string;
}

function parseField(text: string, spec: FieldSpec, flavour: Flavour): FieldResult {
  const quartz = flavour === "quartz";

  if (text === "?") {
    if (!quartz) return { error: "? needs the Quartz flavour" };
    if (spec.key !== "dom" && spec.key !== "dow") return { error: "? belongs to a day field" };
    return { field: openField(spec, text) };
  }

  const terms: Term[] = [];
  const specials: Term[] = [];
  const values = new Set<number>();

  for (const piece of text.split(",")) {
    const result = parsePiece(piece, spec, quartz);
    if (result.error !== undefined) return { error: result.error };
    terms.push(result.term!);
    if (result.values) { for (const value of result.values) values.add(value); }
    else specials.push(result.term!);
  }

  return {
    field: {
      spec,
      text,
      terms,
      values: [...values].sort((left, right) => left - right),
      specials,
      open: text.startsWith("*"),
    },
  };
}

function openField(spec: FieldSpec, text: string): ParsedField {
  return {
    spec,
    text,
    terms: [{ kind: "all" }],
    values: expand(spec, spec.min, spec.max, 1, false),
    specials: [],
    open: true,
  };
}

interface PieceResult {
  term?: Term;
  values?: number[];
  error?: string;
}

function parsePiece(piece: string, spec: FieldSpec, quartz: boolean): PieceResult {
  if (piece === "") return { error: `${spec.label} has a gap in its list` };

  const special = quartz ? parseSpecial(piece, spec) : refuseSpecial(piece, spec);
  if (special) return special;

  const slash = piece.indexOf("/");
  const base = slash === -1 ? piece : piece.slice(0, slash);
  let step = 1;
  if (slash !== -1) {
    const text = piece.slice(slash + 1);
    if (!/^\d+$/.test(text) || Number(text) < 1) return { error: "A step is a whole number, 1 or more" };
    step = Number(text);
  }

  if (base === "*") {
    const term: Term = step === 1
      ? { kind: "all" }
      : { kind: "step", from: spec.min, to: spec.max, step, whole: true };
    return { term, values: expand(spec, spec.min, spec.max, step, false) };
  }

  const dash = base.indexOf("-");
  if (dash > 0) {
    const from = readValue(base.slice(0, dash), spec);
    if (typeof from === "string") return { error: from };
    const to = readValue(base.slice(dash + 1), spec);
    if (typeof to === "string") return { error: to };
    const wrap = from > to;
    if (wrap && !(quartz && (spec.key === "month" || spec.key === "dow"))) {
      return { error: `${spec.label} ranges run upwards` };
    }
    const term: Term = step === 1
      ? { kind: "range", from, to }
      : { kind: "step", from, to, step, whole: from === spec.min && to === spec.max };
    return { term, values: expand(spec, from, to, step, wrap) };
  }

  const value = readValue(base, spec);
  if (typeof value === "string") return { error: value };
  if (slash === -1) return { term: { kind: "value", value }, values: [normalise(spec, value)] };
  return {
    term: { kind: "step", from: value, to: spec.max, step, whole: false },
    values: expand(spec, value, spec.max, step, false),
  };
}

function readValue(text: string, spec: FieldSpec): number | string {
  if (spec.names) {
    const index = spec.names.indexOf(text.toUpperCase());
    if (index !== -1) return spec.min + index;
  }
  if (!/^\d+$/.test(text)) {
    return spec.names
      ? `${spec.label} takes ${range(spec)} or a name`
      : `${spec.label} takes ${range(spec)}`;
  }
  const value = Number(text);
  if (value < spec.min || value > spec.max) return `${spec.label} takes ${range(spec)}`;
  return value;
}

function range(spec: FieldSpec): string {
  return `${spec.min} through ${spec.max}`;
}

function parseSpecial(piece: string, spec: FieldSpec): PieceResult | null {
  const text = piece.toUpperCase();

  if (spec.key === "dom") {
    if (text === "L") return { term: { kind: "last-day", offset: 0 } };
    if (text === "LW") return { term: { kind: "last-weekday" } };
    const before = /^L-(\d+)$/.exec(text);
    if (before) {
      const offset = Number(before[1]);
      if (offset > 30) return { error: "L counts back at most 30 days" };
      return { term: { kind: "last-day", offset } };
    }
    const nearest = /^(\d+)W$/.exec(text);
    if (nearest) {
      const day = readValue(nearest[1], spec);
      if (typeof day === "string") return { error: day };
      return { term: { kind: "nearest-weekday", day } };
    }
  }

  if (spec.key === "dow") {
    if (text === "L") return { term: { kind: "value", value: spec.max }, values: [normalise(spec, spec.max)] };
    const last = /^(.+)L$/.exec(text);
    if (last) {
      const day = readValue(last[1], spec);
      if (typeof day === "string") return { error: day };
      return { term: { kind: "last-dow", day } };
    }
    const nth = /^(.+)#(\d+)$/.exec(text);
    if (nth) {
      const day = readValue(nth[1], spec);
      if (typeof day === "string") return { error: day };
      const count = Number(nth[2]);
      if (count < 1 || count > 5) return { error: "# counts a week from 1 to 5" };
      return { term: { kind: "nth-dow", day, nth: count } };
    }
  }

  return null;
}

function refuseSpecial(piece: string, spec: FieldSpec): PieceResult | null {
  if (piece.includes("#")) return { error: "# needs the Quartz flavour" };
  if (spec.key === "dom" && /^(L|LW|L-\d+|\d+W)$/i.test(piece)) return { error: "L and W need the Quartz flavour" };
  if (spec.key === "dow" && /L$/i.test(piece)) return { error: "L needs the Quartz flavour" };
  return null;
}

function expand(spec: FieldSpec, from: number, to: number, step: number, wrap: boolean): number[] {
  const cycle = spec.max - spec.min + 1;
  const span = wrap ? to - from + cycle : to - from;
  const values: number[] = [];
  for (let offset = 0; offset <= span; offset += step) {
    values.push(normalise(spec, spec.min + ((from - spec.min + offset) % cycle)));
  }
  return values;
}

function normalise(spec: FieldSpec, value: number): number {
  return spec.weekday ? (value - spec.min) % 7 : value;
}

export function nextRuns(schedule: Schedule, fromMs: number, zone: string, count: number): number[] {
  const runs: number[] = [];
  let after = fromMs;
  for (let index = 0; index < count; index++) {
    const next = nextRun(schedule, after, zone);
    if (next === null) break;
    runs.push(next);
    after = next;
  }
  return runs;
}

function nextRun(schedule: Schedule, afterMs: number, zone: string): number | null {
  const seconds = schedule.second ? schedule.second.values : [0];
  let wall: WallClock = zoneClock(new Date(Math.floor(afterMs / 1000) * 1000 + 1000), zone);
  const lastYear = wall.year + HORIZON_YEARS;

  for (let guard = 0; guard < SEARCH_LIMIT; guard++) {
    if (wall.year > lastYear) return null;

    if (schedule.year && !schedule.year.values.includes(wall.year)) {
      const year = nextValue(schedule.year.values, wall.year);
      if (year === null) return null;
      wall = { year, month: 1, day: 1, hour: 0, minute: 0, second: 0 };
      continue;
    }

    if (!schedule.month.values.includes(wall.month)) {
      const month = nextValue(schedule.month.values, wall.month);
      wall = month === null
        ? { year: wall.year + 1, month: 1, day: 1, hour: 0, minute: 0, second: 0 }
        : { ...wall, month, day: 1, hour: 0, minute: 0, second: 0 };
      continue;
    }

    if (!dayMatches(schedule, wall)) {
      wall = nextDayStart(wall);
      continue;
    }

    if (!schedule.hour.values.includes(wall.hour)) {
      const hour = nextValue(schedule.hour.values, wall.hour);
      wall = hour === null ? nextDayStart(wall) : { ...wall, hour, minute: 0, second: 0 };
      continue;
    }

    if (!schedule.minute.values.includes(wall.minute)) {
      const minute = nextValue(schedule.minute.values, wall.minute);
      wall = minute === null ? nextHourStart(wall) : { ...wall, minute, second: 0 };
      continue;
    }

    if (!seconds.includes(wall.second)) {
      const second = nextValue(seconds, wall.second);
      wall = second === null ? nextMinuteStart(wall) : { ...wall, second };
      continue;
    }

    const ms = zoneInstant(wall, zone);
    const landed = zoneClock(new Date(ms), zone);
    if (wallKey(landed) !== wallKey(wall)) {
      wall = landed;
      continue;
    }
    return ms;
  }

  return null;
}

function dayMatches(schedule: Schedule, wall: WallClock): boolean {
  const weekday = weekdayOf(wall.year, wall.month, wall.day);
  const dom = dayFieldHits(schedule.dom, wall, weekday);
  const dow = dayFieldHits(schedule.dow, wall, weekday);
  return schedule.orDays ? dom || dow : dom && dow;
}

function dayFieldHits(field: ParsedField, wall: WallClock, weekday: number): boolean {
  const value = field.spec.key === "dom" ? wall.day : weekday;
  if (field.values.includes(value)) return true;
  return field.specials.some((term) => specialHits(term, field.spec, wall, weekday));
}

function specialHits(term: Term, spec: FieldSpec, wall: WallClock, weekday: number): boolean {
  switch (term.kind) {
    case "last-day":
      return wall.day === lastDayOf(wall.year, wall.month) - term.offset;
    case "last-weekday":
      return wall.day === lastWeekdayOf(wall.year, wall.month);
    case "nearest-weekday":
      return wall.day === nearestWeekdayTo(wall.year, wall.month, term.day);
    case "last-dow":
      return weekday === normalise(spec, term.day) && wall.day > lastDayOf(wall.year, wall.month) - 7;
    case "nth-dow":
      return weekday === normalise(spec, term.day) && Math.ceil(wall.day / 7) === term.nth;
    default:
      return false;
  }
}

function lastDayOf(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function weekdayOf(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function lastWeekdayOf(year: number, month: number): number {
  let day = lastDayOf(year, month);
  while (isWeekend(weekdayOf(year, month, day))) day--;
  return day;
}

function nearestWeekdayTo(year: number, month: number, day: number): number {
  const last = lastDayOf(year, month);
  if (day > last) return -1;
  const weekday = weekdayOf(year, month, day);
  if (weekday === 6) return day > 1 ? day - 1 : day + 2;
  if (weekday === 0) return day < last ? day + 1 : day - 2;
  return day;
}

function isWeekend(weekday: number): boolean {
  return weekday === 0 || weekday === 6;
}

function nextValue(values: number[], from: number): number | null {
  for (const value of values) {
    if (value >= from) return value;
  }
  return null;
}

function nextDayStart(wall: WallClock): WallClock {
  const date = new Date(Date.UTC(wall.year, wall.month - 1, wall.day + 1));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: 0,
    minute: 0,
    second: 0,
  };
}

function nextHourStart(wall: WallClock): WallClock {
  return wall.hour >= 23 ? nextDayStart(wall) : { ...wall, hour: wall.hour + 1, minute: 0, second: 0 };
}

function nextMinuteStart(wall: WallClock): WallClock {
  return wall.minute >= 59 ? nextHourStart(wall) : { ...wall, minute: wall.minute + 1, second: 0 };
}

export function describeSchedule(schedule: Schedule): string {
  const parts = [describeTime(schedule)];

  const days = describeDays(schedule);
  if (days) parts.push(days);

  const months = saysNothing(schedule.month) ? "" : listPhrase(schedule.month);
  const years = schedule.year && !saysNothing(schedule.year) ? listPhrase(schedule.year) : "";
  if (months && years) parts.push(`in ${months} of ${years}`);
  else if (months) parts.push(`in ${months}`);
  else if (years) parts.push(`in ${years}`);

  return parts.join(" ");
}

function describeTime(schedule: Schedule): string {
  const { second, minute, hour } = schedule;

  if (pinned(hour) && pinned(minute) && (!second || pinned(second))) {
    const seconds = second ? second.values[0] : 0;
    const clock = `${pad(hour.values[0])}:${pad(minute.values[0])}`;
    return `At ${seconds ? `${clock}:${pad(seconds)}` : clock}`;
  }

  const clauses: { text: string; every: boolean }[] = [];
  if (second && !(pinned(second) && second.values[0] === 0)) clauses.push(unitClause(second));
  clauses.push(unitClause(minute), unitClause(hour));
  while (clauses.length > 1 && clauses[clauses.length - 1].every) clauses.pop();

  const text = clauses.map((clause) => clause.text).join(" past ");
  return text.startsWith("every") ? capitalise(text) : `At ${text}`;
}

function unitClause(field: ParsedField): { text: string; every: boolean } {
  const only = field.terms.length === 1 ? field.terms[0] : null;
  if (only?.kind === "all") return { text: `every ${field.spec.noun}`, every: true };
  if (only?.kind === "step") return { text: termPhrase(only, field.spec), every: false };
  const noun = field.values.length > 1 ? field.spec.plural : field.spec.noun;
  return { text: `${noun} ${listPhrase(field)}`, every: false };
}

function describeDays(schedule: Schedule): string {
  const dom = dayPhrase(schedule.dom);
  const dow = dayPhrase(schedule.dow);
  if (dom && dow) return `on ${dom} ${schedule.orDays ? "or" : "and"} ${dow}`;
  return dom || dow ? `on ${dom || dow}` : "";
}

function dayPhrase(field: ParsedField): string {
  if (saysNothing(field)) return "";
  const plain = field.terms.filter((term) => !field.specials.includes(term));
  const phrases: string[] = [];

  if (plain.length > 0) {
    const stepped = plain.length === 1 && plain[0].kind === "step";
    const list = joinWords(plain.map((term) => termPhrase(term, field.spec)));
    phrases.push(field.spec.key === "dom" && !stepped ? `${field.spec.noun} ${list}` : list);
  }
  for (const term of field.specials) phrases.push(termPhrase(term, field.spec));

  return joinWords(phrases);
}

function saysNothing(field: ParsedField): boolean {
  return field.terms.length === 1 && field.terms[0].kind === "all";
}

function listPhrase(field: ParsedField): string {
  return joinWords(field.terms.map((term) => termPhrase(term, field.spec)));
}

function termPhrase(term: Term, spec: FieldSpec): string {
  switch (term.kind) {
    case "all":
      return `every ${spec.noun}`;
    case "value":
      return formatValue(spec, term.value);
    case "range":
      return `${formatValue(spec, term.from)} through ${formatValue(spec, term.to)}`;
    case "step": {
      const every = spec.calendar ? `every ${ordinal(term.step)} ${spec.noun}` : `every ${term.step} ${spec.plural}`;
      if (term.whole) return every;
      return `${every} from ${formatValue(spec, term.from)} through ${formatValue(spec, term.to)}`;
    }
    case "last-day":
      return term.offset === 0
        ? "the last day of the month"
        : `the ${ordinal(term.offset + 1)}-to-last day of the month`;
    case "last-weekday":
      return "the last weekday of the month";
    case "nearest-weekday":
      return `the weekday nearest the ${ordinal(term.day)}`;
    case "last-dow":
      return `the last ${formatValue(spec, term.day)} of the month`;
    case "nth-dow":
      return `the ${NTH_WORDS[term.nth]} ${formatValue(spec, term.day)} of the month`;
  }
}

function formatValue(spec: FieldSpec, value: number): string {
  if (!spec.fullNames) return String(value);
  return spec.fullNames[spec.weekday ? normalise(spec, value) : value - spec.min];
}

function pinned(field: ParsedField): boolean {
  return field.values.length === 1 && field.specials.length === 0;
}

function joinWords(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const NTH_WORDS = ["", "first", "second", "third", "fourth", "fifth"];
const ORDINAL_SUFFIXES: Record<number, string> = { 1: "st", 2: "nd", 3: "rd" };

function ordinal(value: number): string {
  const teens = value % 100;
  const suffix = teens >= 11 && teens <= 13 ? "th" : ORDINAL_SUFFIXES[value % 10] ?? "th";
  return `${value}${suffix}`;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

interface Preset {
  label: string;
  minute: string;
  hour: string;
  dom: string;
  month: string;
  dow: string;
}

const PRESETS: Preset[] = [
  { label: "Every minute", minute: "*", hour: "*", dom: "*", month: "*", dow: "*" },
  { label: "Every 5 minutes", minute: "*/5", hour: "*", dom: "*", month: "*", dow: "*" },
  { label: "Every 15 minutes", minute: "*/15", hour: "*", dom: "*", month: "*", dow: "*" },
  { label: "Every hour", minute: "0", hour: "*", dom: "*", month: "*", dow: "*" },
  { label: "Every 6 hours", minute: "0", hour: "*/6", dom: "*", month: "*", dow: "*" },
  { label: "Every day at midnight", minute: "0", hour: "0", dom: "*", month: "*", dow: "*" },
  { label: "Every day at 09:00", minute: "0", hour: "9", dom: "*", month: "*", dow: "*" },
  { label: "Weekdays at 09:00", minute: "0", hour: "9", dom: "*", month: "*", dow: "MON-FRI" },
  { label: "Mondays at 09:00", minute: "0", hour: "9", dom: "*", month: "*", dow: "MON" },
  { label: "The 1st at midnight", minute: "0", hour: "0", dom: "1", month: "*", dow: "*" },
  { label: "Quarterly", minute: "0", hour: "0", dom: "1", month: "JAN,APR,JUL,OCT", dow: "*" },
];

function presetExpression(preset: Preset, flavour: Flavour): string {
  let dom = preset.dom;
  let dow = preset.dow;
  if (flavour === "quartz") {
    if (dow === "*") dow = "?";
    else if (dom === "*") dom = "?";
  }
  const core = [preset.minute, preset.hour, dom, preset.month, dow];
  return flavour === "unix" ? core.join(" ") : ["0", ...core].join(" ");
}

function refit(text: string, from: Flavour, to: Flavour): string {
  if (from === to) return text;
  const preset = PRESETS.find((item) => presetExpression(item, from) === text.trim());
  if (preset) return presetExpression(preset, to);
  const schedule = readCron(text, from).schedule;
  return (schedule && rewrite(schedule, to)) ?? text;
}

function rewrite(schedule: Schedule, to: Flavour): string | null {
  if (to !== "quartz" && (schedule.dom.specials.length > 0 || schedule.dow.specials.length > 0)) return null;

  let dom = schedule.dom.text;
  let dow = weekdayText(schedule.dow);
  if (to === "quartz") {
    if (saysNothing(schedule.dow)) dow = "?";
    else if (saysNothing(schedule.dom)) dom = "?";
  } else {
    if (dom === "?") dom = "*";
    if (dow === "?") dow = "*";
  }

  const tokens = to === "unix" ? [] : [schedule.second ? schedule.second.text : "0"];
  tokens.push(schedule.minute.text, schedule.hour.text, dom, schedule.month.text, dow);
  if (to === "quartz" && schedule.year && !schedule.year.open) tokens.push(schedule.year.text);
  return tokens.join(" ");
}

function weekdayText(field: ParsedField): string {
  if (field.open || field.specials.length > 0) return field.text;
  return runsOf(field.values)
    .map((run) =>
      run.length > 2
        ? `${DAY_NAMES[run[0]]}-${DAY_NAMES[run[run.length - 1]]}`
        : run.map((day) => DAY_NAMES[day]).join(",")
    )
    .join(",");
}

function runsOf(values: number[]): number[][] {
  const runs: number[][] = [];
  for (const value of values) {
    const last = runs[runs.length - 1];
    if (last && value === last[last.length - 1] + 1) last.push(value);
    else runs.push([value]);
  }
  return runs;
}

function splitTokens(text: string): string[] {
  return text === "" ? [] : text.split(" ");
}

function collapseSpaces(text: string): string {
  return text.replace(/\s+/g, " ").replace(/^ +/, "");
}

function pickFlavour(value: unknown): Flavour {
  return FLAVOURS.some((item) => item.value === value) ? value as Flavour : "unix";
}

function pickExpression(value: unknown, flavour: Flavour): string {
  return typeof value === "string" ? collapseSpaces(value) : DEFAULT_EXPRESSIONS[flavour];
}

const RUN_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function runFormatter(timeZone: string): Intl.DateTimeFormat {
  return formatterFor(RUN_FORMATTERS, timeZone, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
}

const UNTIL_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31556952],
  ["month", 2629746],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
  ["second", 1],
];

const UNTIL_FORMATTER = new Intl.RelativeTimeFormat(undefined, { numeric: "always" });

function untilPhrase(ms: number, nowMs: number): string {
  const seconds = Math.round((ms - nowMs) / 1000);
  const unit = UNTIL_UNITS.find(([, size]) => seconds >= size) ?? UNTIL_UNITS[UNTIL_UNITS.length - 1];
  return UNTIL_FORMATTER.format(Math.trunc(seconds / unit[1]), unit[0]);
}
