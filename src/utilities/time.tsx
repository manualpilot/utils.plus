import { closestCenter, DndContext, type DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ActionIcon, Badge, Box, Card, CopyButton, Group, MultiSelect, Popover, Stack, Table, Text, TextInput, Title, Tooltip } from "@mantine/core";
import { InlineDateTimePicker } from "@mantine/dates";
import abbreviations from "@vvo/tzdb/abbreviations.json";
import { useEffect, useMemo, useState } from "react";
import { useInitialHashState, useRegisterShareState } from "../common/share-state";
import { UtilityTitle } from "../common/utility-title";
import { formatterFor, LOCAL_ZONE, TIME_ZONES, utcDate, type WallClock, type ZoneClock, zoneClock, zoneInstant } from "../common/zone-clock";
import { IconArrowsMaximize, IconArrowsMinimize, IconCalendarClock, IconCheck, IconClock, IconCopy, IconGripVertical, IconX } from "../icons";

import "@mantine/dates/styles.css";

export default function Time() {
  const initialState = useInitialHashState<{
    value?: string;
    zones?: string[];
    collapsed?: boolean;
  }>();

  const [value, setValue] = useState(typeof initialState?.value === "string" ? initialState.value : "");
  const [zones, setZones] = useState(() => pickZones(initialState?.zones));
  const [now, setNow] = useState(() => Date.now());
  const [collapsed, setCollapsed] = useState(initialState?.collapsed ?? false);
  const [picking, setPicking] = useState(false);
  const [openedAt, setOpenedAt] = useState<Date | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useRegisterShareState(() => ({ value: value || undefined, zones, collapsed: collapsed || undefined }));

  const reading = useMemo(() => readTimestamp(value), [value]);
  const live = value.trim() === "";
  const ticking = new Date(Math.floor(now / 1000) * 1000);
  const instant = live ? ticking : reading.date;

  const pickInstant = (wall: string | null) => {
    const iso = wall && wallToIso(wall, LOCAL_ZONE);
    if (iso) setValue(iso);
  };

  const takePick = () => {
    if (live && openedAt) setValue(isoExtended(zoneClock(openedAt, LOCAL_ZONE)));
    setPicking(false);
  };

  const reorderZones = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setZones((current) => arrayMove(current, current.indexOf(String(active.id)), current.indexOf(String(over.id))));
  };

  return (
    <Stack gap="md">
      <UtilityTitle file="time.tsx">Time</UtilityTitle>

      <Card withBorder shadow="sm" radius="md">
        <Box
          className={reading.error ? "settings-row has-error" : "settings-row"}
          mb={reading.error ? "md" : 0}
        >
          <TextInput
            label="Timestamp or epoch"
            description="Epoch seconds to nanoseconds, ISO 8601 or RFC 2822"
            placeholder="Following the clock"
            value={value}
            onChange={(event) => setValue(event.currentTarget.value)}
            error={reading.error || null}
            spellCheck={false}
            classNames={{ root: "relative-root", error: "absolute-error" }}
            styles={{ input: { fontFamily: "monospace" } }}
            rightSectionWidth={64}
            rightSection={
              <Group gap={2} wrap="nowrap">
                <Popover opened={picking} onChange={setPicking} position="bottom-end" shadow="md" trapFocus>
                  <Tooltip label="Pick a date and time" withArrow position="left">
                    <Popover.Target>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        onClick={() => {
                          setOpenedAt(instant);
                          setPicking((open) => !open);
                        }}
                        aria-label="Pick a date and time"
                      >
                        <IconCalendarClock size="1.1rem" />
                      </ActionIcon>
                    </Popover.Target>
                  </Tooltip>
                  <Popover.Dropdown p="xs">
                    <InlineDateTimePicker
                      withSeconds
                      fullWidth={false}
                      value={live ? openedAt : reading.date}
                      onChange={pickInstant}
                      onSubmit={takePick}
                      submitButtonProps={{ "aria-label": "Use this time" }}
                    />
                  </Popover.Dropdown>
                </Popover>
                {live
                  ? (
                    <Tooltip label="Pin the current time" withArrow position="left">
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        onClick={() => setValue(String(ticking.getTime()))}
                        aria-label="Pin the current time"
                      >
                        <IconClock size="1.1rem" />
                      </ActionIcon>
                    </Tooltip>
                  )
                  : (
                    <Tooltip label="Follow the clock" withArrow position="left">
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        onClick={() => setValue("")}
                        aria-label="Follow the clock"
                      >
                        <IconX size="1.1rem" />
                      </ActionIcon>
                    </Tooltip>
                  )}
              </Group>
            }
          />
          <MultiSelect
            label="Time zones"
            description="Searched by IANA name"
            data={TIME_ZONES}
            value={zones}
            onChange={setZones}
            searchable
            nothingFoundMessage="No zone by that name"
          />
        </Box>
      </Card>

      {instant && !collapsed && (
        <Card withBorder shadow="sm" radius="md">
          <Stack gap="xs">
            <Group gap="sm" align="baseline">
              <Title order={4}>Instant</Title>
              <Text size="sm" c="dimmed">{live ? "Following the clock" : reading.source}</Text>
            </Group>
            <FormatTable
              rows={[
                { label: "Unix seconds", value: String(Math.floor(instant.getTime() / 1000)) },
                { label: "Unix milliseconds", value: String(instant.getTime()) },
                { label: "RFC 1123 (HTTP)", value: httpDate(instant) },
                { label: "Relative", value: relativeTime(instant.getTime(), now) },
              ]}
            />
          </Stack>
        </Card>
      )}

      {instant && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={reorderZones}
        >
          <SortableContext items={zones} strategy={verticalListSortingStrategy}>
            {zones.map((zone) => (
              <ZoneCard
                key={zone}
                instant={instant}
                timeZone={zone}
                sortable={zones.length > 1}
                collapsed={collapsed}
                onToggleCollapse={() => setCollapsed((c) => !c)}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}
    </Stack>
  );
}

function ZoneCard({
  instant,
  timeZone,
  sortable,
  collapsed,
  onToggleCollapse,
}: {
  instant: Date;
  timeZone: string;
  sortable: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const clock = zoneClock(instant, timeZone);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: timeZone });
  const name = zoneName(instant, timeZone, collapsed);

  return (
    <Card
      ref={setNodeRef}
      withBorder
      shadow={isDragging ? "lg" : "sm"}
      radius="md"
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        position: "relative",
        zIndex: isDragging ? 1 : 0,
      }}
    >
      <Stack gap="xs">
        <Group justify="space-between" gap="sm" wrap="nowrap">
          <Group gap="sm" align="baseline">
            {collapsed && (
              <Text size="sm" ff="monospace" style={{ overflowWrap: "anywhere" }}>
                {readable(instant, timeZone)}
              </Text>
            )}
            <Title order={4}>{timeZone}</Title>
            <Text size="sm" c="dimmed">
              UTC{offsetDigits(clock.offsetMs, ":")} · {name}
            </Text>
          </Group>
          <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
            {timeZone === LOCAL_ZONE && <Badge variant="light" size="sm">Local</Badge>}
            <Tooltip label={collapsed ? "Expand all" : "Collapse all"} withArrow position="left">
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={onToggleCollapse}
                aria-label={collapsed ? "Expand all" : "Collapse all"}
              >
                {collapsed ? <IconArrowsMaximize size="1.1rem" /> : <IconArrowsMinimize size="1.1rem" />}
              </ActionIcon>
            </Tooltip>
            {sortable && (
              <Tooltip label="Drag to reorder" withArrow position="left">
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="sm"
                  style={{ cursor: isDragging ? "grabbing" : "grab" }}
                  aria-label={`Reorder ${timeZone}`}
                  {...attributes}
                  {...listeners}
                >
                  <IconGripVertical size="1.1rem" />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        </Group>
        {!collapsed && (
          <FormatTable
            rows={[
              { label: "Readable", value: readable(instant, timeZone) },
              { label: "RFC 2822", value: rfc2822(clock) },
              { label: "ISO 8601", value: isoExtended(clock) },
              { label: "ISO 8601 basic", value: isoBasic(clock) },
              { label: "ISO week date", value: isoWeekDate(clock) },
              { label: "ISO ordinal date", value: isoOrdinalDate(clock) },
            ]}
          />
        )}
      </Stack>
    </Card>
  );
}

function FormatTable({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <Table verticalSpacing={6} horizontalSpacing="xs" withRowBorders={false}>
      <Table.Tbody>
        {rows.map((row) => (
          <Table.Tr key={row.label}>
            <Table.Td w="1%" style={{ whiteSpace: "nowrap" }}>
              <Text size="sm" c="dimmed">{row.label}</Text>
            </Table.Td>
            <Table.Td w="1%">
              <CopyButton value={row.value} timeout={2000}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? "Copied" : "Copy"} withArrow position="left">
                    <ActionIcon
                      color={copied ? "teal" : "gray"}
                      variant="subtle"
                      size="sm"
                      onClick={copy}
                      aria-label={`Copy ${row.label}`}
                    >
                      {copied ? <IconCheck size="1rem" /> : <IconCopy size="1rem" />}
                    </ActionIcon>
                  </Tooltip>
                )}
              </CopyButton>
            </Table.Td>
            <Table.Td>
              <Text size="sm" ff="monospace" style={{ overflowWrap: "anywhere" }}>{row.value}</Text>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

const KNOWN_ZONES = new Set(TIME_ZONES);

function pickZones(value: unknown): string[] {
  if (!Array.isArray(value)) return LOCAL_ZONE === "UTC" ? ["UTC"] : [LOCAL_ZONE, "UTC"];
  return [...new Set(value.filter((zone): zone is string => KNOWN_ZONES.has(zone as string)))];
}

export interface Reading {
  date: Date | null;
  source: string;
  error: string;
}

const EPOCH_UNITS = [
  { digits: 11, name: "Unix seconds", multiply: 1000n, divide: 1n },
  { digits: 14, name: "Unix milliseconds", multiply: 1n, divide: 1n },
  { digits: 17, name: "Unix microseconds", multiply: 1n, divide: 1000n },
  { digits: 20, name: "Unix nanoseconds", multiply: 1n, divide: 1000000n },
];

const EPOCH_PATTERN = /^([+-]?)(\d+)(\.\d+)?$/;
const ISO_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?)?(Z|[+-]\d{2}:?\d{2})?$/i;
const MONTH_PATTERN = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i;
const HTTP_PATTERN = /^(mon|tue|wed|thu|fri|sat|sun)[a-z]*,.*\bGMT$/i;

export function readTimestamp(text: string): Reading {
  const trimmed = text.trim();
  if (!trimmed) return { date: null, source: "Following the clock", error: "" };

  const epoch = EPOCH_PATTERN.exec(trimmed);
  if (epoch) {
    const unit = EPOCH_UNITS.find((candidate) => epoch[2].length <= candidate.digits);
    if (!unit) return fault("That is more digits than any epoch unit uses");
    return asReading(epochMs(epoch, unit), epoch[3] ? `${unit.name}, fractional` : unit.name);
  }

  const iso = ISO_PATTERN.exec(trimmed);
  if (iso) return asReading(Date.parse(trimmed.replace(" ", "T")), isoSource(iso));

  return asReading(Date.parse(trimmed), textSource(trimmed));
}

const WALL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})$/;

