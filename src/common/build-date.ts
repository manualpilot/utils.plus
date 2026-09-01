declare const __BUILD_TIME__: string;

export const BUILD_DATE = `${__BUILD_TIME__.slice(0, 16).replace("T", " ")} UTC`;

export function currentAsOf(publications: string): string {
  return `Read from ${publications} when the site was built. Current as of ${BUILD_DATE}.`;
}
