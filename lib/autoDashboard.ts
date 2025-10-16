export type AutoDashTile = { title: string; sql: string; chart?: unknown };

function normalizeSql(sql: string): string {
  return (sql || "").trim().replace(/;\s*$/g, "").replace(/\s+/g, " ").toLowerCase();
}

function normalizeTitle(title: string): string {
  return (title || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function dedupeAndLimitTiles(tiles: AutoDashTile[], limit = 8): AutoDashTile[] {
  const seenSql = new Set<string>();
  const seenTitle = new Set<string>();
  const out: AutoDashTile[] = [];
  for (const t of tiles || []) {
    const sqlKey = normalizeSql(t.sql);
    const titleKey = normalizeTitle(t.title);
    if (!sqlKey || seenSql.has(sqlKey)) continue;
    if (seenTitle.has(titleKey)) continue;
    seenSql.add(sqlKey);
    seenTitle.add(titleKey);
    out.push({ ...t, chart: t.chart ?? { type: "table" } });
    if (out.length >= limit) break;
  }
  return out;
}
