import { describe, it, expect } from "vitest";
import { buildDesignVocabulary } from "./design/vocabulary";
import { buildSpaceProgram } from "./design/space-program";
import { buildRFQPack } from "./design/rfq-generator";

describe("V8 Design Intelligence Engines", () => {
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
            { id: 1, category: "flooring", tier: "premium", style: "all", priceAedMin: 150.50, priceAedMax: 200.75 }
        ];

        const rfq = buildRFQPack(1, 1, finishSchedule, rooms, materials);

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