export function wallToIso(text: string, timeZone: string): string | null {
  const match = WALL_PATTERN.exec(text);
  if (!match) return null;
  const wall: WallClock = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6]),
  };
  return isoExtended(zoneClock(new Date(zoneInstant(wall, timeZone)), timeZone));
}

function epochMs(match: RegExpExecArray, unit: (typeof EPOCH_UNITS)[number]): number {
  const magnitude = Number(BigInt(match[2]) * unit.multiply / unit.divide)
    + (match[3] ? Number(match[3]) * Number(unit.multiply) / Number(unit.divide) : 0);
  return match[1] === "-" ? -magnitude : magnitude;
}

function isoSource(match: RegExpExecArray): string {
  if (match[7]) return "ISO 8601";
  return match[4] ? "ISO 8601, no offset — read as local time" : "ISO 8601 date — read as UTC midnight";
}

function textSource(text: string): string {
  if (HTTP_PATTERN.test(text)) return "RFC 1123 (HTTP date)";
  if (MONTH_PATTERN.test(text)) return "RFC 2822";
  return "Date string, read by the browser";
}

function asReading(ms: number, source: string): Reading {
  if (!Number.isFinite(ms)) return fault("That is not an epoch or a date this page can read");
  if (ms < MIN_TIME || ms > MAX_TIME) return fault(`Only the years ${MIN_YEAR} through ${MAX_YEAR} can be shown`);
  return { date: new Date(Math.round(ms)), source, error: "" };
}

