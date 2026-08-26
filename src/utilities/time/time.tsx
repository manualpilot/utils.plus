import { closestCenter, DndContext, type DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ActionIcon, Badge, Box, Card, Group, MultiSelect, SegmentedControl, Select, Stack, Text, TextInput, Title, Tooltip } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import { FactTable } from "../../common/fact-table";
import { INSTANT_PICKER_WIDTH, InstantPicker } from "../../common/instant-picker";
import { useInitialHashState, useRegisterShareState } from "../../common/share-state";
import { UtilityTitle } from "../../common/utility-title";
import { LOCAL_ZONE, TIME_ZONES, zoneClock } from "../../common/zone-clock";
import { IconArrowsMaximize, IconArrowsMinimize, IconGripVertical } from "../../icons";
import { betweenInstants, elapsedMs, shiftInstant } from "./arithmetic";
import { clockDuration, compactDuration, type Duration, isoDuration, readDuration, signedCompact, spelledDuration, unitTotals } from "./duration";
import { httpDate, isoBasic, isoExtended, isoOrdinalDate, isoWeekDate, offsetDigits, readable, relativeTime, rfc2822, zoneName } from "./formats";
import { type Mode, MODE_OPTIONS, MODES, pickDuration, pickMode } from "./modes";
import { readTimestamp } from "./read";
import { pickZone, pickZones } from "./zones";

