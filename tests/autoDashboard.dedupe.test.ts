import { describe, it, expect } from "vitest";
// Placeholder test to ensure file picked up; real planner tests will be added later

describe("auto-dashboard scaffolding", () => {
  it("works", () => {
    expect(true).toBe(true);
  });
});

import { dedupeAndLimitTiles } from "@/lib/autoDashboard";

describe("dedupeAndLimitTiles", () => {
  it("removes duplicate SQL and titles and limits count", () => {
    const tiles = [
      { title: "Revenue by month", sql: "SELECT * FROM rev;" },
      { title: "Revenue by month ", sql: " select  *  from  rev ; " },
      { title: "Orders", sql: "SELECT * FROM orders;" },
      { title: "Orders", sql: "SELECT * FROM orders;" },
      { title: "Customers", sql: "SELECT id, name FROM customers;" },
    ];
    const out = dedupeAndLimitTiles(tiles, 2);
    expect(out.length).toBe(2);
    expect(out[0].title.toLowerCase()).toContain("revenue");
    expect(out[1].title.toLowerCase()).toContain("orders");
  });
});
