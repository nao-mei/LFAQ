export type Rand = () => number;

/** Uniform float in [0, 1) from the browser's crypto source (falls back to Math.random). */
export const secureRandom: Rand = () => {
  const c = globalThis.crypto;
  if (c?.getRandomValues) {
    const a = new Uint32Array(1);
    c.getRandomValues(a);
    return a[0]! / 2 ** 32;
  }
  return Math.random();
};

/** Pick an index, weighted. Weights default to 1; zero or negative weights are never picked. */
export function pickIndex(weights: number[], rand: Rand = secureRandom): number {
  const w = weights.map((x) => (x > 0 ? x : 0));
  const total = w.reduce((a, b) => a + b, 0);
  if (total <= 0) return Math.floor(rand() * weights.length);
  let r = rand() * total;
  for (let i = 0; i < w.length; i++) {
    r -= w[i]!;
    if (r < 0) return i;
  }
  return w.length - 1;
}

/** Angular size of each segment (degrees), proportional to weight, so bigger weight = bigger slice. */
export function segmentSizes(weights: number[]): number[] {
  const w = weights.map((x) => (x > 0 ? x : 0));
  const total = w.reduce((a, b) => a + b, 0);
  if (total <= 0) return w.map(() => 360 / (w.length || 1));
  return w.map((x) => (360 * x) / total);
}

/**
 * New total rotation (degrees, clockwise) so that segment `index` ends up under a pointer at the top.
 * `jitter` in [-1, 1] moves the stop point within the slice (kept away from the edges).
 */
export function landingRotation(
  sizes: number[],
  index: number,
  current: number,
  spins = 5,
  jitter = 0,
): number {
  const start = sizes.slice(0, index).reduce((a, b) => a + b, 0);
  const size = sizes[index]!;
  const stop = start + size / 2 + jitter * size * 0.38;
  const delta = (((-stop - current) % 360) + 360) % 360;
  return current + spins * 360 + delta;
}

/** Which segment is under the top pointer for a given rotation. Used by tests to prove landing is correct. */
export function segmentAt(sizes: number[], rotation: number): number {
  const a = (((-rotation) % 360) + 360) % 360;
  let acc = 0;
  for (let i = 0; i < sizes.length; i++) {
    acc += sizes[i]!;
    if (a < acc) return i;
  }
  return sizes.length - 1;
}
