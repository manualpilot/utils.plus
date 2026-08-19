export const SAMPLE_PATTERN = "(?<year>\\d{4})-(?<month>\\d{2})-(?<day>\\d{2})";

export const SAMPLE_FLAGS = "g";

export const SAMPLE_TEXT = [
  "2024-01-15  deploy    utils.plus  ok",
  "2024-02-29  deploy    utils.plus  failed",
  "20240115    not a date, and not matched",
  "2025-12-31  rollback  utils.plus  ok",
].join("\n");
