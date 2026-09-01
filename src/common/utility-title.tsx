import { ActionIcon, Group, Title, Tooltip } from "@mantine/core";
import { ReactNode } from "react";
import { IconBrandGithub, IconInfoCircle } from "../icons";
import { currentAsOf } from "./build-date";
import { PageWidthToggle } from "./page-width";

export function UtilityTitle({ directory, publications, control, children }: UtilityTitleProps) {
  return (
    <Group className="utility-title" justify="space-between" align="center" wrap="nowrap" gap="sm">
      <Group gap={4} align="center" wrap="nowrap">
        <Title order={1} size="h2" lh={1.15}>{children}</Title>
        <Tooltip label="View source on GitHub" withArrow>
          <ActionIcon
            component="a"
            href={`${SOURCE_BASE}/${directory}`}
            target="_blank"
            rel="noopener noreferrer"
            variant="subtle"
            color="gray"
            size="md"
            aria-label={`View the ${children} source on GitHub`}
          >
            <IconBrandGithub size="1.25rem" stroke={1.5} />
          </ActionIcon>
        </Tooltip>
        {publications !== undefined && <DataDate publications={publications} />}
      </Group>
      <Group gap="sm" align="center" wrap="nowrap">
        {control}
        <PageWidthToggle />
      </Group>
    </Group>
  );
}

interface UtilityTitleProps {
  directory: string;
  publications?: string;
  control?: ReactNode;
  children: string;
}

function DataDate({ publications }: { publications: string }) {
  const label = currentAsOf(publications);

  return (
    <Tooltip label={label} withArrow multiline w={260} events={{ hover: true, focus: true, touch: true }}>
      <ActionIcon variant="subtle" color="gray" size="md" aria-label={label}>
        <IconInfoCircle size="1.25rem" stroke={1.5} />
      </ActionIcon>
    </Tooltip>
  );
}

const SOURCE_BASE = "https://github.com/manualpilot/utils.plus/tree/main/src/utilities";
