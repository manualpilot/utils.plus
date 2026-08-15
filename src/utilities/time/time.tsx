import { closestCenter, DndContext, type DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ActionIcon, Badge, Box, Card, CopyButton, Group, MultiSelect, Popover, Stack, Table, Text, TextInput, Title, Tooltip } from "@mantine/core";
import { InlineDateTimePicker } from "@mantine/dates";
import { useEffect, useMemo, useState } from "react";
import { useInitialHashState, useRegisterShareState } from "../../common/share-state";
import { UtilityTitle } from "../../common/utility-title";
import { LOCAL_ZONE, TIME_ZONES, type WallClock, type ZoneClock, zoneClock } from "../../common/zone-clock";
import { IconArrowsMaximize, IconArrowsMinimize, IconCalendarClock, IconCheck, IconClock, IconCopy, IconGripVertical, IconX } from "../../icons";
import { httpDate, isoBasic, isoExtended, isoOrdinalDate, isoWeekDate, offsetDigits, readable, relativeTime, rfc2822, zoneName } from "./formats";
import { readTimestamp, wallToIso } from "./read";
import { pickZones } from "./zones";

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
      <UtilityTitle directory="time">Time</UtilityTitle>

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
