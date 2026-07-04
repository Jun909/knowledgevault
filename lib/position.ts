// Fractional-indexing helper: pick a value strictly between two neighboring
// positions so an item can be inserted without renumbering its siblings.
export function positionBetween(
  before: number | null | undefined,
  after: number | null | undefined
): number {
  if (before == null && after == null) return 0;
  if (before == null) return after! - 1;
  if (after == null) return before! + 1;
  return (before + after) / 2;
}
