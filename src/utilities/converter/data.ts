import type { Category } from "./unit";

export const DATA: Category = {
  id: "data",
  label: "Data",
  defaultUnit: "mb",
  units: [
    { id: "bit", name: "Bit", symbol: "b", factor: 0.125 },
    { id: "byte", name: "Byte", symbol: "B", factor: 1 },
    { id: "kbit", name: "Kilobit", symbol: "kbit", factor: 125 },
    { id: "kb", name: "Kilobyte", symbol: "kB", factor: 1e3 },
    { id: "kib", name: "Kibibyte", symbol: "KiB", factor: 1024 },
    { id: "mbit", name: "Megabit", symbol: "Mbit", factor: 125e3 },
    { id: "mb", name: "Megabyte", symbol: "MB", factor: 1e6 },
    { id: "mib", name: "Mebibyte", symbol: "MiB", factor: 1048576 },
    { id: "gbit", name: "Gigabit", symbol: "Gbit", factor: 125e6 },
    { id: "gb", name: "Gigabyte", symbol: "GB", factor: 1e9 },
    { id: "gib", name: "Gibibyte", symbol: "GiB", factor: 1073741824 },
    { id: "tb", name: "Terabyte", symbol: "TB", factor: 1e12 },
    { id: "tib", name: "Tebibyte", symbol: "TiB", factor: 1099511627776 },
    { id: "pb", name: "Petabyte", symbol: "PB", factor: 1e15 },
    { id: "pib", name: "Pebibyte", symbol: "PiB", factor: 1125899906842624 },
  ],
};
