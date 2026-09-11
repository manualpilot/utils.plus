import type { TablerIcon } from "@tabler/icons-react";
import { type ComponentType, lazy, type LazyExoticComponent } from "react";
import { IconArrowsExchange, IconAuth2fa, IconBinary, IconBrackets, IconBrandJavascript, IconBrandPython, IconCalculator, IconCalendarRepeat, IconCertificate, IconClock, IconDatabase, IconFileCertificate, IconFileDigit, IconFileSettings, IconFileTypeCsv, IconFlag, IconGitCompare, IconHash, IconId, IconKey, IconLanguage, IconLetterCase, IconLock, IconMarkdown, IconNetwork, IconPalette, IconPhone, IconPhoto, IconQrcode, IconRegex, IconRulerMeasure, IconSchema, IconShieldLock, IconTerminal2, IconTestPipe, IconWorld } from "./icons";
import { PAGE_META, type PageMeta, type UtilityPath } from "./page-meta";

export { ATTRIBUTIONS_PATH } from "./page-meta";

const routes: UtilityRoute[] = [
  {
    path: "/calculator",
    Icon: IconCalculator,
    Component: lazy(() => import("./utilities/calculator/calculator")),
  },
  {
    path: "/certificate",
    Icon: IconFileCertificate,
    Component: lazy(() => import("./utilities/certificate/certificate")),
  },
  {
    path: "/codec",
    Icon: IconBinary,
    Component: lazy(() => import("./utilities/codec/codec")),
  },
  {
    path: "/colour",
    Icon: IconPalette,
    Component: lazy(() => import("./utilities/colour/colour")),
  },
  {
    path: "/config",
    Icon: IconFileSettings,
    Component: lazy(() => import("./utilities/config/config")),
  },
  {
    path: "/converter",
    Icon: IconRulerMeasure,
    Component: lazy(() => import("./utilities/converter/converter")),
  },
  {
    path: "/countries",
    Icon: IconFlag,
    Component: lazy(() => import("./utilities/countries/countries")),
  },
  {
    path: "/cron",
    Icon: IconCalendarRepeat,
    Component: lazy(() => import("./utilities/cron/cron")),
  },
  {
    path: "/cryptography",
    Icon: IconLock,
    Component: lazy(() => import("./utilities/cryptography/cryptography")),
  },
  {
    path: "/csv",
    Icon: IconFileTypeCsv,
    Component: lazy(() => import("./utilities/csv/csv")),
  },
  {
    path: "/curl",
    Icon: IconTerminal2,
    Component: lazy(() => import("./utilities/curl/curl")),
  },
  {
    path: "/diff",
    Icon: IconGitCompare,
    Component: lazy(() => import("./utilities/diff/diff")),
  },
  {
    path: "/har",
    Icon: IconArrowsExchange,
    Component: lazy(() => import("./utilities/har/har")),
  },
  {
    path: "/hasher",
    Icon: IconHash,
    Component: lazy(() => import("./utilities/hasher/hasher")),
  },
  {
    path: "/hex",
    Icon: IconFileDigit,
    Component: lazy(() => import("./utilities/hex/hex")),
  },
  {
    path: "/image",
    Icon: IconPhoto,
    Component: lazy(() => import("./utilities/image/image")),
  },
  {
    path: "/ip-address",
    Icon: IconNetwork,
    Component: lazy(() => import("./utilities/ip-address/ip-address")),
  },
  {
    path: "/javascript",
    Icon: IconBrandJavascript,
    Component: lazy(() => import("./utilities/javascript/javascript")),
  },
  {
    path: "/json",
    Icon: IconBrackets,
    Component: lazy(() => import("./utilities/json/json")),
  },
  {
    path: "/jwt",
    Icon: IconShieldLock,
    Component: lazy(() => import("./utilities/jwt/jwt")),
  },
  {
    path: "/keygen",
    Icon: IconCertificate,
    Component: lazy(() => import("./utilities/keygen/keygen")),
  },
  {
    path: "/markdown",
    Icon: IconMarkdown,
    Component: lazy(() => import("./utilities/markdown/markdown")),
  },
  {
    path: "/mock",
    Icon: IconTestPipe,
    Component: lazy(() => import("./utilities/mock/mock")),
  },
  {
    path: "/otp",
    Icon: IconAuth2fa,
    Component: lazy(() => import("./utilities/otp/otp")),
  },
  {
    path: "/password",
    Icon: IconKey,
    Component: lazy(() => import("./utilities/password/password")),
  },
  {
    path: "/phone-number",
    Icon: IconPhone,
    Component: lazy(() => import("./utilities/phone-number/phone-number")),
  },
  {
    path: "/python",
    Icon: IconBrandPython,
    Component: lazy(() => import("./utilities/python/python")),
  },
  {
    path: "/qr-code",
    Icon: IconQrcode,
    Component: lazy(() => import("./utilities/qr-code/qr-code")),
  },
  {
    path: "/regex",
    Icon: IconRegex,
    Component: lazy(() => import("./utilities/regex/regex")),
  },
  {
    path: "/schema",
    Icon: IconSchema,
    Component: lazy(() => import("./utilities/schema/schema")),
  },
  {
    path: "/sql",
    Icon: IconDatabase,
    Component: lazy(() => import("./utilities/sql/sql")),
  },
  {
    path: "/string",
    Icon: IconLetterCase,
    Component: lazy(() => import("./utilities/string/string")),
  },
  {
    path: "/time",
    Icon: IconClock,
    Component: lazy(() => import("./utilities/time/time")),
  },
  {
    path: "/unicode",
    Icon: IconLanguage,
    Component: lazy(() => import("./utilities/unicode/unicode")),
  },
  {
    path: "/unique-id",
    Icon: IconId,
    Component: lazy(() => import("./utilities/unique-id/unique-id")),
  },
  {
    path: "/url",
    Icon: IconWorld,
    Component: lazy(() => import("./utilities/url/url")),
  },
];

export const utilities: Utility[] = routes.map((route) => ({ ...route, ...PAGE_META[route.path] }));

interface UtilityRoute {
  path: UtilityPath;
  Icon: TablerIcon;
  Component: LazyExoticComponent<ComponentType>;
}

export interface Utility extends UtilityRoute, PageMeta {}

export function randomUtility(excludePath?: string): Utility {
  const candidates = utilities.filter((utility) => utility.path !== excludePath);
  const pool = candidates.length > 0 ? candidates : utilities;
  return pool[Math.floor(Math.random() * pool.length)];
}
