/**
 * RFQ Generator Engine (V4) — Design Brief Pipeline
 * Generates procurement-ready BOQ line items from structured Design Briefs.
 * Supports both the new Brief-driven path and legacy room/material path.
 */

import type { DesignBriefData } from "../design-brief";
import { Room } from "./space-program";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RfqLineItem {
    projectId: number;
    organizationId: number;
    briefId?: number | null;
    sectionNo: number;
    itemCode: string;
    description: string;
    unit: string;
    quantity: number;
    unitRateAedMin: number;
    unitRateAedMax: number;
    totalAedMin: number;
    totalAedMax: number;
    supplierName: string;
    pricingSource: "market-verified" | "estimated" | "manual";
    notes?: string;
}

export interface RfqPackResult {
    items: RfqLineItem[];
    summary: {
        totalSections: number;
        totalLineItems: number;
        subtotalMin: number;
        subtotalMax: number;
        contingencyMin: number;
        contingencyMax: number;
        grandTotalMin: number;
        grandTotalMax: number;
        marketVerifiedCount: number;
        estimatedCount: number;
        budgetCapAed: number | null;
        budgetUtilizationPct: number | null;
    };
}

// ─── Category → Evidence Category Mapping ─────────────────────────────────────
// Maps Design Brief BOQ category names to material catalog categories

