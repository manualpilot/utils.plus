import type { Language } from "./engine";

export const SAMPLES: Record<Language, string> = {
  javascript: `const now = new Date().toISOString();
const counts = Object.groupBy([1, 2, 3, 4, 5], (n) => (n % 2 ? "odd" : "even"));

console.log(\`Running at \${now}\`);
console.log(counts);
`,
  typescript: `interface Reading {
  label: string;
  value: number;
}

const readings: Reading[] = [
  { label: "first", value: 3 },
  { label: "second", value: 4 },
];

const total = readings.reduce((sum, reading) => sum + reading.value, 0);
console.log(\`\${readings.length} readings, \${total} in total\`);
`,
};
