import { describe, it, expect } from "vitest";
import { enforceReadOnly } from "@/lib/mssql";

describe("enforceReadOnly", () => {
  it("allows SELECT queries", () => {
    const q = enforceReadOnly("SELECT * FROM dbo.Users");
    expect(q.toUpperCase().startsWith("SELECT") || q.toUpperCase().startsWith("WITH")).toBe(true);
  });

  it("allows CTE + SELECT", () => {
    const q = enforceReadOnly("WITH cte AS (SELECT 1 AS x) SELECT * FROM cte");
    expect(q.toUpperCase().includes("SELECT")).toBe(true);
  });

  it("rejects UPDATE", () => {
    expect(() => enforceReadOnly("UPDATE dbo.Users SET x=1")).toThrow();
  });

  it("rejects DELETE", () => {
    expect(() => enforceReadOnly("DELETE FROM dbo.Users")).toThrow();
  });

  it("rejects DDL", () => {
    expect(() => enforceReadOnly("DROP TABLE dbo.Users")).toThrow();
    expect(() => enforceReadOnly("ALTER TABLE dbo.Users ADD x INT")).toThrow();
  });
});