const CATEGORY_MATERIAL_MAP: Record<string, { categories: string[]; defaultUnit: string; areaMultiplier: number }> = {
    "Civil & MEP Works (Flooring, Ceilings, Partitions)": {
        categories: ["flooring", "ceiling", "partition", "tiles"],
        defaultUnit: "sqm",
        areaMultiplier: 1.0,
    },
    "Civil & MEP Works (Partitions, HVAC, Data)": {
        categories: ["partition", "ceiling", "mechanical"],
        defaultUnit: "sqm",
        areaMultiplier: 1.0,
    },
    "Civil & MEP Works": {
        categories: ["flooring", "ceiling", "partition"],
        defaultUnit: "sqm",
        areaMultiplier: 1.0,
    },
    "Fixed Joinery (Kitchens, Wardrobes, Doors)": {
        categories: ["joinery", "kitchen", "doors", "wardrobes"],
        defaultUnit: "lm",
        areaMultiplier: 0.25,
    },
    "Feature Joinery & Reception": {
        categories: ["joinery", "reception"],
        defaultUnit: "lm",
        areaMultiplier: 0.15,
    },
    "Fixed Joinery & Millwork": {
        categories: ["joinery", "millwork"],
        defaultUnit: "lm",
        areaMultiplier: 0.2,
    },
    "Sanitaryware & Wet Areas": {
        categories: ["sanitaryware", "brassware", "tiles"],
        defaultUnit: "set",
        areaMultiplier: 0.12,
    },
    "Sanitaryware & Specialized Equipment": {
        categories: ["sanitaryware", "brassware", "equipment"],
        defaultUnit: "set",
        areaMultiplier: 0.12,
    },
    "Pantry & Washrooms": {
        categories: ["sanitaryware", "kitchen", "tiles"],
        defaultUnit: "set",
        areaMultiplier: 0.08,
    },
    "FF&E (Loose Furniture, Lighting, Art)": {
        categories: ["furniture", "lighting", "art", "decorative"],
        defaultUnit: "lot",
        areaMultiplier: 1.0,
    },
    "FF&E (Custom Furniture, Drapery, Rugs)": {
        categories: ["furniture", "drapery", "rugs", "textiles"],
        defaultUnit: "lot",
        areaMultiplier: 1.0,
    },
    "Workstations & Loose Furniture": {
        categories: ["furniture", "workstation", "seating"],
        defaultUnit: "nr",
        areaMultiplier: 0.05,
    },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseCostLabel(label: string): { min: number; max: number; isMarketVerified: boolean } | null {
    // Expected format: "AED 450,000 (market-verified)" or "AED 300,000 — 450,000"
    const isVerified = label.includes("market-verified");
    const cleaned = label.replace(/[^0-9.,\-—]/g, " ").trim();
    const numbers = cleaned.split(/[\-—\s]+/).map(s => Number(s.replace(/,/g, ""))).filter(n => !isNaN(n) && n > 0);

    if (numbers.length === 0) return null;
    if (numbers.length === 1) return { min: numbers[0], max: numbers[0], isMarketVerified: isVerified };
    return { min: numbers[0], max: numbers[1], isMarketVerified: isVerified };
}

function parseBudgetCap(s: string): number | null {
    const cleaned = s.replace(/[^0-9.]/g, "");
    const n = Number(cleaned);
    return isNaN(n) || n === 0 ? null : n;
}

function isApprovedMaterial(mat: { name: string; category: string }, specs: DesignBriefData["materialSpecifications"]): boolean {
    const prohibited = specs.prohibitedMaterials.map(p => p.toLowerCase());
    const matNameLower = mat.name.toLowerCase();
    for (const p of prohibited) {
        if (matNameLower.includes(p.split("(")[0].trim().toLowerCase())) return false;
    }
    return true;
}

// ─── Main: Brief-Driven RFQ ──────────────────────────────────────────────────

/**
 * Build an RFQ pack from a structured Design Brief.
 * Each `boqFramework.coreAllocation` becomes an RFQ section.
 * Materials are filtered against the Brief's materialSpecifications.
 */
export function buildRFQFromBrief(
    projectId: number,
    orgId: number,
    briefData: DesignBriefData,
    briefId?: number,
    materials?: Array<{
        id: number;
        name: string;
        category: string;
        tier: string;
        priceAedMin?: number | string | null;
        priceAedMax?: number | string | null;
        supplierName?: string | null;
    }>,
): RfqPackResult {
    const items: RfqLineItem[] = [];
    const gfa = briefData.boqFramework.totalEstimatedSqm || 0;
    const budgetCap = parseBudgetCap(briefData.detailedBudget.totalBudgetCap);
    let subtotalMin = 0;
    let subtotalMax = 0;
    let marketVerifiedCount = 0;
    let estimatedCount = 0;

    // ── Generate sections from BOQ allocations ────────────────────────────────
    briefData.boqFramework.coreAllocations.forEach((alloc, sectionIdx) => {
        const sectionNo = sectionIdx + 1;
        const costParsed = parseCostLabel(alloc.estimatedCostLabel);
        const mapping = CATEGORY_MATERIAL_MAP[alloc.category];
        const qty = gfa > 0 && mapping ? Math.round(gfa * mapping.areaMultiplier) : 1;
        const unit = mapping?.defaultUnit || "lot";

        // Find matching materials from catalog (if provided)
        const matchingMaterials = materials?.filter(m => {
            if (!mapping) return false;
            return mapping.categories.some(c => m.category.toLowerCase().includes(c));
        }).filter(m => isApprovedMaterial(m, briefData.materialSpecifications)) || [];

        if (matchingMaterials.length > 0) {
            // Create a line item per matching material (up to top 3)
            matchingMaterials.slice(0, 3).forEach((mat, matIdx) => {
                const rateMin = Number(mat.priceAedMin || 0);
                const rateMax = Number(mat.priceAedMax || 0);
                const pricingSource = costParsed?.isMarketVerified ? "market-verified" as const : "estimated" as const;

                const totalMin = qty * rateMin;
                const totalMax = qty * rateMax;
                subtotalMin += totalMin;
                subtotalMax += totalMax;

                if (pricingSource === "market-verified") marketVerifiedCount++;
                else estimatedCount++;

                items.push({
                    projectId,
                    organizationId: orgId,
                    briefId: briefId ?? null,
                    sectionNo,
                    itemCode: `${sectionNo.toString().padStart(2, "0")}-${(matIdx + 1).toString().padStart(2, "0")}`,
                    description: `Supply & install ${mat.name} — ${alloc.category}`,
                    unit,
                    quantity: qty,
                    unitRateAedMin: rateMin,
                    unitRateAedMax: rateMax,
                    totalAedMin: totalMin,
                    totalAedMax: totalMax,
                    supplierName: mat.supplierName || "TBD",
                    pricingSource,
                    notes: alloc.notes || undefined,
                });
            });
        } else if (costParsed) {
            // No specific materials — use the Brief's cost estimate as a provisional sum
            const pricingSource = costParsed.isMarketVerified ? "market-verified" as const : "estimated" as const;
            subtotalMin += costParsed.min;
            subtotalMax += costParsed.max;

            if (pricingSource === "market-verified") marketVerifiedCount++;
            else estimatedCount++;

            items.push({
                projectId,
                organizationId: orgId,
                briefId: briefId ?? null,
                sectionNo,
                itemCode: `${sectionNo.toString().padStart(2, "0")}-PS`,
                description: `${alloc.category} — Provisional Sum (from Design Brief)`,
                unit: "sum",
                quantity: 1,
                unitRateAedMin: costParsed.min,
                unitRateAedMax: costParsed.max,
                totalAedMin: costParsed.min,
                totalAedMax: costParsed.max,
                supplierName: "Per Design Brief",
                pricingSource,
                notes: `${alloc.percentage}% of total budget. ${alloc.notes}`,
            });
        } else {
            // No cost data at all — mark TBD
            estimatedCount++;
            items.push({
                projectId,
                organizationId: orgId,
                briefId: briefId ?? null,
                sectionNo,
                itemCode: `${sectionNo.toString().padStart(2, "0")}-TBD`,
                description: `${alloc.category} — To Be Detailed`,
                unit: "sum",
                quantity: 1,
                unitRateAedMin: 0,
                unitRateAedMax: 0,
                totalAedMin: 0,
                totalAedMax: 0,
                supplierName: "TBD",
                pricingSource: "estimated",
                notes: `${alloc.percentage}% allocation — requires detailed pricing. ${alloc.notes}`,
            });
        }
    });

    // ── Contingency (from Brief or default 10%) ───────────────────────────────
    const contingencyPct = briefData.detailedBudget.contingencyRecommendation.match(/(\d+)%/)?.[1];
    const contPct = contingencyPct ? Number(contingencyPct) / 100 : 0.10;
    const contingencyMin = subtotalMin * contPct;
    const contingencyMax = subtotalMax * contPct;
    const lastSection = items.length > 0 ? items[items.length - 1].sectionNo + 1 : 1;

    items.push({
        projectId,
        organizationId: orgId,
        briefId: briefId ?? null,
        sectionNo: lastSection,
        itemCode: "PS-CONT",
        description: `Contingency (${Math.round(contPct * 100)}% of Sections 1-${lastSection - 1})`,
        unit: "sum",
        quantity: 1,
        unitRateAedMin: contingencyMin,
        unitRateAedMax: contingencyMax,
        totalAedMin: contingencyMin,
        totalAedMax: contingencyMax,
        supplierName: "",
        pricingSource: "estimated",
        notes: briefData.detailedBudget.contingencyRecommendation,
    });

    // ── DM/DDA Approval Fees ──────────────────────────────────────────────────
    items.push({
        projectId,
        organizationId: orgId,
        briefId: briefId ?? null,
        sectionNo: lastSection,
        itemCode: "PS-DM",
        description: "DM/DDA Approval Fees (Provisional)",
        unit: "sum",
        quantity: 1,
        unitRateAedMin: 15000,
        unitRateAedMax: 15000,
        totalAedMin: 15000,
        totalAedMax: 15000,
        supplierName: "Dubai Authorities",
        pricingSource: "estimated",
        notes: "Standard Dubai Municipality / DDA approval fees for interior fit-out.",
    });

    // ── Design Consultant Fees ────────────────────────────────────────────────
    items.push({
        projectId,
        organizationId: orgId,
        briefId: briefId ?? null,
        sectionNo: lastSection,
        itemCode: "PS-FFE",
        description: "FF&E Procurement Management (Provisional)",
        unit: "sum",
        quantity: 1,
        unitRateAedMin: 25000,
        unitRateAedMax: 25000,
        totalAedMin: 25000,
        totalAedMax: 25000,
        supplierName: "Design Consultant",
        pricingSource: "estimated",
    });

    // ── Summary ───────────────────────────────────────────────────────────────
    const grandTotalMin = subtotalMin + contingencyMin + 40000; // 15k + 25k provisionals
    const grandTotalMax = subtotalMax + contingencyMax + 40000;

    return {
        items,
        summary: {
            totalSections: lastSection,
            totalLineItems: items.length,
            subtotalMin,
            subtotalMax,
            contingencyMin,
            contingencyMax,
            grandTotalMin,
            grandTotalMax,
            marketVerifiedCount,
            estimatedCount,
            budgetCapAed: budgetCap,
            budgetUtilizationPct: budgetCap ? Math.round((grandTotalMax / budgetCap) * 100) : null,
        },
    };
}

// ─── Legacy: Room/Material-Based RFQ (backward compat) ──────────────────────

export function buildRFQPack(
    projectId: number,
    orgId: number,
    finishSchedule: any[],
    rooms: Room[],
    materials: any[]
): any[] {
    const rfqItems: any[] = [];

    const getMaterial = (id: number) => materials.find(m => m.id === id);

    let subtotalMin = 0;
    let subtotalMax = 0;

    const pushLine = (
        sectionNo: number,
        itemCode: string,
        description: string,
        unit: string,
        quantity: number,
        rateMin: number,
        rateMax: number,
        supplierName: string
    ) => {
        const totalMin = quantity * rateMin;
        const totalMax = quantity * rateMax;
        subtotalMin += totalMin;
        subtotalMax += totalMax;

        rfqItems.push({
            projectId,
            organizationId: orgId,
            sectionNo,
            itemCode,
            description,
            unit,
            quantity,
            unitRateAedMin: rateMin,
            unitRateAedMax: rateMax,
            totalAedMin: totalMin,
            totalAedMax: totalMax,
            supplierName,
            pricingSource: "estimated",
        });
    };

    const getSchedulesForRoom = (roomId: string) => finishSchedule.filter(f => f.roomId === roomId);

    // Section 1: Flooring Works
    rooms.forEach((room) => {
        const floors = getSchedulesForRoom(room.id).filter(f => f.element === "floor");
        floors.forEach(floor => {
            const mat = getMaterial(floor.materialLibraryId);
            if (mat) {
                pushLine(1, `FL-${room.id}`,
                    `Supply & install ${mat.productName} to ${room.name}`,
                    "sqm", room.sqm,
                    Number(mat.priceAedMin || 0), Number(mat.priceAedMax || 0),
                    mat.supplierName);
            }
        });
    });

    // Section 2: Wall Finishes
    rooms.forEach((room) => {
        const walls = getSchedulesForRoom(room.id).filter(f => f.element.startsWith("wall_"));
        walls.forEach(wall => {
            const mat = getMaterial(wall.materialLibraryId);
            if (mat) {
                const areaMultiplier = wall.element === "wall_primary" ? 2.5 : 1.0;
                const qty = room.sqm * areaMultiplier;
                pushLine(2, `WL-${room.id}-${wall.element.split("_")[1]}`,
                    `Supply & apply ${mat.productName} to ${room.name} (${wall.element})`,
                    "sqm", qty,
                    Number(mat.priceAedMin || 0), Number(mat.priceAedMax || 0),
                    mat.supplierName);
            }
        });
    });

    // Section 3: Ceiling Works
    rooms.forEach((room) => {
        const ceil = getSchedulesForRoom(room.id).find(f => f.element === "ceiling");
        if (ceil) {
            let rateMin = 90;
            let rateMax = 120;
            if (ceil.overrideSpec?.includes("Coffered")) { rateMin = 180; rateMax = 250; }
            if (ceil.overrideSpec?.includes("Cove")) { rateMin = 130; rateMax = 160; }

            pushLine(3, `CL-${room.id}`,
                `Supply & install ${ceil.overrideSpec || "Gypsum Ceiling"} to ${room.name}`,
                "sqm", room.sqm, rateMin, rateMax, "Various Subcontractors");
        }
    });

    // Section 4: Joinery & Built-ins
    rooms.forEach((room) => {
        const joinery = getSchedulesForRoom(room.id).find(f => f.element === "joinery");
        if (joinery && ["MBR", "BD2", "BD3", "KIT", "LVG"].includes(room.id)) {
            let lm = room.sqm * 0.2;
            let rateMin = 1200;
            let rateMax = 1800;
            if (room.id === "KIT") { rateMin = 2000; rateMax = 3500; lm = room.sqm * 0.4; }

            pushLine(4, `JN-${room.id}`,
                `Custom Joinery / Wardrobes / Cabinets in ${room.name} (${joinery.overrideSpec})`,
                "lm", lm, rateMin, rateMax, "Specialist Joinery");
        }
    });

    // Section 5: Sanitaryware & Fittings
    const wetRooms = rooms.filter(r => ["MEN", "BTH", "UTL", "KIT"].includes(r.id));
    wetRooms.forEach(room => {
        const swMat = materials.find(m => m.category === "sanitaryware");
        if (swMat) {
            pushLine(5, `SW-${room.id}`,
                `Allow for Sanitaryware & Brassware package for ${room.name}`,
                "set", 1,
                Number(swMat.priceAedMin || 0) * 3,
                Number(swMat.priceAedMax || 0) * 4,
                swMat.supplierName);
        }
    });

    // Section 6: Provisional Sums
    rfqItems.push({
        projectId, organizationId: orgId, sectionNo: 6,
        itemCode: "PS-01", description: "Contingency (10% of Sections 1-5)",
        unit: "sum", quantity: 1,
        unitRateAedMin: subtotalMin * 0.1, unitRateAedMax: subtotalMax * 0.1,
        totalAedMin: subtotalMin * 0.1, totalAedMax: subtotalMax * 0.1,
        supplierName: "", pricingSource: "estimated",
    });

    rfqItems.push({
        projectId, organizationId: orgId, sectionNo: 6,
        itemCode: "PS-02", description: "DM/DDA Approval Fees (Provisional)",
        unit: "sum", quantity: 1,
        unitRateAedMin: 15000, unitRateAedMax: 15000,
        totalAedMin: 15000, totalAedMax: 15000,
        supplierName: "Dubai Authorities", pricingSource: "estimated",
    });

    rfqItems.push({
        projectId, organizationId: orgId, sectionNo: 6,
        itemCode: "PS-03", description: "FF&E Procurement Management (Provisional)",
        unit: "sum", quantity: 1,
        unitRateAedMin: 25000, unitRateAedMax: 25000,
        totalAedMin: 25000, totalAedMax: 25000,
        supplierName: "Design Consultant", pricingSource: "estimated",
    });

    return rfqItems;
}
