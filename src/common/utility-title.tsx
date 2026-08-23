import { ActionIcon, Group, Title, Tooltip } from "@mantine/core";
import { ReactNode } from "react";
import { IconBrandGithub } from "../icons";
import { PageWidthToggle } from "./page-width";

export function UtilityTitle({ directory, control, children }: UtilityTitleProps) {
  return (
    <Group justify="space-between" align="center" wrap="nowrap" gap="sm">
      <Group gap={4} align="center" wrap="nowrap">
        <Title order={2} lh={1.15}>{children}</Title>
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
  control?: ReactNode;
  children: string;
}

const SOURCE_BASE = "https://github.com/manualpilot/utils.plus/tree/main/src/utilities";
