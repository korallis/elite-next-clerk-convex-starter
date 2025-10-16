import { quoteIdentifier, formatTableName } from "@/lib/semantic";

describe("identifier quoting", () => {
  it("quotes simple identifiers", () => {
    expect(quoteIdentifier("Users")).toBe("[Users]");
  });
  it("escapes closing bracket", () => {
    expect(quoteIdentifier("A]B")).toBe("[A]]B]");
  });
  it("formats full table name", () => {
    expect(formatTableName("dbo", "Orders")).toBe("[dbo].[Orders]");
  });
});
