/**
 * MIYAR 3.0 Phase B — Space Program Intelligence Tests
 *
 * Tests the deterministic engines (NO Gemini calls):
 *   - typology-fitout-rules.ts
 *   - amenity-taxonomy.ts
 *   - space-program-extractor.ts (template path only)
 */

import { describe, it, expect } from "vitest";
import {
    getFitOutTag,
    getDefaultRoomTemplate,
    type RoomCategory,
} from "../engines/design/typology-fitout-rules";
import {
    getAmenitySubSpaces,
} from "../engines/design/amenity-taxonomy";
import {
    extractSpaceProgram,
} from "../engines/design/space-program-extractor";

// ─── typology-fitout-rules ────────────────────────────────────────────────────

describe("getFitOutTag", () => {
    it("marks lobby as fit-out for hospitality", () => {
        const result = getFitOutTag("hospitality", "lobby");
        expect(result.isFitOut).toBe(true);
        expect(result.fitOutReason).toBeDefined();
    });

    it("marks parking as shell & core for commercial/hospitality", () => {
        // Parking is shell & core in commercial, hospitality, retail, mixed-use
        const typologies = ["commercial", "hospitality", "retail", "mixed-use"];
        for (const typ of typologies) {
            const result = getFitOutTag(typ, "parking");
            expect(result.isFitOut).toBe(false);
        }
        // Residential has no shell & core — parking IS fit-out there
        const residential = getFitOutTag("residential", "parking");
        expect(residential.isFitOut).toBe(true);
    });

    it("marks office_floor as shell & core for commercial", () => {
        const result = getFitOutTag("commercial", "office_floor");
        expect(result.isFitOut).toBe(false);
    });

    it("marks retail as shell & core for retail typology (tenant fit-out scope)", () => {
        const result = getFitOutTag("retail", "retail");
        expect(result.isFitOut).toBe(false);
    });

    it("marks bedroom as fit-out for residential", () => {
        const result = getFitOutTag("residential", "bedroom");
        expect(result.isFitOut).toBe(true);
    });

    it("marks clinical rooms (office_floor) as shell & core for clinic_medical", () => {
        const result = getFitOutTag("clinic_medical", "office_floor");
        expect(result.isFitOut).toBe(false);
        // But reception is fit-out in clinic
        const reception = getFitOutTag("clinic_medical", "lobby");
        expect(reception.isFitOut).toBe(true);
    });

    it("restaurant treats all interior except parking as fit-out", () => {
        // Kitchen, dining, lobby all fit-out
        expect(getFitOutTag("restaurant", "fb_restaurant").isFitOut).toBe(true);
        expect(getFitOutTag("restaurant", "kitchen").isFitOut).toBe(true);
        expect(getFitOutTag("restaurant", "lobby").isFitOut).toBe(true);
        // Parking is shell & core
        expect(getFitOutTag("restaurant", "parking").isFitOut).toBe(false);
    });

    it("villa and apartment use residential rules (all fit-out)", () => {
        const categories: RoomCategory[] = ["lobby", "bedroom", "kitchen", "parking"];
        for (const cat of categories) {
            expect(getFitOutTag("villa", cat).isFitOut).toBe(true);
            expect(getFitOutTag("apartment", cat).isFitOut).toBe(true);
        }
    });

    it("uses residential rules as fallback for unknown typology", () => {
        const result = getFitOutTag("unknown_type", "lobby");
        expect(result.isFitOut).toBe(true);
    });

    it("always returns a fitOutReason string", () => {
        const categories: RoomCategory[] = ["lobby", "parking", "corridor", "amenity"];
        for (const cat of categories) {
            const result = getFitOutTag("hospitality", cat);
            expect(typeof result.fitOutReason).toBe("string");
            expect(result.fitOutReason!.length).toBeGreaterThan(0);
        }
    });
});

