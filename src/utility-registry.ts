import type { TablerIcon } from "@tabler/icons-react";
import { IconArrowsExchange, IconAuth2fa, IconBinary, IconBrackets, IconBrandJavascript, IconBrandPython, IconCalculator, IconCalendarRepeat, IconCertificate, IconClock, IconDatabase, IconFileCertificate, IconFileDigit, IconFileSettings, IconFileTypeCsv, IconFileTypeDocx, IconFileTypePdf, IconFlag, IconGitCompare, IconHash, IconId, IconKey, IconLanguage, IconLetterCase, IconLock, IconMarkdown, IconNetwork, IconPalette, IconPhone, IconPhoto, IconQrcode, IconRegex, IconRulerMeasure, IconSchema, IconShieldLock, IconTerminal2, IconTestPipe, IconWorld } from "./icons";
import { PAGE_META, type PageMeta, type UtilityPath } from "./page-meta";

export { ATTRIBUTIONS_PATH } from "./page-meta";

const routes: UtilityRoute[] = [
  { path: "/calculator", Icon: IconCalculator },
  { path: "/certificate", Icon: IconFileCertificate },
  { path: "/codec", Icon: IconBinary },
  { path: "/colour", Icon: IconPalette },
  { path: "/config", Icon: IconFileSettings },
  { path: "/converter", Icon: IconRulerMeasure },
  { path: "/countries", Icon: IconFlag },
  { path: "/cron", Icon: IconCalendarRepeat },
  { path: "/cryptography", Icon: IconLock },
  { path: "/csv", Icon: IconFileTypeCsv },
  { path: "/curl", Icon: IconTerminal2 },
  { path: "/diff", Icon: IconGitCompare },
  { path: "/docx", Icon: IconFileTypeDocx },
  { path: "/har", Icon: IconArrowsExchange },
  { path: "/hasher", Icon: IconHash },
  { path: "/hex", Icon: IconFileDigit },
  { path: "/image", Icon: IconPhoto },
  { path: "/ip-address", Icon: IconNetwork },
  { path: "/javascript", Icon: IconBrandJavascript },
  { path: "/json", Icon: IconBrackets },
  { path: "/jwt", Icon: IconShieldLock },
  { path: "/keygen", Icon: IconCertificate },
  { path: "/markdown", Icon: IconMarkdown },
  { path: "/mock", Icon: IconTestPipe },
  { path: "/otp", Icon: IconAuth2fa },
  { path: "/password", Icon: IconKey },
  { path: "/pdf", Icon: IconFileTypePdf },
  { path: "/phone-number", Icon: IconPhone },
  { path: "/python", Icon: IconBrandPython },
  { path: "/qr-code", Icon: IconQrcode },
  { path: "/regex", Icon: IconRegex },
  { path: "/schema", Icon: IconSchema },
  { path: "/sql", Icon: IconDatabase },
  { path: "/string", Icon: IconLetterCase },
  { path: "/time", Icon: IconClock },
  { path: "/unicode", Icon: IconLanguage },
  { path: "/unique-id", Icon: IconId },
  { path: "/url", Icon: IconWorld },
];

export const utilities: Utility[] = routes.map((route) => ({ ...route, ...PAGE_META[route.path] }));

interface UtilityRoute {
  path: UtilityPath;
  Icon: TablerIcon;
}

export interface Utility extends UtilityRoute, PageMeta {}

export function randomUtility(excludePath?: string): Utility {
  const candidates = utilities.filter((utility) => utility.path !== excludePath);
  const pool = candidates.length > 0 ? candidates : utilities;
  return pool[Math.floor(Math.random() * pool.length)];
}
