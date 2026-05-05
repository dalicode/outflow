import { describe, it, expect } from "vitest";
import type { Payee } from "../types";
import {
  findBestImportPayeeMatch,
  getImportPayeeMatchSummary,
} from "../utils/importPayeeMatching";

describe("importPayeeMatching", () => {
  const payees: Payee[] = [
    { id: 1, name: "Costco" },
    { id: 2, name: "Amazon Fresh", aliases: ["Amazon Fresh Canada"] },
    { id: 3, name: "Amazon" },
  ];

  it("finds a confident match for a clear merchant", () => {
    const match = findBestImportPayeeMatch("Costco Wholesale", payees, "r1");
    expect(match?.confidence).toBe("confident");
    expect(match?.suggestedPayeeName).toBe("Costco");
  });

  it("marks close matches as needing review", () => {
    const match = findBestImportPayeeMatch("Amazon Fresh", payees, "r2");
    expect(match?.confidence).toBe("needs_review");
  });

  it("returns no match for an unrelated description", () => {
    const match = findBestImportPayeeMatch("Random Merchant", payees, "r3");
    expect(match?.confidence).toBe("no_match");
  });

  it("summarizes rows correctly", () => {
    const summary = getImportPayeeMatchSummary(
      [
        { rowId: "r1", description: "Costco Wholesale" },
        { rowId: "r2", description: "Amazon Fresh" },
        { rowId: "r3", description: "Random Merchant" },
      ],
      payees,
    );

    expect(summary.rowsFound).toBe(3);
    expect(summary.likelyPayeesFound).toBe(2);
    expect(summary.confidentMatches).toBe(1);
    expect(summary.uncertainMatches).toBe(1);
    expect(summary.unmatchedExpenses).toBe(1);
  });
});
