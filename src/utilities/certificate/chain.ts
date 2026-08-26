import type { Arrangement, Chain, ChainRow, Item, Match } from "./types";

export function arrange(items: Item[]): Arrangement {
  const certificates = items.filter((item) => item.kind === "certificate");
  const chains = buildChains(certificates);
  const ordered = chains.flatMap((chain) => chain.rows.map((row) => byId(items, row.id))).filter(exists);
  const placed = new Set(ordered.map((item) => item.id));

  return {
    items: [...ordered, ...items.filter((item) => !placed.has(item.id))],
    chains,
    matches: matchKeys(items),
  };
}

function buildChains(certificates: Item[]): Chain[] {
  if (certificates.length < 2) return [];

  const parents = new Map<string, Item>();
  for (const certificate of certificates) {
    const parent = certificates.find((other) => issued(other, certificate));
    if (parent) parents.set(certificate.id, parent);
  }

  const claimed = new Set([...parents.values()].map((parent) => parent.id));
  const leaves = certificates.filter((certificate) => !claimed.has(certificate.id));
  const chains: Chain[] = [];
  const seen = new Set<string>();

  for (const leaf of leaves) {
    const walked: Item[] = [];
    let current: Item | undefined = leaf;
    while (current && !walked.some((step) => step.id === current?.id)) {
      walked.push(current);
      seen.add(current.id);
      current = current.selfIssued ? undefined : parents.get(current.id);
    }
    chains.push(describe(walked, certificates));
  }

  const stranded = certificates.filter((certificate) => !seen.has(certificate.id));
  if (stranded.length > 0) chains.push(describe(stranded, certificates));

  return chains;
}

function issued(parent: Item, child: Item): boolean {
  if (parent.id === child.id || child.selfIssued) return false;
  if (parent.subject === "" || parent.subject !== child.issuer) return false;
  return child.aki === "" || parent.ski === "" || child.aki === parent.ski;
}

function describe(walked: Item[], certificates: Item[]): Chain {
  const complete = walked.length > 0 && walked[walked.length - 1].selfIssued;
  const positions = walked.map((item) => certificates.findIndex((other) => other.id === item.id));
  const ordered = positions.every((position, index) => index === 0 || position > positions[index - 1]);

  const rows: ChainRow[] = walked.map((item, index) => ({
    id: item.id,
    name: item.subject || item.name,
    role: role(index, walked.length, item.selfIssued),
    issue: index === walked.length - 1 && !item.selfIssued ? `Nothing here issued ${item.issuer}` : "",
  }));

  return {
    rows,
    ordered,
    complete,
    note: !ordered
      ? "Pasted out of order. A server has to send its chain leaf first, and this is that order."
      : complete
      ? ""
      : "This chain stops short of a self-signed root, which is what a trust store holds.",
  };
}

function role(index: number, length: number, selfIssued: boolean): string {
  if (index === 0) return selfIssued && length === 1 ? "Root" : "Leaf";
  if (index === length - 1 && selfIssued) return "Root";
  return "Intermediate";
}

function matchKeys(items: Item[]): Record<string, Match> {
  const matches: Record<string, Match> = {};
  const documents = items.filter((item) => item.kind === "certificate" || item.kind === "request");
  const keys = items.filter((item) => item.kind === "key");
  if (documents.length === 0 || keys.length === 0) return matches;

  for (const key of keys) {
    if (key.identity === "") continue;
    const partner = documents.find((document) => document.identity === key.identity);
    matches[key.id] = partner
      ? { text: `Matches ${partner.name || partner.heading.toLowerCase()}`, found: true }
      : { text: "Matches nothing here", found: false };
  }

  for (const document of documents) {
    if (document.identity === "") continue;
    const partner = keys.find((key) => key.identity === document.identity);
    if (partner) matches[document.id] = { text: `${partner.heading} matches`, found: true };
  }

  return matches;
}

function byId(items: Item[], id: string): Item | undefined {
  return items.find((item) => item.id === id);
}

function exists(item: Item | undefined): item is Item {
  return item !== undefined;
}
