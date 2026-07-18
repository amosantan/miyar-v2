import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { revokeAiDesignBriefSharesForProjectForOrgInDatabase } from "./db";

const database = vi.hoisted(() => {
  const state = {
    ownedRows: [{ id: 11 }] as Array<{ id: number }>,
    affectedRows: 0,
    updateValues: undefined as unknown,
  };

  const selectBuilder: Record<string, ReturnType<typeof vi.fn>> = {};
  selectBuilder.from = vi.fn(() => selectBuilder);
  selectBuilder.where = vi.fn(() => selectBuilder);
  selectBuilder.limit = vi.fn(() => selectBuilder);
  selectBuilder.for = vi.fn(async () => state.ownedRows);

  const updateWhere = vi.fn(async () => [{ affectedRows: state.affectedRows }]);
  const updateSet = vi.fn((values: unknown) => {
    state.updateValues = values;
    return { where: updateWhere };
  });
  const tx = {
    select: vi.fn(() => selectBuilder),
    update: vi.fn(() => ({ set: updateSet })),
  };
  const transaction = vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx));
  const db = { transaction } as unknown as MySql2Database;

  return {
    state,
    selectBuilder,
    updateWhere,
    updateSet,
    tx,
    transaction,
    db,
  };
});

describe("revokeAiDesignBriefSharesForProjectForOrg", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    database.state.ownedRows = [{ id: 11 }];
    database.state.affectedRows = 0;
    database.state.updateValues = undefined;
  });

  it("locks the organization-owned project and atomically clears every issued token", async () => {
    database.state.affectedRows = 3;

    await expect(revokeAiDesignBriefSharesForProjectForOrgInDatabase(
      database.db,
      11,
      101,
    ))
      .resolves.toEqual({ revokedCount: 3 });

    expect(database.transaction).toHaveBeenCalledTimes(1);
    expect(database.selectBuilder.for).toHaveBeenCalledWith("update");
    expect(database.tx.update).toHaveBeenCalledTimes(2);
    expect(database.updateSet).toHaveBeenNthCalledWith(1, {
      shareExpiresAt: null,
    });
    expect(database.updateSet).toHaveBeenNthCalledWith(2, {
      shareToken: null,
      shareExpiresAt: null,
    });
    expect(database.updateWhere).toHaveBeenCalledTimes(2);
  });

  it("rejects a cross-organization or concurrently transferred project before updating briefs", async () => {
    database.state.ownedRows = [];

    await expect(revokeAiDesignBriefSharesForProjectForOrgInDatabase(
      database.db,
      11,
      202,
    ))
      .resolves.toBeNull();
    expect(database.selectBuilder.for).toHaveBeenCalledWith("update");
    expect(database.tx.update).not.toHaveBeenCalled();
  });

  it("is idempotent and reports zero when no issued token remains", async () => {
    database.state.affectedRows = 0;

    await expect(revokeAiDesignBriefSharesForProjectForOrgInDatabase(
      database.db,
      11,
      101,
    ))
      .resolves.toEqual({ revokedCount: 0 });
    expect(database.updateSet).toHaveBeenNthCalledWith(1, {
      shareExpiresAt: null,
    });
    expect(database.updateSet).toHaveBeenNthCalledWith(2, {
      shareToken: null,
      shareExpiresAt: null,
    });
  });
});
