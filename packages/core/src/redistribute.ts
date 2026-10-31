/**
 * Splits `total` seconds evenly into `parts` whole-second shares with the
 * largest-remainder method. With equal weights every share has the same
 * remainder, so the leftover seconds go one each to the earliest parts.
 * The shares always add up to `total`.
 */
export function splitEvenly(total: number, parts: number): number[] {
  if (parts <= 0) throw new RangeError("parts must be positive");
  const share = Math.floor(total / parts);
  const leftover = total - share * parts;
  return Array.from({ length: parts }, (_, i) => share + (i < leftover ? 1 : 0));
}

/**
 * Splits `total` seconds over parts in proportion to `weights`, giving no part more
 * than `cap`: parts whose share would exceed the cap get exactly the cap and the rest
 * is shared again among the others. Whole seconds; leftover seconds go to the largest
 * fractional remainders (earliest part on ties). All-zero weights mean an even split.
 * The shares add up to min(total, cap * parts).
 */
export function splitProportionally(total: number, weights: number[], cap: number): number[] {
  const shares = weights.map(() => 0);
  const w = weights.some((x) => x > 0) ? weights : weights.map(() => 1);
  let open = w.map((_, i) => i);
  let remaining = Math.min(total, cap * weights.length);

  for (;;) {
    const weightSum = open.reduce((sum, i) => sum + w[i]!, 0);
    const over = open.filter((i) => remaining * w[i]! >= cap * weightSum);
    if (over.length === 0 || weightSum === 0) break;
    for (const i of over) shares[i] = cap;
    remaining -= cap * over.length;
    open = open.filter((i) => !over.includes(i));
    if (open.length === 0) return shares;
  }

  const weightSum = open.reduce((sum, i) => sum + w[i]!, 0);
  const exact = open.map((i) => {
    const numerator = remaining * w[i]!;
    const quotient = Math.floor(numerator / weightSum);
    return { i, quotient, rest: numerator - quotient * weightSum };
  });
  let leftover = remaining - exact.reduce((sum, e) => sum + e.quotient, 0);
  for (const e of exact) shares[e.i] = e.quotient;
  for (const e of [...exact].sort((a, b) => b.rest - a.rest || a.i - b.i)) {
    if (leftover-- <= 0) break;
    shares[e.i]! += 1;
  }
  return shares;
}