describe("getDefaultRoomTemplate", () => {
    it("returns rooms for residential typology", () => {
        const template = getDefaultRoomTemplate("residential");
        expect(template.length).toBeGreaterThan(0);
    });

    it("returns rooms for hospitality typology", () => {
        const template = getDefaultRoomTemplate("hospitality");
        expect(template.length).toBeGreaterThan(0);
        const hasGuestRoom = template.some((r) => r.category === "guest_room");
        expect(hasGuestRoom).toBe(true);
    });

    it("returns rooms for commercial typology", () => {
        const template = getDefaultRoomTemplate("commercial");
        expect(template.length).toBeGreaterThan(0);
        const hasOffice = template.some((r) => r.category === "office_floor");
        expect(hasOffice).toBe(true);
    });

    it("pctOfGfa sums to ~1.0 for key typologies", () => {
        const typologies = ["residential", "hospitality", "commercial", "retail", "restaurant", "clinic_medical"];
        for (const typology of typologies) {
            const template = getDefaultRoomTemplate(typology);
            const sum = template.reduce((acc, r) => acc + r.pctOfGfa, 0);
            expect(sum).toBeCloseTo(1.0, 1);
        }
    });

    it("clinic_medical has clinical rooms as shell & core", () => {
        const template = getDefaultRoomTemplate("clinic_medical");
        expect(template.length).toBeGreaterThan(0);
        // Clinical rooms (office_floor category) should NOT be fit-out
        const clinicalRooms = template.filter((r) => r.category === "office_floor");
        expect(clinicalRooms.length).toBeGreaterThan(0);
        for (const room of clinicalRooms) {
            expect(room.isFitOut).toBe(false);
        }
        // Reception (lobby) should BE fit-out
        const reception = template.find((r) => r.category === "lobby");
        expect(reception?.isFitOut).toBe(true);
    });

    it("restaurant template has dining and kitchen rooms", () => {
        const template = getDefaultRoomTemplate("restaurant");
        expect(template.length).toBeGreaterThan(0);
        const hasDining = template.some((r) => r.category === "fb_restaurant");
        const hasKitchen = template.some((r) => r.category === "kitchen");
        expect(hasDining).toBe(true);
        expect(hasKitchen).toBe(true);
    });

    it("each room has required fields", () => {
        const template = getDefaultRoomTemplate("residential");
        for (const room of template) {
            expect(room.roomCode).toBeDefined();
            expect(room.roomName).toBeDefined();
            expect(room.category).toBeDefined();
            expect(typeof room.pctOfGfa).toBe("number");
            expect(typeof room.isFitOut).toBe("boolean");
            expect(room.finishGrade).toMatch(/^[ABC]$/);
            expect(room.priority).toMatch(/^(high|medium|low)$/);
        }
    });

    it("falls back to residential for unknown typology", () => {
        const template = getDefaultRoomTemplate("alien_building");
        expect(template.length).toBeGreaterThan(0);
        const residentialTemplate = getDefaultRoomTemplate("residential");
        expect(template.length).toBe(residentialTemplate.length);
    });
});

// ─── amenity-taxonomy ─────────────────────────────────────────────────────────

describe("getAmenitySubSpaces", () => {
    it("returns sub-spaces for hospitality amenity area", () => {
        const subSpaces = getAmenitySubSpaces("hospitality", 500);
        expect(subSpaces.length).toBeGreaterThan(0);
    });

    it("sub-space sqm sums to approximately the parent sqm", () => {
        const parentSqm = 1000;
        const subSpaces = getAmenitySubSpaces("residential", parentSqm);
        const totalSubSqm = subSpaces.reduce((sum, s) => sum + s.sqm, 0);
        expect(totalSubSqm).toBeGreaterThan(parentSqm * 0.9);
        expect(totalSubSqm).toBeLessThan(parentSqm * 1.1);
    });

    it("each sub-space has isFitOut flag", () => {
        const subSpaces = getAmenitySubSpaces("commercial", 200);
        for (const sub of subSpaces) {
            expect(typeof sub.isFitOut).toBe("boolean");
        }
    });

    it("pctOfParent values sum to ~1.0", () => {
        const subSpaces = getAmenitySubSpaces("hospitality", 100);
        const pctSum = subSpaces.reduce((sum, s) => sum + s.pctOfParent, 0);
        expect(pctSum).toBeCloseTo(1.0, 1);
    });

    it("returns sub-spaces for multiple typologies", () => {
        const typologies = ["residential", "hospitality", "commercial"];
        for (const typ of typologies) {
            const subSpaces = getAmenitySubSpaces(typ, 100);
            expect(subSpaces.length).toBeGreaterThan(0);
        }
    });

    it("uses residential profile as fallback for unknown typology", () => {
        const subSpaces = getAmenitySubSpaces("underwater_museum", 100);
        const residentialSubSpaces = getAmenitySubSpaces("residential", 100);
        expect(subSpaces.length).toBe(residentialSubSpaces.length);
    });
});

