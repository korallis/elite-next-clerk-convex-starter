import { shouldSampleColumn } from "@/lib/semantic";
import { aggregateTableScoresFromHits, rankTablesFromHits } from "@/lib/retrieval";

describe("shouldSampleColumn", () => {
  const mk = (data_type: string) => ({
    schema: "dbo",
    table_name: "T",
    name: "C",
    data_type,
    is_nullable: "YES" as const,
    max_length: 100,
    numeric_precision: null,
    numeric_scale: null,
    is_identity: 0,
  });

  it("samples text-like types", () => {
    ["varchar", "nvarchar", "char", "nchar", "text", "ntext", "uniqueidentifier"].forEach((t) => {
      expect(shouldSampleColumn(mk(t))).toBe(true);
    });
  });

  it("skips numeric types", () => {
    ["int", "bigint", "float", "decimal"].forEach((t) => {
      expect(shouldSampleColumn(mk(t))).toBe(false);
    });
  });

  it("aggregates hits: column boosts owning table", () => {
    const hits = [
      { id: "column:dbo.can_candidates.status", score: 0.8 },
      { id: "table:dbo.awr_clock", score: 0.4 },
      { id: "column:dbo.can_candidate_status.name", score: 0.9 },
    ];
    const agg = aggregateTableScoresFromHits(hits as any);
    expect(agg.get("dbo.can_candidates")).toBeCloseTo(0.8, 4);
    expect(agg.get("dbo.can_candidate_status")).toBeCloseTo(0.9, 4);
    expect(agg.get("dbo.awr_clock")).toBeCloseTo(0.4, 4);

    const tables = [
      { artifactKey: "dbo.can_candidates" },
      { artifactKey: "dbo.can_candidate_status" },
      { artifactKey: "dbo.awr_clock" },
    ];
    const ranked = rankTablesFromHits(hits as any, tables as any, 5);
    expect(ranked[0].artifactKey).toBe("dbo.can_candidate_status");
    expect(ranked[1].artifactKey).toBe("dbo.can_candidates");
  });
});
