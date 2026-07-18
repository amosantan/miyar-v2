/**
 * Design Enablement Router (V2.8)
 * Evidence Vault, Design Brief, Visual Generation, Board Composer, Materials, Collaboration
 */
import { z } from "zod";
import { requireDesignProject } from "../_core/design-resource-access";
import {
  adminProcedure,
  orgProcedure,
  protectedProcedure,
  router,
} from "../_core/trpc";
import * as db from "../db";
import { matchVendorsForProject } from "../engines/procurement/vendor-matching";

export const designMaterialsRouter = router({
  recommendMaterials: orgProcedure
    .input(
      z.object({ projectId: z.number(), maxItems: z.number().default(10) })
    )
    .query(async ({ ctx, input }) => {
      await requireDesignProject(input.projectId, ctx.orgId);
      // Phase 8: Vendor Matching Integration
      const matched = await matchVendorsForProject({
        projectId: input.projectId,
        orgId: ctx.orgId,
        maxItems: input.maxItems,
      });

      // Map back to expected BoardItem format for frontend compatibility
      return matched.map((m: any) => ({
        materialId: m.id,
        name: m.name,
        category: m.category,
        tier: m.tier,
        costLow: Number(m.typicalCostLow) || 0,
        costHigh: Number(m.typicalCostHigh) || 0,
        costUnit: m.costUnit || "AED/unit",
        leadTimeDays: m.leadTimeDays || 30,
        leadTimeBand: m.leadTimeBand || "medium",
        supplierName: m.supplierName || "TBD",
      }));
    }),

  listMaterials: protectedProcedure
    .input(
      z.object({ category: z.string().optional(), tier: z.string().optional() })
    )
    .query(async ({ input }) => {
      return db.getAllMaterials(input.category, input.tier);
    }),

  getMaterial: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return db.getMaterialById(input.id);
    }),

  createMaterial: adminProcedure
    .input(
      z.object({
        name: z.string(),
        category: z.enum([
          "tile",
          "stone",
          "wood",
          "metal",
          "fabric",
          "glass",
          "paint",
          "wallpaper",
          "lighting",
          "furniture",
          "fixture",
          "accessory",
          "other",
        ]),
        tier: z.enum(["economy", "mid", "premium", "luxury", "ultra_luxury"]),
        typicalCostLow: z.number().optional(),
        typicalCostHigh: z.number().optional(),
        costUnit: z.string().default("AED/sqm"),
        leadTimeDays: z.number().optional(),
        leadTimeBand: z
          .enum(["short", "medium", "long", "critical"])
          .default("medium"),
        regionAvailability: z.array(z.string()).optional(),
        embodiedCarbon: z.number().optional(),
        maintenanceFactor: z.number().optional(),
        brandStandardApproval: z
          .enum(["open_market", "approved_vendor", "preferred_brand"])
          .default("open_market"),
        supplierName: z.string().optional(),
        supplierContact: z.string().optional(),
        supplierUrl: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await db.createMaterial({
        ...input,
        typicalCostLow: input.typicalCostLow
          ? (String(input.typicalCostLow) as any)
          : undefined,
        typicalCostHigh: input.typicalCostHigh
          ? (String(input.typicalCostHigh) as any)
          : undefined,
        embodiedCarbon: input.embodiedCarbon
          ? (String(input.embodiedCarbon) as any)
          : undefined,
        maintenanceFactor: input.maintenanceFactor
          ? (String(input.maintenanceFactor) as any)
          : undefined,
        createdBy: ctx.user.id,
      });
      return result;
    }),

  updateMaterial: adminProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        typicalCostLow: z.number().optional(),
        typicalCostHigh: z.number().optional(),
        embodiedCarbon: z.number().optional(),
        maintenanceFactor: z.number().optional(),
        brandStandardApproval: z
          .enum(["open_market", "approved_vendor", "preferred_brand"])
          .optional(),
        leadTimeDays: z.number().optional(),
        supplierName: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      const mapped: any = { ...updates };
      if (updates.typicalCostLow !== undefined)
        mapped.typicalCostLow = String(updates.typicalCostLow);
      if (updates.typicalCostHigh !== undefined)
        mapped.typicalCostHigh = String(updates.typicalCostHigh);
      if (updates.embodiedCarbon !== undefined)
        mapped.embodiedCarbon = String(updates.embodiedCarbon);
      if (updates.maintenanceFactor !== undefined)
        mapped.maintenanceFactor = String(updates.maintenanceFactor);
      await db.updateMaterial(id, mapped);
      return { success: true };
    }),

  deleteMaterial: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteMaterial(input.id);
      return { success: true };
    }),

  getMaterialConstants: protectedProcedure.query(async () => {
    return db.getMaterialConstants();
  }),

  calculateSpec: protectedProcedure
    .input(
      z.object({
        items: z.array(
          z.object({
            materialType: z.string(), // e.g. "concrete", "stone", "glass"
            areaM2: z.number().positive(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      const constants = await db.getMaterialConstants();
      const lookup = new Map(constants.map((c: any) => [c.materialType, c]));

      let totalCostAed = 0;
      let totalCarbonKg = 0;
      let weightedMaintenanceSum = 0;
      let totalArea = 0;
      const breakdown: Array<{
        materialType: string;
        areaM2: number;
        costPerM2: number;
        lineCostAed: number;
        carbonKg: number;
        maintenanceFactor: number;
        matched: boolean;
      }> = [];

      for (const item of input.items) {
        const c: any = lookup.get(item.materialType);
        if (!c) {
          breakdown.push({
            materialType: item.materialType,
            areaM2: item.areaM2,
            costPerM2: 0,
            lineCostAed: 0,
            carbonKg: 0,
            maintenanceFactor: 3,
            matched: false,
          });
          continue;
        }
        const costPerM2 = Number(c.costPerM2 ?? 0);
        const carbonIntensity = Number(c.carbonIntensity ?? 0); // kg CO²/m²
        const maintenanceFactor = Number(c.maintenanceFactor ?? 3);
        const lineCost = costPerM2 * item.areaM2;
        const lineCarbonKg = carbonIntensity * item.areaM2;

        totalCostAed += lineCost;
        totalCarbonKg += lineCarbonKg;
        weightedMaintenanceSum += maintenanceFactor * item.areaM2;
        totalArea += item.areaM2;

        breakdown.push({
          materialType: item.materialType,
          areaM2: item.areaM2,
          costPerM2,
          lineCostAed: lineCost,
          carbonKg: lineCarbonKg,
          maintenanceFactor,
          matched: true,
        });
      }

      const avgMaintenanceFactor =
        totalArea > 0 ? weightedMaintenanceSum / totalArea : 3;

      // Sustainability grade based on avg carbon intensity (kg/m²)
      const avgCarbonPerM2 = totalArea > 0 ? totalCarbonKg / totalArea : 0;
      let sustainabilityGrade: string;
      if (avgCarbonPerM2 < 30) sustainabilityGrade = "A";
      else if (avgCarbonPerM2 < 60) sustainabilityGrade = "B";
      else if (avgCarbonPerM2 < 100) sustainabilityGrade = "C";
      else if (avgCarbonPerM2 < 150) sustainabilityGrade = "D";
      else sustainabilityGrade = "E";

      return {
        totalCostAed: Math.round(totalCostAed),
        totalCarbonKg: Math.round(totalCarbonKg),
        avgMaintenanceFactor: Math.round(avgMaintenanceFactor * 10) / 10,
        sustainabilityGrade,
        totalAreaM2: totalArea,
        costPerM2Avg: totalArea > 0 ? Math.round(totalCostAed / totalArea) : 0,
        breakdown,
      };
    }),
});
