import { Button, Center, Container, Image, Loader, MantineProvider, Stack, Text, Title } from "@mantine/core";
import { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { Route, Switch, useLocation } from "wouter";

import notFound from "./images/not-found.png";

import "@fontsource-variable/roboto";
import "@mantine/core/styles.css";
import "@mantine/spotlight/styles.css";
import "./global.css";

import { IconArrowsShuffle } from "./icons";
import { Layout } from "./layout";
import { cssVariablesResolver, theme } from "./theme";
import { ATTRIBUTIONS_PATH, randomUtility, utilities } from "./utility-registry";

const Attributions = lazy(() => import("./attributions"));

ReactDOM.createRoot(document.getElementById("root")!).render(
  <MantineProvider
    theme={theme}
    defaultColorScheme="dark"
    forceColorScheme="dark"
    cssVariablesResolver={cssVariablesResolver}
  >
    <Layout>
      <Suspense
        fallback={
          <Center h="100%">
            <Loader />
          </Center>
        }
      >
        <Switch>
          <Route path="/" component={Welcome} />
          {utilities.map(({ path, Component }) => <Route key={path} path={path} component={Component} />)}
          <Route path={ATTRIBUTIONS_PATH} component={Attributions} />
          <Image radius="md" src={notFound} />
        </Switch>
      </Suspense>
    </Layout>
  </MantineProvider>,
);

function Welcome() {
  const [, setLocation] = useLocation();

  return (
    <Container flex={1} style={{ display: "flex", flexDirection: "column" }}>
      <Center flex={1}>
        <Stack align="center" gap="md">
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
      </Center>
    </Container>
  );
}
