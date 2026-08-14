import { ActionIcon, Group, Title, Tooltip } from "@mantine/core";
import { IconBrandGithub } from "../icons";

export function UtilityTitle({ file, children }: UtilityTitleProps) {
  return (
    <Group gap={4} align="center">
      <Title order={2} lh={1.15}>{children}</Title>
      <Tooltip label="View source on GitHub" withArrow>
        <ActionIcon
          component="a"
          href={`${SOURCE_BASE}/${file}`}
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
  );
}

interface UtilityTitleProps {
  file: string;
  children: string;
}

const SOURCE_BASE = "https://github.com/manualpilot/utils.plus/blob/main/src/utilities";
