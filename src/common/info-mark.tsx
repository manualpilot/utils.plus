import { ActionIcon, Tooltip } from "@mantine/core";
import { IconInfoCircle } from "../icons";

export function InfoMark({ label }: { label: string }) {
  return (
    <Tooltip label={label} withArrow multiline w={260} events={{ hover: true, focus: true, touch: true }}>
      <ActionIcon variant="subtle" color="gray" size="md" aria-label={label}>
        <IconInfoCircle size="1.25rem" stroke={1.5} />
      </ActionIcon>
    </Tooltip>
  );
}
