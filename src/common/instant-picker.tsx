import { ActionIcon, Group, Popover, Select, Stack, Tooltip } from "@mantine/core";
import { InlineDateTimePicker } from "@mantine/dates";
import { useState } from "react";
import { IconCalendarClock, IconClock, IconX } from "../icons";
import { LOCAL_ZONE, wallDate, wallText, zoneClock } from "./zone-clock";

import "@mantine/dates/styles.css";

export function InstantPicker({ instant, live, field, zones, onPick, onPin, onClear }: InstantPickerProps) {
  const [picking, setPicking] = useState(false);
  const [openedAt, setOpenedAt] = useState<Date | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const of = field ? ` for ${field}` : "";

  const offered = zones?.length ? zones : [LOCAL_ZONE];
  const zone = chosen && offered.includes(chosen) ? chosen : openingZone(offered);
  const showing = live ? openedAt : instant;

  const pickInstant = (wall: string | null) => {
    const date = wall && wallDate(wall, zone);
    if (date) onPick(date, zone);
  };

  const takePick = () => {
    if (live && openedAt) onPick(openedAt, zone);
    setPicking(false);
  };

  return (
    <Group gap={2} wrap="nowrap">
      <Popover opened={picking} onChange={setPicking} position="bottom-end" shadow="md" trapFocus>
        <Tooltip label={`Pick a date and time${of}`} withArrow position="left">
          <Popover.Target>
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={() => {
                setOpenedAt(instant);
                setPicking((open) => !open);
              }}
              aria-label={`Pick a date and time${of}`}
            >
              <IconCalendarClock size="1.1rem" />
            </ActionIcon>
          </Popover.Target>
        </Tooltip>
        <Popover.Dropdown p="xs">
          <Stack gap="xs">
            {offered.length > 1 && (
              <Select
                label="Zone"
                data={offered}
                value={zone}
                onChange={setChosen}
                allowDeselect={false}
                comboboxProps={{ withinPortal: false }}
              />
            )}
            <InlineDateTimePicker
              withSeconds
              fullWidth={false}
              value={showing && wallText(zoneClock(showing, zone))}
              onChange={pickInstant}
              onSubmit={takePick}
              submitButtonProps={{ "aria-label": "Use this time" }}
            />
          </Stack>
        </Popover.Dropdown>
      </Popover>
      {live
        ? (
          <Tooltip label={`Pin the current time${of}`} withArrow position="left">
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={onPin}
              aria-label={`Pin the current time${of}`}
            >
              <IconClock size="1.1rem" />
            </ActionIcon>
          </Tooltip>
        )
        : (
          <Tooltip label={`Follow the clock${of}`} withArrow position="left">
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={onClear}
              aria-label={`Follow the clock${of}`}
            >
              <IconX size="1.1rem" />
            </ActionIcon>
          </Tooltip>
        )}
    </Group>
  );
}

function openingZone(offered: string[]): string {
  return offered.includes(LOCAL_ZONE) ? LOCAL_ZONE : offered[0];
}

export interface InstantPickerProps {
  instant: Date | null;
  live: boolean;
  field?: string;
  zones?: string[];
  onPick: (instant: Date, timeZone: string) => void;
  onPin: () => void;
  onClear: () => void;
}

export const INSTANT_PICKER_WIDTH = 64;
