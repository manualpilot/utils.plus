import { type Address, BITS, type Family, parseAddress } from "./parse";

export type Reach = "global" | "private" | "special";

export interface Special {
  cidr: string;
  name: string;
  rfc: string;
  reach: Reach;
}

const IPV4: Special[] = [
  { cidr: "0.0.0.0/8", name: "This network", rfc: "RFC 791", reach: "special" },
  { cidr: "0.0.0.0/32", name: "This host on this network", rfc: "RFC 1122", reach: "special" },
  { cidr: "10.0.0.0/8", name: "Private-Use", rfc: "RFC 1918", reach: "private" },
  { cidr: "100.64.0.0/10", name: "Shared Address Space", rfc: "RFC 6598", reach: "private" },
  { cidr: "127.0.0.0/8", name: "Loopback", rfc: "RFC 1122", reach: "special" },
  { cidr: "169.254.0.0/16", name: "Link Local", rfc: "RFC 3927", reach: "special" },
  { cidr: "172.16.0.0/12", name: "Private-Use", rfc: "RFC 1918", reach: "private" },
  { cidr: "192.0.0.0/24", name: "IETF Protocol Assignments", rfc: "RFC 6890", reach: "special" },
  { cidr: "192.0.0.0/29", name: "DS-Lite", rfc: "RFC 7335", reach: "special" },
  { cidr: "192.0.0.170/31", name: "NAT64/DNS64 Discovery", rfc: "RFC 8880", reach: "special" },
  { cidr: "192.0.2.0/24", name: "Documentation (TEST-NET-1)", rfc: "RFC 5737", reach: "special" },
  { cidr: "192.31.196.0/24", name: "AS112-v4", rfc: "RFC 7535", reach: "global" },
  { cidr: "192.52.193.0/24", name: "AMT", rfc: "RFC 7450", reach: "global" },
  { cidr: "192.88.99.0/24", name: "6to4 Relay Anycast", rfc: "RFC 7526", reach: "special" },
  { cidr: "192.168.0.0/16", name: "Private-Use", rfc: "RFC 1918", reach: "private" },
  { cidr: "192.175.48.0/24", name: "Direct Delegation AS112", rfc: "RFC 7534", reach: "global" },
  { cidr: "198.18.0.0/15", name: "Benchmarking", rfc: "RFC 2544", reach: "special" },
  { cidr: "198.51.100.0/24", name: "Documentation (TEST-NET-2)", rfc: "RFC 5737", reach: "special" },
  { cidr: "203.0.113.0/24", name: "Documentation (TEST-NET-3)", rfc: "RFC 5737", reach: "special" },
  { cidr: "224.0.0.0/4", name: "Multicast", rfc: "RFC 5771", reach: "special" },
  { cidr: "233.252.0.0/24", name: "MCAST-TEST-NET", rfc: "RFC 5771", reach: "special" },
  { cidr: "240.0.0.0/4", name: "Reserved for future use", rfc: "RFC 1112", reach: "special" },
  { cidr: "255.255.255.255/32", name: "Limited Broadcast", rfc: "RFC 8190", reach: "special" },
];

const IPV6: Special[] = [
  { cidr: "::/128", name: "Unspecified", rfc: "RFC 4291", reach: "special" },
  { cidr: "::1/128", name: "Loopback", rfc: "RFC 4291", reach: "special" },
  { cidr: "::ffff:0:0/96", name: "IPv4-Mapped", rfc: "RFC 4291", reach: "special" },
  { cidr: "64:ff9b::/96", name: "IPv4-IPv6 Translation", rfc: "RFC 6052", reach: "global" },
  { cidr: "64:ff9b:1::/48", name: "IPv4-IPv6 Translation (local)", rfc: "RFC 8215", reach: "special" },
  { cidr: "100::/64", name: "Discard-Only", rfc: "RFC 6666", reach: "special" },
  { cidr: "2000::/3", name: "Global Unicast", rfc: "RFC 4291", reach: "global" },
  { cidr: "2001::/23", name: "IETF Protocol Assignments", rfc: "RFC 2928", reach: "special" },
  { cidr: "2001::/32", name: "TEREDO", rfc: "RFC 4380", reach: "special" },
  { cidr: "2001:1::1/128", name: "Port Control Protocol Anycast", rfc: "RFC 7723", reach: "global" },
  { cidr: "2001:1::2/128", name: "TURN Anycast", rfc: "RFC 8155", reach: "global" },
  { cidr: "2001:2::/48", name: "Benchmarking", rfc: "RFC 5180", reach: "special" },
  { cidr: "2001:3::/32", name: "AMT", rfc: "RFC 7450", reach: "global" },
  { cidr: "2001:4:112::/48", name: "AS112-v6", rfc: "RFC 7535", reach: "global" },
  { cidr: "2001:20::/28", name: "ORCHIDv2", rfc: "RFC 7343", reach: "special" },
  { cidr: "2001:30::/28", name: "Drone Remote ID", rfc: "RFC 9374", reach: "global" },
  { cidr: "2001:db8::/32", name: "Documentation", rfc: "RFC 3849", reach: "special" },
  { cidr: "2002::/16", name: "6to4", rfc: "RFC 3056", reach: "special" },
  { cidr: "2620:4f:8000::/48", name: "Direct Delegation AS112", rfc: "RFC 7534", reach: "global" },
  { cidr: "3fff::/20", name: "Documentation", rfc: "RFC 9637", reach: "special" },
  { cidr: "5f00::/16", name: "Segment Routing SIDs", rfc: "RFC 9602", reach: "special" },
  { cidr: "fc00::/7", name: "Unique Local", rfc: "RFC 4193", reach: "private" },
  { cidr: "fe80::/10", name: "Link-Local Unicast", rfc: "RFC 4291", reach: "special" },
  { cidr: "ff00::/8", name: "Multicast", rfc: "RFC 4291", reach: "special" },
];

const UNREGISTERED: Record<Family, Special> = {
  ipv4: { cidr: "0.0.0.0/0", name: "Global unicast", rfc: "RFC 1122", reach: "global" },
  ipv6: { cidr: "::/0", name: "Unassigned", rfc: "RFC 4291", reach: "special" },
};

export function classify({ family, value }: Address): Special {
  for (const range of RANGES[family]) {
    if (value >= range.start && value <= range.end) return range.special;
  }
  return UNREGISTERED[family];
}

export const REACH_COLOUR: Record<Reach, string> = { global: "teal", private: "blue", special: "orange" };

export const REACH_LABEL: Record<Reach, string> = {
  global: "Globally routable",
  private: "Not routed on the internet",
  special: "Special purpose",
};

interface Range {
  start: bigint;
  end: bigint;
  special: Special;
}

function ranges(family: Family, specials: Special[]): Range[] {
  return specials
    .map((special) => {
      const [body, width] = special.cidr.split("/");
      const address = parseAddress(body, family);
      if (address === null) throw new Error(`Not a ${family} address: ${special.cidr}`);
      const prefix = Number(width);
      const start = address.value & (((1n << BigInt(prefix)) - 1n) << BigInt(BITS[family] - prefix));
      return { start, end: start + (1n << BigInt(BITS[family] - prefix)) - 1n, special, prefix };
    })
    .sort((left, right) => right.prefix - left.prefix);
}

const RANGES: Record<Family, Range[]> = { ipv4: ranges("ipv4", IPV4), ipv6: ranges("ipv6", IPV6) };
