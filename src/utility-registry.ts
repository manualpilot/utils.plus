import type { TablerIcon } from "@tabler/icons-react";
import { type ComponentType, lazy, type LazyExoticComponent } from "react";
import { IconAbc, IconBinary, IconBrackets, IconBrandJavascript, IconBrandPython, IconCalculator, IconCalendarRepeat, IconCertificate, IconClock, IconGitCompare, IconHash, IconId, IconKey, IconPalette, IconRulerMeasure, IconShieldLock } from "./icons";
import { PAGE_META, type PageMeta, type PagePath } from "./page-meta";

export { ATTRIBUTIONS_PATH } from "./page-meta";

const routes: UtilityRoute[] = [
  {
    path: "/calculator",
    label: "Calculator",
    Icon: IconCalculator,
    Component: lazy(() => import("./utilities/calculator/calculator")),
  },
  {
    path: "/codec",
    label: "Codec",
    Icon: IconBinary,
    Component: lazy(() => import("./utilities/codec/codec")),
  },
  {
    path: "/colour",
    label: "Colour",
    Icon: IconPalette,
    Component: lazy(() => import("./utilities/colour/colour")),
  },
  {
    path: "/converter",
    label: "Converter",
    Icon: IconRulerMeasure,
    Component: lazy(() => import("./utilities/converter/converter")),
  },
  {
    path: "/cron",
    label: "Cron",
    Icon: IconCalendarRepeat,
    Component: lazy(() => import("./utilities/cron/cron")),
  },
  {
    path: "/diff",
    label: "Diff",
    Icon: IconGitCompare,
    Component: lazy(() => import("./utilities/diff/diff")),
  },
  {
    path: "/hasher",
    label: "Hasher",
    Icon: IconHash,
    Component: lazy(() => import("./utilities/hasher/hasher")),
  },
  {
    path: "/javascript",
    label: "JavaScript",
    Icon: IconBrandJavascript,
    Component: lazy(() => import("./utilities/javascript/javascript")),
  },
  {
    path: "/json",
    label: "JSON",
    Icon: IconBrackets,
    Component: lazy(() => import("./utilities/json/json")),
  },
  {
    path: "/jwt",
    label: "JWT",
    Icon: IconShieldLock,
    Component: lazy(() => import("./utilities/jwt/jwt")),
  },
  {
    path: "/keygen",
    label: "Keygen",
    Icon: IconCertificate,
    Component: lazy(() => import("./utilities/keygen/keygen")),
  },
  {
    path: "/passphrase",
    label: "Passphrase",
    Icon: IconAbc,
    Component: lazy(() => import("./utilities/passphrase/passphrase")),
  },
  {
    path: "/password",
    label: "Password",
    Icon: IconKey,
    Component: lazy(() => import("./utilities/password/password")),
  },
  {
    path: "/python",
    label: "Python",
    Icon: IconBrandPython,
    Component: lazy(() => import("./utilities/python/python")),
  },
  {
    path: "/time",
    label: "Time",
    Icon: IconClock,
    Component: lazy(() => import("./utilities/time/time")),
  },
  {
    path: "/unique-id",
    label: "Unique ID",
    Icon: IconId,
    Component: lazy(() => import("./utilities/unique-id/unique-id")),
  },
];

export const utilities: Utility[] = routes.map((route) => ({ ...route, ...PAGE_META[route.path] }));

interface UtilityRoute {
  path: PagePath;
  label: string;
  Icon: TablerIcon;
  Component: LazyExoticComponent<ComponentType>;
}

export interface Utility extends UtilityRoute, PageMeta {}

export function randomUtility(excludePath?: string): Utility {
  const candidates = utilities.filter((utility) => utility.path !== excludePath);
  const pool = candidates.length > 0 ? candidates : utilities;
  return pool[Math.floor(Math.random() * pool.length)];
}
