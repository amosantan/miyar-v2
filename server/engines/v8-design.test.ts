import { describe, it, expect } from "vitest";
import { buildDesignVocabulary } from "./design/vocabulary";
import { buildSpaceProgram } from "./design/space-program";
import { buildRFQPack } from "./design/rfq-generator";
import { buildFinishSchedule } from "./design/finish-schedule";
import {
    MATERIAL_RESOLUTION_POLICY_VERSION,
    type GovernedMaterialPriceSnapshot,
} from "../../shared/material-calculations";

describe("V8 Design Intelligence Engines", () => {
    it("creates new finish rows with explicit canonical identity state", () => {
        const schedule = buildFinishSchedule(
            { id: 7, organizationId: 5 },
            {
                materialTier: "premium",
                paletteKey: "warm_minimalism",
                finishTone: "Warm Neutrals",
                sustainNote: "Baseline",
                ceilingType: "Simple",
                joinery: "Oak",
                hardwareFinish: "Brass",
            } as any,
            [{
                id: "LVG",
                name: "Living",
                sqm: 20,
                budgetPct: 1,
                priority: "high",
                finishGrade: "A",
            }],
            [{
                id: 11,
                productId: 101,
                category: "flooring",
                tier: "premium",
                style: "minimalist",
                notes: null,
            }]
        );
        const floor = schedule.find(item => item.element === "floor");
        expect(floor).toMatchObject({
            materialLibraryId: 11,
            productId: 101,
            specId: null,
            identityState: "unresolved",
        });
        expect(schedule.every(item => item.identityState !== "legacy_unverified"))
            .toBe(true);
    });

    it("determines deterministic vocabulary from inputs", () => {
        const project = {
            fin01BudgetCap: "400",
            des01Style: "classic",
            mkt01Tier: "Premium",
            des03Complexity: "0.8",
            des04Experience: "0.6",
            des05Sustainability: "0.9"
        };

        const vocab = buildDesignVocabulary(project);
        expect(vocab.materialTier).toBe("premium"); // 400 cap -> premium
        expect(vocab.paletteKey).toBe("classic_marble"); // classic + premium -> classic_marble
        expect(vocab.finishTone).toBe("Warm Neutrals"); // experience 0.6 >= 0.5 -> warm
        expect(vocab.sustainNote).toContain("sustainable"); // 0.9 > 0.6
        expect(vocab.ceilingType).toBe("Feature Coffered Ceiling"); // complexity 0.8 > 0.7
    });

    it("calculates exact space program budget allocations", () => {
        const project = {
            ctx03Gfa: 1000,
            fin01BudgetCap: 200,
            ctx01Typology: "residential"
        };

        const program = buildSpaceProgram(project);

        // Total AED = 1000 * 200 * 10.764 * 0.35 = 753480
        expect(program.totalFitoutBudgetAed).toBeCloseTo(753480, 0);
        expect(program.rooms.length).toBe(9); // standard residential array length

        // Living room pctSqm is 0.28
        const livingRoom = program.rooms.find(r => r.id === "LVG");
        expect(livingRoom?.sqm).toBe(280);
    });

    it("calculates RFQ totals accurately with no floating point drift", () => {
        const rooms = [
            { id: "LVG", name: "Living & Dining", sqm: 280, budgetPct: 0.28, priority: "high" as any, finishGrade: "A" as any }
        ];
        const finishSchedule = [
            { roomId: "LVG", element: "floor", materialLibraryId: 1 }
        ];
        const materials = [
            { id: 1, category: "flooring", tier: "premium", style: "all", productName: "Premium Floor" }
        ];
        const priceSnapshot: GovernedMaterialPriceSnapshot = {
            state: "resolved",
            policyVersion: MATERIAL_RESOLUTION_POLICY_VERSION,
            reference: { source: "material_library", legacyId: 1 },
            productId: 10,
            specificationId: 20,
            benchmarkProposalId: 30,
            benchmarkVersionId: 40,
            resolverAsOf: "2026-07-29T12:00:00.000Z",
            requestedGeography: "uae",
            resolvedGeography: "uae",
            usedUaeFallback: false,
            requestedPriceScope: "supply_and_install",
            resolvedPriceScope: "supply_and_install",
            currency: "AED",
            unitBasis: "per_sqm",
            priceMin: "150.50",
            priceMid: "175.625",
            priceMax: "200.75",
            weightedMean: "175.625",
            provenance: {
                sourceLadderRung: "assumption",
                sourceLabel: "MIYAR assumption",
                provenancePolicyVersion: "test-v1",
                benchmarkVersion: "test-v1",
                compatibilityFallback: false,
            },
        };

        const rfq = buildRFQPack(1, 1, finishSchedule, rooms, materials, [priceSnapshot]);

        const floorLine = rfq.find(r => r.sectionNo === 1 && r.itemCode === "FL-LVG");
        expect(floorLine).toBeDefined();
        expect(floorLine?.quantity).toBe(280);

        // 280 * 150.50 = 42140
        // 280 * 200.75 = 56210
        expect(floorLine?.totalAedMin).toBe(42140);
        expect(floorLine?.totalAedMax).toBe(56210);

        // Provisional sum section 6 has contingency: 10% of sections 1-5
        const contingency = rfq.find(r => r.itemCode === "PS-01");

        // Should be exactly 10%
        expect(contingency?.totalAedMin).toBe(4214);
        expect(contingency?.totalAedMax).toBe(5621);
    });
});
