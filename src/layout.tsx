import { ActionIcon, Anchor, AppShell, Box, Burger, Button, Group, Modal, NavLink, Stack, Text, Title, Tooltip, UnstyledButton } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Fragment, ReactNode, useCallback, useState } from "react";
import { Link, useLocation } from "wouter";
import { useDocumentHead } from "./common/document-head";
import { ShareStateProvider, useShareStateContext } from "./common/share-state";
import { IconBrandGithub, IconCheck, IconLink, IconRestore, IconServerCog } from "./icons";
import { ATTRIBUTIONS_PATH, utilities } from "./utility-registry";

interface LayoutProps {
  children?: ReactNode;
}

const MAIN_CONTENT_ID = "main-content";

function ResetStateButton({ onReset }: { onReset: () => void }) {
  const ctx = useShareStateContext();
  const [opened, { open, close }] = useDisclosure(false);

  const handleReset = useCallback(() => {
    ctx?.clearHash();
    onReset();
    close();
  }, [close, ctx, onReset]);

  return (
    <>
      <Tooltip label="Reset state" withArrow>
        <ActionIcon
          variant="subtle"
          color="gray"
          onClick={open}
          size="lg"
          aria-label="Reset state"
        >
          <IconRestore size="1.2rem" />
        </ActionIcon>
      </Tooltip>
      <Modal opened={opened} onClose={close} title="Reset state?" centered>
        <Stack gap="lg">
          <Text size="sm">
            This puts the page back to how it opens fresh and drops the shared link from the address bar. Anything
            entered here is lost unless the link was copied.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={close}>Cancel</Button>
            <Button color="red" onClick={handleReset}>Reset</Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

function CopyStateButton() {
  const ctx = useShareStateContext();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (!ctx) return;
    const url = ctx.getShareUrl();
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [ctx]);

  return (
    <Tooltip label={copied ? "Copied!" : "Copy state link"} withArrow>
      <ActionIcon
        variant="subtle"
        color={copied ? "teal" : "gray"}
        onClick={handleCopy}
        size="lg"
      >
        {copied ? <IconCheck size="1.2rem" /> : <IconLink size="1.2rem" />}
      </ActionIcon>
    </Tooltip>
  );
}

function SiteFooter() {
  return (
    <Group component="footer" className="site-footer" justify="space-between" py="md" gap="sm">
      <Group gap="xs">
        <Text size="sm" c="dimmed">
          ©{" "}
          <Anchor
            href="https://manualpilot.com"
            target="_blank"
            rel="noopener noreferrer"
            inherit
            c="dimmed"
            underline="hover"
          >
            Manualpilot
          </Anchor>{" "}
          {new Date().getFullYear()}
        </Text>
        <Text size="sm" c="dimmed">·</Text>
        <Link href={ATTRIBUTIONS_PATH} asChild>
          <Anchor size="sm" c="dimmed" underline="hover">Attributions</Anchor>
        </Link>
      </Group>
      <Anchor
        href="https://github.com/manualpilot/utils.plus"
        target="_blank"
        rel="noopener noreferrer"
        size="sm"
        c="dimmed"
        underline="hover"
      >
        <Group gap={6} wrap="nowrap">
          <IconBrandGithub size="1rem" stroke={1.5} />
          <Text size="sm" ff="monospace">manualpilot/utils.plus</Text>
        </Group>
      </Anchor>
    </Group>
  );
}

export function Layout({ children }: LayoutProps) {
  const [opened, { toggle, close }] = useDisclosure();
  const [location, setLocation] = useLocation();
  const [stateKey, setStateKey] = useState(0);

  const isUtilityPage = utilities.some((utility) => utility.path === location);

  useDocumentHead(location);

  const handleReset = useCallback(() => setStateKey((key) => key + 1), []);

  return (
    <ShareStateProvider>
      <AppShell
        header={{ height: 60 }}
        navbar={{ width: 250, breakpoint: "sm", collapsed: { mobile: !opened } }}
        padding="md"
      >
        <UnstyledButton className="skip-link" onClick={() => document.getElementById(MAIN_CONTENT_ID)?.focus()}>
          Skip to the utility
        </UnstyledButton>

        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between">
            <Group gap={0}>
              <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" mr="sm" />
              <Group
                gap="sm"
                style={{ cursor: "pointer" }}
                onClick={() => {
                  setLocation("/");
                  close();
                }}
              >
                <IconServerCog size={28} />
                <Title order={3}>
                  utils+
                </Title>
              </Group>
            </Group>
            {isUtilityPage && (
              <Group gap="xs">
                <ResetStateButton onReset={handleReset} />
                <CopyStateButton />
              </Group>
            )}
          </Group>
        </AppShell.Header>

        <AppShell.Navbar p="md">
          {utilities.map(({ path, label, Icon }) => (
            <Link key={path} href={path} onClick={close} asChild>
              <NavLink
                label={label}
                leftSection={<Icon size="1rem" stroke={1.5} />}
                active={location === path}
                style={{ borderRadius: "var(--mantine-radius-md)" }}
              />
            </Link>
          ))}
        </AppShell.Navbar>

        <AppShell.Main className="main-region">
          <Box className="main-container" id={MAIN_CONTENT_ID} tabIndex={-1}>
            <Fragment key={stateKey}>{children}</Fragment>
            <SiteFooter />
          </Box>
        </AppShell.Main>
      </AppShell>
    </ShareStateProvider>
  );
}
