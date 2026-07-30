import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import { mergeRouters, publicProcedure, router } from "../_core/trpc";
import { designAssetsRouter } from "./design-assets";
import { designBriefsRouter } from "./design-briefs";
import { designBoardsRouter } from "./design-boards";
import { designCollaborationRouter } from "./design-collaboration";
import { designMarketContextRouter } from "./design-market-context";
import { designMaterialsRouter } from "./design-materials";
import { designSharingRouter } from "./design-sharing";
import { designVisualsRouter } from "./design-visuals";
import { designGeometryAssetsRouter } from "./design-geometry-assets";
import { designRouter } from "./design";

const EXPECTED_DESIGN_PROCEDURES = {
  listAssets: "query",
  createAssetUpload: "mutation",
  finalizeAssetUpload: "mutation",
  uploadAsset: "mutation",
  deleteAsset: "mutation",
  updateAsset: "mutation",
  linkAsset: "mutation",
  getAssetLinks: "query",
  generateBrief: "mutation",
  listBriefs: "query",
  getBrief: "query",
  getLatestBrief: "query",
  generateRfqFromBrief: "mutation",
  exportBriefDocx: "mutation",
  generateVisual: "mutation",
  listVisuals: "query",
  attachVisualToPack: "mutation",
  pinVisualToBoard: "mutation",
  listPinnedVisuals: "query",
  unpinVisual: "mutation",
  createBoard: "mutation",
  listBoards: "query",
  getBoard: "query",
  addMaterialToBoard: "mutation",
  removeMaterialFromBoard: "mutation",
  deleteBoard: "mutation",
  updateBoardTile: "mutation",
  reorderBoardTiles: "mutation",
  exportBoardPdf: "mutation",
  boardSummary: "query",
  recommendMaterials: "query",
  listMaterials: "query",
  getMaterial: "query",
  createMaterial: "mutation",
  updateMaterial: "mutation",
  deleteMaterial: "mutation",
  listPromptTemplates: "query",
  createPromptTemplate: "mutation",
  updatePromptTemplate: "mutation",
  addComment: "mutation",
  listComments: "query",
  updateApprovalState: "mutation",
  getMaterialConstants: "query",
  calculateSpec: "mutation",
  getDesignTrends: "query",
  getBenchmarkForProject: "query",
  getDldAreas: "query",
  getDldAreaComparison: "query",
  getAreaBenchmarks: "query",
  getAreaBenchmark: "query",
  getDldDataStats: "query",
  getProjectDldBenchmark: "query",
  getDataFreshness: "query",
  getProjectDataFreshness: "query",
  getEvidenceChain: "query",
  getCompetitorContext: "query",
  exportInvestorPdf: "mutation",
  createShareLink: "mutation",
  revokeShareLinks: "mutation",
  resolveShareLink: "query",
  generateRoomRender: "mutation",
  uploadFloorPlan: "mutation",
  analyzeFloorPlan: "mutation",
  getSpaceBenchmark: "query",
  createGeometrySourceUpload: "mutation",
  finalizeGeometrySourceUpload: "mutation",
} as const;

describe("design router contract", () => {
  const ownerRouters = [
    designAssetsRouter,
    designBriefsRouter,
    designBoardsRouter,
    designCollaborationRouter,
    designMarketContextRouter,
    designMaterialsRouter,
    designSharingRouter,
    designVisualsRouter,
    designGeometryAssetsRouter,
  ];

  it("retains every flat procedure name and operation kind", () => {
    const actual = Object.fromEntries(
      Object.entries(designRouter._def.procedures).map(([name, procedure]) => [
        name,
        procedure._def.type,
      ])
    );

    expect(actual).toEqual(EXPECTED_DESIGN_PROCEDURES);
    expect(Object.keys(actual)).not.toContain(expect.stringContaining("."));
  });

  it("composes each procedure exactly once without wrapping it", () => {
    for (const [name, procedure] of Object.entries(
      designRouter._def.procedures
    )) {
      const owners = ownerRouters.filter(
        owner => owner._def.procedures[name] !== undefined
      );
      expect(owners, name).toHaveLength(1);
      expect(procedure, name).toBe(owners[0]._def.procedures[name]);
    }
  });

  it("rejects duplicate procedure ownership", () => {
    const collision = router({
      listAssets: publicProcedure.query(() => null),
    });
    expect(() => mergeRouters(designAssetsRouter, collision)).toThrow(
      /Duplicate key/i
    );
  });

  it("matches the immutable pre-split source and middleware baseline", () => {
    const result = spawnSync(
      "pnpm",
      ["exec", "tsx", "scripts/check-design-router-contract.ts"],
      { cwd: process.cwd(), encoding: "utf8" }
    );
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      "SC-01 design contract PASS: 63 baseline procedures and 3 approved additive procedures"
    );
    expect(result.status).toBe(0);
  });
});