export default function Time() {
  const initialState = useInitialHashState<{
    mode?: string;
    value?: string;
    duration?: string;
    until?: string;
    zones?: string[];
    zone?: string;
    collapsed?: boolean;
  }>();

  const [mode, setMode] = useState<Mode>(() => pickMode(initialState?.mode));
  const [value, setValue] = useState(typeof initialState?.value === "string" ? initialState.value : "");
  const [duration, setDuration] = useState(() => pickDuration(initialState?.duration));
  const [until, setUntil] = useState(typeof initialState?.until === "string" ? initialState.until : "");
  const [zones, setZones] = useState(() => pickZones(initialState?.zones));
  const [zone, setZone] = useState(() => pickZone(initialState?.zone));
  const [now, setNow] = useState(() => Date.now());
  const [collapsed, setCollapsed] = useState(initialState?.collapsed ?? false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useRegisterShareState(() => ({
    mode,
    value: value || undefined,
    duration: mode === "duration" ? duration : undefined,
    until: mode === "between" ? until || undefined : undefined,
    zones: mode === "instant" ? zones : undefined,
    zone: mode === "instant" ? undefined : zone,
    collapsed: mode === "instant" && collapsed ? true : undefined,
  }));

  const reading = useMemo(() => readTimestamp(value), [value]);
  const ending = useMemo(() => readTimestamp(until), [until]);
  const span = useMemo(() => readDuration(duration), [duration]);

  const live = value.trim() === "";
  const ticking = new Date(Math.floor(now / 1000) * 1000);
  const instant = live ? ticking : reading.date;
  const endLive = until.trim() === "";
  const endInstant = endLive ? ticking : ending.date;

  const rowError = Boolean(
    reading.error || (mode === "duration" && span.error) || (mode === "between" && ending.error),
  );

  const spellInstant = (picked: Date) => isoExtended(zoneClock(picked, LOCAL_ZONE));

  const reorderZones = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setZones((current) => arrayMove(current, current.indexOf(String(active.id)), current.indexOf(String(over.id))));
  };

  return (
    <Stack gap="md">
      <UtilityTitle
        directory="time"
        control={
          <SegmentedControl
            value={mode}
            onChange={(next) => setMode(pickMode(next))}
            aria-label="What is being read"
            data={MODE_OPTIONS}
          />
        }
      >
        {MODES[mode].title}
      </UtilityTitle>

      <Card withBorder shadow="sm" radius="md">
        <Box className={rowError ? "settings-row has-error" : "settings-row"} mb={rowError ? "md" : 0}>
          {mode === "duration" && (
            <TextInput
              label="Duration"
              description="1h 30m, PT1H30M, 90:00 or 5400"
              placeholder="Nothing to count"
              value={duration}
              onChange={(event) => setDuration(event.currentTarget.value)}
              error={span.error || null}
              spellCheck={false}
              classNames={{ root: "relative-root", error: "absolute-error" }}
              styles={{ input: { fontFamily: "monospace" } }}
            />
          )}
          <TextInput
            label={MODES[mode].field}
            description={MODES[mode].hint}
            placeholder="Following the clock"
            value={value}
            onChange={(event) => setValue(event.currentTarget.value)}
            error={reading.error || null}
            spellCheck={false}
            classNames={{ root: "relative-root", error: "absolute-error" }}
            styles={{ input: { fontFamily: "monospace" } }}
            rightSectionWidth={INSTANT_PICKER_WIDTH}
            rightSection={
              <InstantPicker
                instant={instant}
                live={live}
                field={mode === "between" ? MODES.between.field : undefined}
                onPick={(picked) => setValue(spellInstant(picked))}
                onPin={() => setValue(String(ticking.getTime()))}
                onClear={() => setValue("")}
              />
            }
          />
          {mode === "between" && (
            <TextInput
              label="To"
              description="Where the count ends"
              placeholder="Following the clock"
              value={until}
              onChange={(event) => setUntil(event.currentTarget.value)}
              error={ending.error || null}
              spellCheck={false}
              classNames={{ root: "relative-root", error: "absolute-error" }}
              styles={{ input: { fontFamily: "monospace" } }}
              rightSectionWidth={INSTANT_PICKER_WIDTH}
              rightSection={
                <InstantPicker
                  instant={endInstant}
                  live={endLive}
                  field="To"
                  onPick={(picked) => setUntil(spellInstant(picked))}
                  onPin={() => setUntil(String(ticking.getTime()))}
                  onClear={() => setUntil("")}
                />
              }
            />
          )}
          {mode === "instant"
            ? (
              <MultiSelect
                label="Time zones"
                description="Searched by IANA name"
                data={TIME_ZONES}
                value={zones}
                onChange={setZones}
                searchable
                nothingFoundMessage="No zone by that name"
              />
            )
            : (
              <Select
                label="Zone"
                description="Whose calendar the months and days are counted on"
                data={TIME_ZONES}
                value={zone}
                onChange={(next) => setZone(pickZone(next))}
                searchable
                allowDeselect={false}
                nothingFoundMessage="No zone by that name"
              />
            )}
        </Box>
      </Card>

      {mode === "instant" && instant && !collapsed && (
        <Card withBorder shadow="sm" radius="md">
          <Stack gap="xs">
            <Group gap="sm" align="baseline">
              <Title order={4}>Instant</Title>
              <Text size="sm" c="dimmed">{live ? "Following the clock" : reading.source}</Text>
            </Group>
            <FactTable
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

      {mode === "instant" && instant && (
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

      {mode === "duration" && instant && span.duration && (
        <>
          <DurationCards
            duration={span.duration}
            elapsed={elapsedMs(span.duration, instant, zone)}
            source={span.source}
            anchored={calendared(span.duration)}
          />
          <Box className="card-columns">
            <ShiftedCard
              title="Before"
              shift={signedCompact(span.duration, -1)}
              instant={shiftInstant(instant, span.duration, -1, zone)}
              timeZone={zone}
              now={now}
            />
            <ShiftedCard
              title="After"
              shift={signedCompact(span.duration, 1)}
              instant={shiftInstant(instant, span.duration, 1, zone)}
              timeZone={zone}
              now={now}
            />
          </Box>
        </>
      )}

      {mode === "between" && instant && endInstant && (
        <>
          <DurationCards
            duration={betweenInstants(instant, endInstant, zone)}
            elapsed={endInstant.getTime() - instant.getTime()}
            source={`Counted in ${zone}`}
            anchored={false}
          />
          <Card withBorder shadow="sm" radius="md">
            <Stack gap="xs">
              <Group gap="sm" align="baseline">
                <Title order={4}>Endpoints</Title>
                <Text size="sm" c="dimmed">{endLive || live ? "Following the clock" : zone}</Text>
              </Group>
              <FactTable
                rows={[
                  { label: "From", value: isoExtended(zoneClock(instant, zone)) },
                  { label: "To", value: isoExtended(zoneClock(endInstant, zone)) },
                ]}
              />
            </Stack>
          </Card>
        </>
      )}
    </Stack>
  );
}

function DurationCards({
  duration,
  elapsed,
  source,
  anchored,
}: {
  duration: Duration;
  elapsed: number;
  source: string;
  anchored: boolean;
}) {
  return (
    <Box className="card-columns">
      <Card withBorder shadow="sm" radius="md">
        <Stack gap="xs">
          <Group gap="sm" align="baseline">
            <Title order={4}>Duration</Title>
            <Text size="sm" c="dimmed">{source}</Text>
          </Group>
          <FactTable
            rows={[
              { label: "ISO 8601", value: isoDuration(duration) },
              { label: "Compact", value: compactDuration(duration) },
              { label: "Spoken", value: spelledDuration(duration) },
              { label: "Clock", value: clockDuration(elapsed) },
            ]}
          />
        </Stack>
      </Card>
      <Card withBorder shadow="sm" radius="md">
        <Stack gap="xs">
          <Group gap="sm" align="baseline">
            <Title order={4}>Totals</Title>
            <Text size="sm" c="dimmed">{anchored ? "Counted from the instant" : ""}</Text>
          </Group>
          <FactTable rows={unitTotals(elapsed)} />
        </Stack>
      </Card>
    </Box>
  );
}

function ShiftedCard({
  title,
  shift,
  instant,
  timeZone,
  now,
}: {
  title: string;
  shift: string;
  instant: Date | null;
  timeZone: string;
  now: number;
}) {
  return (
    <Card withBorder shadow="sm" radius="md">
      <Stack gap="xs">
        <Group gap="sm" align="baseline">
          <Title order={4}>{title}</Title>
          <Text size="sm" c="dimmed" ff="monospace">{shift}</Text>
        </Group>
        {instant
          ? (
            <FactTable
              rows={[
                { label: "Readable", value: readable(instant, timeZone) },
                { label: "ISO 8601", value: isoExtended(zoneClock(instant, timeZone)) },
                { label: "Unix seconds", value: String(Math.floor(instant.getTime() / 1000)) },
                { label: "Relative", value: relativeTime(instant.getTime(), now) },
              ]}
            />
          )
          : <Text size="sm" c="dimmed">That lands outside the years this page can show</Text>}
      </Stack>
    </Card>
  );
}

function calendared(duration: Duration): boolean {
  return duration.years !== 0 || duration.months !== 0 || duration.days !== 0;
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
          <FactTable
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
