import type { PageContent } from "../page-document.ts";

export default {
  related: ["/calculator", "/countries", "/url", "/curl"],
  howItWorks: [
    "One box takes the address and its prefix together, as `192.168.1.130/26`, and the prefix length field beside it rewrites the same text. From that the page works out the block: netmask, wildcard mask, network and broadcast addresses, first and last hosts, and how many addresses and usable hosts it holds. It writes the address every other way too: as an integer, in hexadecimal, in binary for IPv4, expanded for IPv6, as a reverse-DNS name, and as the IPv4 address inside a mapped, 6to4 or NAT64 one. A whole number, decimal or `0x`, is read as the address it stores, and an address of the other family switches the mode.",
    "Containment says whether another address or block lies inside this one, and at what offset. Split divides the block into equal narrower ones, counting them all and listing the first 64.",
    "IANA's special-purpose registries say what an address is for, taking the narrowest match, so `255.255.255.255` is the limited broadcast rather than the reserved `240.0.0.0/4` around it. Below that come three downloaded publications: IANA's allocation tables for the registry that administers the block, the five RIRs' delegation statistics for which of them delegated it, when, and under which country, and the validated RPKI route origin authorisations (ROAs) for which AS may originate it. A block IANA set aside, such as private, shared, loopback or documentation space, is named on the Registry card with its RFC in place of the registry that administers the space around it, since none administers the block itself. An AS mode looks up autonomous system numbers in IANA's table and the delegation statistics.",
    "Those files are read when the site is built and served from it, so no lookup goes to a registry, and they are only as current as that build, whose date the mark beside the title gives. The holder's name is not shown: the statistics carry none, and the page makes no whois query.",
  ],
  examples: [
    {
      title: "The block around a private address",
      blocks: [
        { code: "192.168.1.130/26" },
        {
          code:
            "CIDR             192.168.1.128/26\nNetmask          255.255.255.192\nWildcard         0.0.0.63\nNetwork          192.168.1.128\nBroadcast        192.168.1.191\nFirst host       192.168.1.129\nLast host        192.168.1.190\nUsable hosts     62\nTotal addresses  64",
        },
        "The address is a usable host in Private-Use space from RFC 1918, badged Not routed on the internet. Its integer is 3232235906, and pasting that number into the box gives 192.168.1.130 back.",
      ],
    },
    {
      title: "What the registries say about 8.8.8.8",
      blocks: [
        {
          code:
            "Administered by  Administered by ARIN\nIANA block       8.0.0.0/8\nIANA status      LEGACY\nDelegated to     ARIN\nCountry          US\nDelegated        2023-12-28\nDelegated block  8.8.8.0 – 8.8.8.255\n\nRoute origin     8.8.8.0/24   up to /24   AS15169",
        },
        "From a build carrying the RIR statistics and the ROAs of 10 September 2026. IANA's row is about the whole /8, the delegation is the /24 around the address, and the ROA says AS15169 may originate 8.8.8.0/24 and nothing more specific.",
      ],
    },
    {
      title: "Splitting an IPv6 /48 into /64s",
      blocks: [
        { code: "2001:db8:abcd::/48   into blocks of /64" },
        {
          code:
            "65,536 blocks of /64, of which the first 64 are listed\n2001:db8:abcd::/64\n2001:db8:abcd:1::/64\n2001:db8:abcd:2::/64\n…\n2001:db8:abcd:3f::/64",
        },
        "Each /64 holds 18,446,744,073,709,551,616 addresses. IPv6 has no broadcast address, so the page gives the total and no usable count.",
      ],
    },
  ],
  problems: [
    {
      title: "“Host bits set”",
      blocks: [
        "`10.1.2.3/8` is an address with a prefix, not a network. Python's `ipaddress.ip_network` refuses it with “has host bits set”, as do other tools that expect a network. Here the address stays 10.1.2.3 and the block is shown as `10.0.0.0/8`; copy that form wherever a network is asked for.",
      ],
    },
    {
      title: "Usable hosts is not always the total less two",
      blocks: [
        "An IPv4 block gives up its network and broadcast addresses, so a /24 has 254 usable hosts. A /31 is the exception from RFC 3021: a point-to-point link needs neither, so both addresses are usable. A /32 is a single address.",
      ],
    },
    {
      title: "Leading zeros",
      blocks: [
        "`010.0.0.1` is refused. The C library's `inet_aton` reads a leading zero as octal and makes it 8.0.0.1, while others read it as ten, and a firewall rule that means one thing to one tool and another to the next is worse than an error.",
      ],
    },
    {
      title: "No ROA published",
      blocks: [
        "An address with no ROA is in the NotFound state of RFC 6811, not Invalid: nobody has signed for the prefix, so route origin validation has nothing to say. Invalid means a ROA exists and the announcing AS or the prefix length does not fit it.",
      ],
    },
  ],
  faq: [
    {
      question: "Which registry administers 192.168.1.130?",
      answer:
        "None. IANA's table of /8 blocks gives 192.0.0.0/8 as a whole to ARIN, but the 192.168.0.0/16 inside it is set aside for private use by RFC 1918, so the Registry card names that block and its RFC instead. Loopback, link-local, `100.64.0.0/10`, the documentation ranges, `fc00::/7` and multicast read the same way, and nothing in any of them was delegated.",
    },
    {
      question: "Does the page show where an address is?",
      answer:
        "No. The country is the ISO 3166 code the regional registry recorded the delegation under, which the [country lookup](/countries) will spell out, and not where the address is used or routed. Geolocation databases guess that from other evidence, and this page reads none of them.",
    },
    {
      question: "How do I convert an IP address to an integer?",
      answer:
        "Paste the address and read the Integer row: 192.168.1.130 is 3232235906, and `2001:db8::1` is 42540766411282592856903984951653826561. The box also works the other way, reading a decimal or `0x` number as the address it stores, which is how databases often hold them.",
    },
  ],
  references: [
    { title: "RFC 4632: Classless Inter-Domain Routing (CIDR)", url: "https://www.rfc-editor.org/rfc/rfc4632" },
    {
      title: "RFC 5952: Recommendation for IPv6 address text representation",
      url: "https://www.rfc-editor.org/rfc/rfc5952",
    },
    {
      title: "RFC 3021: Using 31-bit prefixes on IPv4 point-to-point links",
      url: "https://www.rfc-editor.org/rfc/rfc3021",
    },
    {
      title: "IANA IPv4 Special-Purpose Address Registry",
      url: "https://www.iana.org/assignments/iana-ipv4-special-registry/iana-ipv4-special-registry.xhtml",
    },
    { title: "RFC 6811: BGP prefix origin validation", url: "https://www.rfc-editor.org/rfc/rfc6811" },
    { title: "NRO: RIR statistics", url: "https://www.nro.net/about/rirs/statistics/" },
  ],
} satisfies PageContent;
