import type { TablerIcon } from "@tabler/icons-react";
import { type ComponentType, lazy, type LazyExoticComponent } from "react";
import { IconAuth2fa, IconBinary, IconBrackets, IconBrandJavascript, IconBrandPython, IconCalculator, IconCalendarRepeat, IconCertificate, IconClock, IconDatabase, IconFileTypeCsv, IconFlag, IconGitCompare, IconHash, IconId, IconKey, IconLetterCase, IconMarkdown, IconPalette, IconPhone, IconQrcode, IconRegex, IconRulerMeasure, IconSchema, IconShieldLock, IconTerminal2, IconWorld } from "./icons";
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
    path: "/countries",
    label: "Countries",
    Icon: IconFlag,
    Component: lazy(() => import("./utilities/countries/countries")),
  },
  {
    path: "/cron",
    label: "Cron",
    Icon: IconCalendarRepeat,
    Component: lazy(() => import("./utilities/cron/cron")),
  },
  {
    path: "/csv",
    label: "CSV",
    Icon: IconFileTypeCsv,
    Component: lazy(() => import("./utilities/csv/csv")),
  },
  {
    path: "/curl",
    label: "curl",
    Icon: IconTerminal2,
    Component: lazy(() => import("./utilities/curl/curl")),
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
    path: "/markdown",
    label: "Markdown",
    Icon: IconMarkdown,
    Component: lazy(() => import("./utilities/markdown/markdown")),
  },
  {
    path: "/otp",
    label: "OTP",
    Icon: IconAuth2fa,
    Component: lazy(() => import("./utilities/otp/otp")),
  },
  {
    path: "/password",
    label: "Password",
    Icon: IconKey,
    Component: lazy(() => import("./utilities/password/password")),
  },
  {
    path: "/phone-number",
    label: "Phone Number",
    Icon: IconPhone,
    Component: lazy(() => import("./utilities/phone-number/phone-number")),
  },
  {
    path: "/python",
    label: "Python",
    Icon: IconBrandPython,
    Component: lazy(() => import("./utilities/python/python")),
  },
  {
    path: "/qr-code",
    label: "QR Code",
    Icon: IconQrcode,
    Component: lazy(() => import("./utilities/qr-code/qr-code")),
  },
  {
    path: "/regex",
    label: "Regex",
    Icon: IconRegex,
    Component: lazy(() => import("./utilities/regex/regex")),
  },
  {
    path: "/schema",
    label: "Schema",
    Icon: IconSchema,
    Component: lazy(() => import("./utilities/schema/schema")),
  },
  {
    path: "/sql",
    label: "SQL",
    Icon: IconDatabase,
    Component: lazy(() => import("./utilities/sql/sql")),
  },
  {
    path: "/string",
    label: "String",
    Icon: IconLetterCase,
    Component: lazy(() => import("./utilities/string/string")),
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
  {
    path: "/url",
    label: "URL",
    Icon: IconWorld,
    Component: lazy(() => import("./utilities/url/url")),
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
