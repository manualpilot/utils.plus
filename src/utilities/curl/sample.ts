export const SAMPLE_COMMAND = [
  "curl https://httpbin.org/post \\",
  "  -X POST \\",
  "  -H 'Content-Type: application/json' \\",
  "  -H 'Authorization: Bearer s3cr3t' \\",
  "  -d '{\"name\":\"widget\",\"quantity\":3}' \\",
  "  --compressed \\",
  "  -sS",
].join("\n");
