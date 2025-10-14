import { describe, it, expect } from "vitest";
import { shouldSampleColumn } from "@/lib/semantic";

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
});
