export function composition<K extends string>(length: number, weights: Record<K, number>): Record<K, number> {
  const keys = Object.keys(weights) as K[];
  const counts = Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
  const shares = keys.map((key) => ({ key, weight: Math.max(0, weights[key]) }));
  const total = shares.reduce((sum, { weight }) => sum + weight, 0);
  if (length <= 0 || total <= 0) return counts;

  const exact = shares.map(({ key, weight }) => ({ key, value: (length * weight) / total }));
  for (const { key, value } of exact) counts[key] = Math.floor(value);

  let remaining = length - keys.reduce((sum, key) => sum + counts[key], 0);
  const byRemainder = exact.filter(({ value }) => value > 0).sort((a, b) => (b.value % 1) - (a.value % 1));
  for (let i = 0; remaining > 0 && byRemainder.length > 0; i++) {
    counts[byRemainder[i % byRemainder.length].key] += 1;
    remaining -= 1;
  }
  return counts;
}