function fault(error: string): Reading {
  return { date: null, source: "", error };
}

export function isoExtended(clock: ZoneClock): string {
  const date = `${year4(clock.year)}-${pad(clock.month)}-${pad(clock.day)}`;
  return `${date}T${pad(clock.hour)}:${pad(clock.minute)}:${pad(clock.second)}${fraction(clock)}${
    zoneSuffix(clock, ":")
  }`;
}

export function isoBasic(clock: ZoneClock): string {
  const date = `${year4(clock.year)}${pad(clock.month)}${pad(clock.day)}`;
  return `${date}T${pad(clock.hour)}${pad(clock.minute)}${pad(clock.second)}${fraction(clock)}${zoneSuffix(clock, "")}`;
}

export function isoWeekDate(clock: ZoneClock): string {
  const weekday = clock.weekday === 0 ? 7 : clock.weekday;
  const thursday = utcDate(clock.year, clock.month, clock.day + 4 - weekday);
  const weekYear = thursday.getUTCFullYear();
  const elapsed = thursday.getTime() - utcDate(weekYear, 1, 1).getTime();
  return `${year4(weekYear)}-W${pad(Math.floor(elapsed / DAY_MS / 7) + 1)}-${weekday}`;
}

export function isoOrdinalDate(clock: ZoneClock): string {
  const elapsed = utcDate(clock.year, clock.month, clock.day).getTime() - utcDate(clock.year, 1, 1).getTime();
  return `${year4(clock.year)}-${String(Math.round(elapsed / DAY_MS) + 1).padStart(3, "0")}`;
}

