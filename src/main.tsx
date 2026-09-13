import { Center, Image, Loader, MantineProvider } from "@mantine/core";
import { Suspense } from "react";
import ReactDOM from "react-dom/client";
import { Route, Switch } from "wouter";

import notFound from "./images/not-found.png";

import "@fontsource-variable/roboto";
import "@mantine/core/styles.css";
import "@mantine/spotlight/styles.css";
import "./global.css";

import { Layout } from "./layout";
import { PageLoader } from "./page-loader";
import { cssVariablesResolver, theme } from "./theme";
import { ATTRIBUTIONS_PATH, utilities } from "./utility-registry";
import { Welcome } from "./welcome";

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
          {utilities.map(({ path }) => (
            <Route key={path} path={path}>
              <PageLoader path={path} />
            </Route>
          ))}
          <Route path={ATTRIBUTIONS_PATH}>
            <PageLoader path={ATTRIBUTIONS_PATH} />
          </Route>
          <Image radius="md" src={notFound} />
        </Switch>
      </Suspense>
    </Layout>
  </MantineProvider>,
);
