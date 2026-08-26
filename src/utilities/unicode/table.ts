export interface RangeTable {
  values: string[];
  runs: string;
}

export function valueAt(table: RangeTable, code: number): string {
  const { starts, indexes } = decoded(table);
  let low = 0;
  let high = starts.length - 1;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (starts[middle] <= code) low = middle;
    else high = middle - 1;
  }
  return table.values[indexes[low]];
}

export function spansOf(table: RangeTable): Span[] {
  const { starts, indexes } = decoded(table);
  return [...starts].map((start, at) => ({
    value: table.values[indexes[at]],
    start,
    end: at + 1 < starts.length ? starts[at + 1] - 1 : 0x10FFFF,
  }));
}

export interface Span {
  value: string;
  start: number;
  end: number;
}

interface Decoded {
  starts: Int32Array;
  indexes: Uint16Array;
}

const readings = new Map<RangeTable, Decoded>();

function decoded(table: RangeTable): Decoded {
  const held = readings.get(table);
  if (held) return held;

  const runs = table.runs.split(" ");
  const reading: Decoded = { starts: new Int32Array(runs.length), indexes: new Uint16Array(runs.length) };
  let start = 0;
  for (const [at, run] of runs.entries()) {
    const [delta, index] = run.split(".");
    start += Number.parseInt(delta, 36);
    reading.starts[at] = start;
    reading.indexes[at] = Number.parseInt(index, 36);
  }

  readings.set(table, reading);
  return reading;
}
