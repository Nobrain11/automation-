export function clamp(
  value: number,
  min: number,
  max: number
): number {
  return Math.min(
    max,
    Math.max(min, value)
  );
}

export function finiteOrNull(
  value: unknown
): number | null {
  const n = Number(value);

  return Number.isFinite(n)
    ? n
    : null;
}

export function round(
  value: number,
  decimals = 4
): number {
  const multiplier =
    10 ** decimals;

  return (
    Math.round(
      value * multiplier
    ) / multiplier
  );
}