// ─── space-program-extractor (template path) ──────────────────────────────────

describe("extractSpaceProgram (template path)", () => {
    it("generates rooms from typology + GFA", async () => {
        const result = await extractSpaceProgram({
            projectId: 1,
            organizationId: 1,
            typology: "residential",
            gfa: 5000,
        });

        expect(result.rooms.length).toBeGreaterThan(0);
        expect(result.source).toBe("typology_default");
        expect(result.warnings).toEqual([]);
    });

    it("each room has required schema fields", async () => {
        const result = await extractSpaceProgram({
            projectId: 1,
            organizationId: 1,
            typology: "hospitality",
            gfa: 10000,
        });

        for (const room of result.rooms) {
            expect(room.projectId).toBe(1);
            expect(room.organizationId).toBe(1);
            expect(room.roomCode).toBeDefined();
            expect(room.roomName).toBeDefined();
            expect(Number(room.sqm)).toBeGreaterThan(0);
            expect(typeof room.isFitOut).toBe("boolean");
            expect(typeof room.fitOutOverridden).toBe("boolean");
            expect(room.fitOutOverridden).toBe(false);
            expect(room.finishGrade).toMatch(/^[ABC]$/);
            expect(room.blockName).toBe("Main");
            expect(room.blockTypology).toBe("hospitality");
        }
    });

    it("generates amenity sub-spaces for amenity rooms", async () => {
        const result = await extractSpaceProgram({
            projectId: 1,
            organizationId: 1,
            typology: "hospitality",
            gfa: 20000,
        });

        const amenityRooms = result.rooms.filter((r) => r.category === "amenity");
        if (amenityRooms.length > 0) {
            expect(result.amenitySubSpaces.length).toBeGreaterThan(0);
        }
    });

    it("handles mixed-use blocks", async () => {
        const result = await extractSpaceProgram({
            projectId: 1,
            organizationId: 1,
            typology: "mixed_use",
            gfa: 50000,
            blocks: [
                { blockName: "Tower A", blockTypology: "residential", gfaSqm: 30000 },
                { blockName: "Tower B", blockTypology: "commercial", gfaSqm: 20000 },
            ],
        });

        expect(result.rooms.length).toBeGreaterThan(0);

        const blockArooms = result.rooms.filter((r) => r.blockName === "Tower A");
        const blockBrooms = result.rooms.filter((r) => r.blockName === "Tower B");
        expect(blockArooms.length).toBeGreaterThan(0);
        expect(blockBrooms.length).toBeGreaterThan(0);

        expect(blockArooms[0].blockTypology).toBe("residential");
        expect(blockBrooms[0].blockTypology).toBe("commercial");
    });

    it("sqm is proportional to GFA", async () => {
        const result = await extractSpaceProgram({
            projectId: 1,
            organizationId: 1,
            typology: "residential",
            gfa: 10000,
        });

        const totalSqm = result.rooms.reduce((sum, r) => sum + Number(r.sqm), 0);
        expect(totalSqm).toBeGreaterThan(9000);
        expect(totalSqm).toBeLessThan(11000);
    });

    it("budget percentages sum to approximately 1.0 when set", async () => {
        const result = await extractSpaceProgram({
            projectId: 1,
            organizationId: 1,
            typology: "residential",
            gfa: 5000,
        });

        const budgetPcts = result.rooms
            .filter((r) => r.budgetPct !== null)
            .map((r) => Number(r.budgetPct));

        if (budgetPcts.length > 0) {
            const sum = budgetPcts.reduce((a, b) => a + b, 0);
            expect(sum).toBeCloseTo(1.0, 1);
        }
    });
});
