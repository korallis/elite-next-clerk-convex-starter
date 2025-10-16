export type VectorHit = { id: string; score: number };

export type TableArtifactLite = {
  artifactKey: string; // "schema.table"
};

/**
 * Convert vector hits of form:
 *  - table:schema.table
 *  - column:schema.table.column
 * into aggregated table scores keyed by "schema.table".
 */
export function aggregateTableScoresFromHits(hits: VectorHit[]): Map<string, number> {
  const tableScores = new Map<string, number>();
  for (const h of hits) {
    if (!h?.id || typeof h.score !== "number") continue;
    if (h.id.startsWith("table:")) {
      const key = h.id.slice("table:".length);
      if (key) tableScores.set(key, (tableScores.get(key) || 0) + h.score);
    } else if (h.id.startsWith("column:")) {
      const rest = h.id.slice("column:".length);
      // Expect schema.table.column; derive schema.table
      const parts = rest.split(".");
      if (parts.length >= 3) {
        const tableKey = `${parts[0]}.${parts[1]}`;
        tableScores.set(tableKey, (tableScores.get(tableKey) || 0) + h.score);
      }
    }
  }
  return tableScores;
}

/**
 * Rank provided tables by aggregated scores, return top N where score>0.
 * Falls back to empty list if no positive scores.
 */
export function rankTablesFromHits(
  hits: VectorHit[],
  tables: TableArtifactLite[],
  topN = 5
): TableArtifactLite[] {
  const agg = aggregateTableScoresFromHits(hits);
  if (agg.size === 0) return [];
  const ranked = tables
    .map((t) => ({ t, s: agg.get(t.artifactKey) || 0 }))
    .filter((e) => e.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, Math.max(1, topN))
    .map((e) => e.t);
  return ranked;
}
