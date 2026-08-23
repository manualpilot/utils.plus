import { AUTO, CANDIDATES } from "./delimiters";

export interface CsvTable {
  columns: string[];
  rows: string[][];
  delimiter: string;
  ragged: number;
  unterminated: boolean;
}

export function readCsv(text: string, choice: string, header: boolean): CsvTable {
  const delimiter = choice === AUTO ? sniffDelimiter(text) : choice;
  const { records, unterminated } = parseRecords(text, delimiter);

  const width = records.reduce((most, record) => Math.max(most, record.length), 0);
  const titles = header ? records[0] ?? [] : [];
  const rows = header ? records.slice(1) : records;

  return {
    columns: Array.from({ length: width }, (_, at) => columnTitle(titles[at], at)),
    rows,
    delimiter,
    ragged: rows.filter((row) => row.length !== width).length,
    unterminated,
  };
}

export function columnTitle(name: string | undefined, at: number): string {
  return name?.trim() || `Column ${at + 1}`;
}

export function parseRecords(text: string, delimiter: string): CsvRecords {
  const body = text.charCodeAt(0) === BOM ? text.slice(1) : text;
  const records: string[][] = [];

  let record: string[] = [];
  let field = "";
  let quoted = false;
  let inQuotes = false;
  let at = 0;

  const endRecord = () => {
    record.push(field);
    field = "";
    if (record.length > 1 || record[0] !== "" || quoted) records.push(record);
    record = [];
    quoted = false;
  };

  while (at < body.length) {
    const char = body[at];

    if (inQuotes) {
      if (char !== "\"") {
        field += char;
        at++;
      } else if (body[at + 1] === "\"") {
        field += "\"";
        at += 2;
      } else {
        inQuotes = false;
        at++;
      }
      continue;
    }

    if (char === "\"" && field === "") {
      inQuotes = true;
      quoted = true;
      at++;
    } else if (char === delimiter) {
      record.push(field);
      field = "";
      at++;
    } else if (char === "\n" || char === "\r") {
      endRecord();
      at += char === "\r" && body[at + 1] === "\n" ? 2 : 1;
    } else {
      field += char;
      at++;
    }
  }

  if (field !== "" || record.length > 0 || inQuotes || quoted) endRecord();

  return { records, unterminated: inQuotes };
}

export interface CsvRecords {
  records: string[][];
  unterminated: boolean;
}

export function sniffDelimiter(text: string): string {
  const head = text.slice(0, SNIFF_LIMIT);
  let best = CANDIDATES[0];
  let score = 0;

  for (const candidate of CANDIDATES) {
    const records = parseRecords(head, candidate).records.slice(0, SNIFF_ROWS);
    if (records.length === 0) continue;

    const width = records[0].length;
    if (width < 2) continue;

    const even = records.every((record) => record.length === width);
    const candidateScore = even ? EVEN_SPLIT + width : width;
    if (candidateScore > score) {
      best = candidate;
      score = candidateScore;
    }
  }

  return best;
}

const BOM = 0xfeff;

const SNIFF_LIMIT = 64 * 1024;
const SNIFF_ROWS = 20;

const EVEN_SPLIT = 1000;
