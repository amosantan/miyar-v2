import { describe, expect, it } from "vitest";

import {
  findEv02SchemaContractViolations,
  type Ev02SchemaColumnRow,
  type Ev02SchemaIndexRow,
} from "./backfill-schema-contract";

function column(override: Partial<Ev02SchemaColumnRow>): Ev02SchemaColumnRow {
  return {
    tableName: "product",
    columnName: "identityKey",
    columnType: "varchar(64)",
    nullable: "NO",
    columnDefault: null,
    extra: "",
    ...override,
  } as Ev02SchemaColumnRow;
}

function index(override: Partial<Ev02SchemaIndexRow>): Ev02SchemaIndexRow {
  return {
    tableName: "product",
    indexName: "product_identity_key_unique",
    nonUnique: 0,
    columns: "identityKey",
    ...override,
  } as Ev02SchemaIndexRow;
}

describe("EV-02 live schema contract", () => {
  it("reports wrong column definitions instead of accepting a matching name", () => {
    expect(
      findEv02SchemaContractViolations(
        [column({ columnType: "varchar(255)" })],
        []
      )
    ).toContain("column mismatch product.identityKey: varchar(255)/NO/null");
  });

  it("reports missing uniqueness and wrong index order", () => {
    const missing = findEv02SchemaContractViolations([], []);
    expect(missing).toContain(
      "missing index product.product_identity_key_unique"
    );
    const wrong = findEv02SchemaContractViolations(
      [],
      [
        index({
          tableName: "benchmark_proposals",
          indexName: "benchmark_proposals_governed_resolver_idx",
          nonUnique: 1,
          columns: "orgId,specId,productId,priceScope,status,recommendation",
        }),
      ]
    );
    expect(wrong).toContain(
      "index mismatch benchmark_proposals.benchmark_proposals_governed_resolver_idx: 1/orgId,specId,productId,priceScope,status,recommendation"
    );
  });

  it("reports partial new-table application by exact column count", () => {
    expect(findEv02SchemaContractViolations([column({})], [])).toContain(
      "column count mismatch product: 1/20"
    );
  });
});
