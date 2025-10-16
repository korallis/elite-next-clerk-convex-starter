import { normalizeTableSelection } from "@/lib/dataSources";

describe("normalizeTableSelection", () => {
  it("deduplicates and normalizes included tables", () => {
    const result = normalizeTableSelection("include", ["dbo.Users", "dbo.users", " ", "Sales.Orders"], null);
    expect(result.mode).toBe("include");
    expect(result.selectedTables).toEqual(["dbo.Users", "Sales.Orders"]);
    expect(result.excludedTables).toBeUndefined();
  });

  it("falls back to include when mode omitted but selection provided", () => {
    const result = normalizeTableSelection(undefined, ["dbo.Customers"], null);
    expect(result.mode).toBe("include");
    expect(result.selectedTables).toEqual(["dbo.Customers"]);
  });

  it("respects exclude mode when provided", () => {
    const result = normalizeTableSelection("exclude", ["dbo.Log"], ["dbo.Log", "audit.Entries"]);
    expect(result.mode).toBe("exclude");
    expect(result.excludedTables).toEqual(["dbo.Log", "audit.Entries"]);
  });

  it("returns all when no selections available", () => {
    const result = normalizeTableSelection("include", [], []);
    expect(result.mode).toBe("all");
    expect(result.selectedTables).toBeUndefined();
    expect(result.excludedTables).toBeUndefined();
  });
});
