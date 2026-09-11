import { ActionIcon, Anchor, AppShell, Box, Burger, Button, Group, Modal, NavLink, Stack, Text, Tooltip, UnstyledButton } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { ReactNode, type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useDocumentHead } from "./common/document-head";
import { PageWidthContext } from "./common/page-width";
import { ShareStateProvider, useShareStateContext } from "./common/share-state";
import { IconBrandGithub, IconCheck, IconChevronLeft, IconChevronRight, IconLink, IconRestore, IconServerCog } from "./icons";
import { PageArticle } from "./page-article";
import { crumbs } from "./page-document";
import { CATEGORIES, HOME_PATH, isUtilityPath, PAGE_META, type PagePath } from "./page-meta";
import { UtilitySpotlight } from "./spotlight";
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

function SiteFooter({ directory }: { directory: boolean }) {
  return (
    <Box component="footer" className="site-footer">
      {directory && <SiteDirectory />}
      <Group justify="space-between" py="md" gap="sm">
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
    </Box>
  );
}

function SiteDirectory() {
  return (
    <Box className="site-directory">
      {CATEGORIES.map(({ name, paths }) => (
        <Box key={name}>
          <Text component="h2" size="xs" fw={700} tt="uppercase" c="dimmed" mb="xs">{name}</Text>
          <Stack component="ul" gap={4} className="site-directory-list">
            {paths.map((path) => (
              <li key={path}>
                <Link href={path} asChild>
                  <Anchor size="sm" c="dimmed" underline="hover">{PAGE_META[path].label}</Anchor>
                </Link>
              </li>
            ))}
          </Stack>
        </Box>
      ))}
    </Box>
  );
}

function SiteCrumbs({ location, onNavigate }: { location: string; onNavigate: () => void }) {
  const page = location in PAGE_META ? crumbs(location as PagePath).at(-1) : undefined;

  return (
    <Box component="nav" aria-label="Breadcrumb" className="site-crumbs">
      <ol>
        <li>
          <Link href={HOME_PATH} onClick={onNavigate} asChild>
            <UnstyledButton component="a" className="site-home">
              <IconServerCog size={28} />
              <span className="site-name">utils+</span>
            </UnstyledButton>
          </Link>
        </li>
        {page && (
          <li className="site-crumb">
            <Text component="span" size="lg" c="dimmed" truncate aria-current="page">{page.label}</Text>
          </li>
        )}
      </ol>
    </Box>
  );
}

let popped = false;
window.addEventListener("popstate", () => {
  popped = true;
});

function useScrollToTop(location: string) {
  const previous = useRef(location);

  useEffect(() => {
    if (previous.current !== location && !popped) window.scrollTo(0, 0);
    previous.current = location;
    popped = false;
  }, [location]);
}

let tabbedEarly = !!document.activeElement?.closest(".page-fallback");
document.getElementById("root")?.addEventListener("focusin", (event) => {
  if ((event.target as Element).closest(".page-fallback")) tabbedEarly = true;
});

function useEarlyFocus(skip: RefObject<HTMLButtonElement | null>) {
  useEffect(() => {
    if (tabbedEarly && document.activeElement === document.body) skip.current?.focus();
    tabbedEarly = false;
  }, [skip]);
}

function NavbarNotch({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  const label = shown ? "Hide the navigation" : "Show the navigation";

  return (
    <Tooltip label={label} withArrow position="right">
      <UnstyledButton className="navbar-notch" onClick={onToggle} aria-label={label} aria-expanded={shown}>
        {shown ? <IconChevronLeft size="0.85rem" stroke={2} /> : <IconChevronRight size="0.85rem" stroke={2} />}
      </UnstyledButton>
    </Tooltip>
  );
}

export function Layout({ children }: LayoutProps) {
  const [opened, { toggle, close }] = useDisclosure();
  const [navShown, { toggle: toggleNav }] = useDisclosure(true);
  const [location] = useLocation();
  const [stateKey, setStateKey] = useState(0);
  const [wide, setWide] = useState(false);
  const pageWidth = useMemo(() => ({ wide, toggle: () => setWide((current) => !current) }), [wide]);

  const isUtilityPage = utilities.some((utility) => utility.path === location);

  useDocumentHead(location);
  useScrollToTop(location);
  const skip = useRef<HTMLButtonElement>(null);
  useEarlyFocus(skip);

  const handleReset = useCallback(() => setStateKey((key) => key + 1), []);

  return (
    <ShareStateProvider>
      <PageWidthContext.Provider value={pageWidth}>
        <AppShell
          header={{ height: 60 }}
          navbar={{ width: 250, breakpoint: "sm", collapsed: { mobile: !opened, desktop: !navShown } }}
          padding="md"
        >
          <UtilitySpotlight />

          <UnstyledButton
            ref={skip}
            className="skip-link"
            onClick={() => document.getElementById(MAIN_CONTENT_ID)?.focus()}
          >
            Skip to the utility
          </UnstyledButton>

          <AppShell.Header>
            <Group h="100%" px="md" justify="space-between" wrap="nowrap">
              <Group gap={0} wrap="nowrap" miw={0} flex={1}>
                <Burger
                  opened={opened}
                  onClick={toggle}
                  hiddenFrom="sm"
                  size="sm"
                  mr="sm"
                  aria-label={opened ? "Close the navigation" : "Open the navigation"}
                />
                <SiteCrumbs location={location} onNavigate={close} />
              </Group>
              {isUtilityPage && (
                <Group gap="xs">
                  <ResetStateButton onReset={handleReset} />
                  <CopyStateButton />
                </Group>
              )}
            </Group>
          </AppShell.Header>

          <NavbarNotch shown={navShown} onToggle={toggleNav} />

          <AppShell.Navbar
            p="md"
            className="app-navbar"
            data-collapsed-mobile={!opened || undefined}
            data-collapsed-desktop={!navShown || undefined}
          >
            <Box className="navbar-links">
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
            </Box>
          </AppShell.Navbar>

          <AppShell.Main className="main-region">
            <Box className="main-container" id={MAIN_CONTENT_ID} tabIndex={-1} data-wide={wide || undefined}>
              <div className="page-tool" key={stateKey}>{children}</div>
              {isUtilityPath(location) && <PageArticle key={location} path={location} />}
              <SiteFooter directory={location !== HOME_PATH} />
            </Box>
          </AppShell.Main>
        </AppShell>
      </PageWidthContext.Provider>
    </ShareStateProvider>
  );
}
