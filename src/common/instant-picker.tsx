import { ActionIcon, Group, Popover, Tooltip } from "@mantine/core";
import { InlineDateTimePicker } from "@mantine/dates";
import { useState } from "react";
import { IconCalendarClock, IconClock, IconX } from "../icons";
import { LOCAL_ZONE, wallDate } from "./zone-clock";

import "@mantine/dates/styles.css";

export function InstantPicker({ instant, live, onPick, onPin, onClear }: InstantPickerProps) {
  const [picking, setPicking] = useState(false);
  const [openedAt, setOpenedAt] = useState<Date | null>(null);

  const pickInstant = (wall: string | null) => {
    const date = wall && wallDate(wall, LOCAL_ZONE);
    if (date) onPick(date);
  };

  const takePick = () => {
    if (live && openedAt) onPick(openedAt);
    setPicking(false);
  };

  return (
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
            value={live ? openedAt : instant}
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
              onClick={onPin}
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
              onClick={onClear}
              aria-label="Follow the clock"
            >
              <IconX size="1.1rem" />
            </ActionIcon>
          </Tooltip>
        )}
    </Group>
  );
}

export interface InstantPickerProps {
  instant: Date | null;
  live: boolean;
  onPick: (instant: Date) => void;
  onPin: () => void;
  onClear: () => void;
}

export const INSTANT_PICKER_WIDTH = 64;
