import { Box, Button, Stack, Text, Title, UnstyledButton } from "@mantine/core";
import { Link, useLocation } from "wouter";
import { IconArrowsShuffle } from "./icons";
import { CATEGORIES } from "./page-meta";
import { randomUtility, utilities } from "./utility-registry";

export function Welcome() {
  const [, setLocation] = useLocation();

  return (
    <Stack gap="xl">
      <Stack align="center" gap="md" py="xl">
        <Title order={1}>Welcome to utils+</Title>
        <Text c="dimmed" ta="center" maw={600}>
          A collection of handy developer tools. Everything happens locally right here in your browser. There is no
          invasive tracking, no server-side processing, and your data never leaves your machine.
        </Text>
        <Button
          leftSection={<IconArrowsShuffle size="1rem" />}
          onClick={() => setLocation(randomUtility().path)}
        >
          Random Utility
        </Button>
      </Stack>

      {CATEGORIES.map(({ name, paths }) => (
        <Box component="section" key={name}>
          <Title order={2} size="h4" mb="sm">{name}</Title>
          <Box component="ul" className="utility-grid">
            {paths.map((path) => {
              const { label, description, Icon } = utilities.find((utility) => utility.path === path)!;
              return (
                <li key={path}>
                  <Link href={path} asChild>
                    <UnstyledButton component="a" className="utility-card">
                      <Icon size="1.25rem" stroke={1.5} className="utility-card-icon" />
                      <Text fw={600}>{label}</Text>
                      <Text size="sm" c="dimmed">{description}</Text>
                    </UnstyledButton>
                  </Link>
                </li>
              );
            })}
          </Box>
        </Box>
      ))}
    </Stack>
  );
}
