import { describe, expect, it } from "vitest";
import { buildBoardAnnexData } from "./board-annex";
import type { BoardItem } from "./board-composer";

const marble: BoardItem = {
  materialId: 1,
  name: "Italian Marble",
  category: "stone",
  tier: "luxury",
  costLow: 300,
  costHigh: 500,
  costUnit: "AED/sqm",
  leadTimeDays: 60,
  leadTimeBand: "long",
  supplierName: "Supplier A",
};

const chandelier: BoardItem = {
  materialId: 2,
  name: "Custom Chandelier",
  category: "lighting",
  tier: "luxury",
  costLow: 5_000,
  costHigh: 15_000,
  costUnit: "AED/unit",
  leadTimeDays: 120,
  leadTimeBand: "critical",
  supplierName: "Supplier B",
};

describe("buildBoardAnnexData", () => {
  it("represents a successful scoped read with no boards", () => {
    expect(buildBoardAnnexData([])).toEqual({ state: "no_boards", boards: [] });
  });

  it("keeps an existing board with no linked items as an explicit empty board", () => {
    const result = buildBoardAnnexData([
      { boardName: "Unspecified Finishes", linkedItemCount: 0, resolvedItems: [] },
    ]);

    expect(result).toEqual({
      state: "available",
      boards: [{
        boardName: "Unspecified Finishes",
        state: "empty",
        linkedItemCount: 0,
        resolvedItemCount: 0,
        unresolvedItemCount: 0,
      }],
    });
    expect("summary" in result.boards[0]).toBe(false);
  });

  it("computes a complete summary when every linked item resolves", () => {
    const result = buildBoardAnnexData([
      { boardName: "Complete Board", linkedItemCount: 2, resolvedItems: [marble, chandelier] },
    ]);

    expect(result.state).toBe("available");
    const board = result.boards[0];
    expect(board).toMatchObject({
      state: "complete",
      linkedItemCount: 2,
      resolvedItemCount: 2,
      unresolvedItemCount: 0,
      summary: {
        totalItems: 2,
        estimatedCostLow: 5_300,
        estimatedCostHigh: 15_500,
        longestLeadTimeDays: 120,
        criticalPathItems: ["Custom Chandelier"],
      },
    });
  });

  it("computes a qualified summary from resolved items for a partial board", () => {
    const result = buildBoardAnnexData([
      { boardName: "Partial Board", linkedItemCount: 3, resolvedItems: [marble] },
    ]);

    expect(result.state).toBe("available");
    expect(result.boards[0]).toMatchObject({
      state: "partial",
      linkedItemCount: 3,
      resolvedItemCount: 1,
      unresolvedItemCount: 2,
      summary: {
        totalItems: 1,
        estimatedCostLow: 300,
        estimatedCostHigh: 500,
      },
    });
  });

  it("keeps a wholly unresolved existing board without a fake zero summary", () => {
    const result = buildBoardAnnexData([
      { boardName: "Broken Links", linkedItemCount: 2, resolvedItems: [] },
    ]);

    expect(result.state).toBe("available");
    expect(result.boards[0]).toEqual({
      boardName: "Broken Links",
      state: "unresolvable",
      linkedItemCount: 2,
      resolvedItemCount: 0,
      unresolvedItemCount: 2,
    });
    expect("summary" in result.boards[0]).toBe(false);
  });

  it("preserves board order while classifying each board independently", () => {
    const result = buildBoardAnnexData([
      { boardName: "Newest", linkedItemCount: 1, resolvedItems: [marble] },
      { boardName: "Older", linkedItemCount: 1, resolvedItems: [] },
    ]);

    expect(result.boards.map(board => board.boardName)).toEqual(["Newest", "Older"]);
    expect(result.boards.map(board => board.state)).toEqual(["complete", "unresolvable"]);
  });

  it("rejects impossible or unsafe linked-item counts", () => {
    expect(() => buildBoardAnnexData([
      { boardName: "Negative", linkedItemCount: -1, resolvedItems: [] },
    ])).toThrow("linkedItemCount must be a non-negative safe integer");
    expect(() => buildBoardAnnexData([
      { boardName: "Fractional", linkedItemCount: 1.5, resolvedItems: [] },
    ])).toThrow("linkedItemCount must be a non-negative safe integer");
    expect(() => buildBoardAnnexData([
      { boardName: "Impossible", linkedItemCount: 1, resolvedItems: [marble, chandelier] },
    ])).toThrow("resolved item count cannot exceed linked item count");
  });
});