export function rfc2822(clock: ZoneClock): string {
  return `${calendarText(clock)} ${offsetDigits(clock.offsetMs, "")}`;
}

export function httpDate(date: Date): string {
  return `${calendarText(zoneClock(date, "UTC"))} GMT`;
}

function calendarText(clock: ZoneClock): string {
  const date = `${WEEKDAY_NAMES[clock.weekday]}, ${pad(clock.day)} ${MONTH_NAMES[clock.month - 1]} ${
    year4(clock.year)
  }`;
  return `${date} ${pad(clock.hour)}:${pad(clock.minute)}:${pad(clock.second)}`;
}

const SECOND_UNIT: [Intl.RelativeTimeFormatUnit, number] = ["second", 1];
const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31556952],
  ["month", 2629746],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
  SECOND_UNIT,
];

export function relativeTime(ms: number, nowMs: number): string {
  const seconds = Math.round((ms - nowMs) / 1000);
  const match = RELATIVE_UNITS.find(([, size]) => Math.abs(seconds) >= size);
  const [unit, size] = match ?? SECOND_UNIT;
  return RELATIVE_FORMATTER.format(Math.trunc(seconds / size), unit);
}

function readable(date: Date, timeZone: string): string {
  return formatterFor(TEXT_FORMATTERS, timeZone, { dateStyle: "full", timeStyle: "medium" }).format(date);
}

function zoneName(date: Date, timeZone: string, short = false): string {
  const longParts = formatterFor(NAME_FORMATTERS, timeZone, { timeZoneName: "long" }).formatToParts(date);
  const longName = longParts.find((part) => part.type === "timeZoneName")?.value ?? timeZone;

  if (short) {
    const abbrev = (abbreviations as Record<string, string>)[longName];
    if (abbrev) return abbrev;

    const shortParts = formatterFor(SHORT_NAME_FORMATTERS, timeZone, { timeZoneName: "short" }).formatToParts(date);
    return shortParts.find((part) => part.type === "timeZoneName")?.value ?? timeZone;
  }

  return longName;
}

const TEXT_FORMATTERS = new Map<string, Intl.DateTimeFormat>();
const NAME_FORMATTERS = new Map<string, Intl.DateTimeFormat>();
const SHORT_NAME_FORMATTERS = new Map<string, Intl.DateTimeFormat>();
const RELATIVE_FORMATTER = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

const DAY_MS = 86400000;
const MIN_YEAR = 1;
const MAX_YEAR = 9999;
const MIN_TIME = utcDate(MIN_YEAR, 1, 1).getTime();
const MAX_TIME = utcDate(MAX_YEAR, 12, 31).getTime() + DAY_MS - 1;

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function zoneSuffix(clock: ZoneClock, separator: string): string {
  return clock.timeZone === "UTC" ? "Z" : offsetDigits(clock.offsetMs, separator);
}

function offsetDigits(offsetMs: number, separator: string): string {
  const minutes = Math.trunc(offsetMs / 60000);
  const absolute = Math.abs(minutes);
  return `${minutes < 0 ? "-" : "+"}${pad(Math.floor(absolute / 60))}${separator}${pad(absolute % 60)}`;
}

function fraction(clock: ZoneClock): string {
  return clock.millisecond ? `.${String(clock.millisecond).padStart(3, "0")}` : "";
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function year4(value: number): string {
  return String(value).padStart(4, "0");
}
