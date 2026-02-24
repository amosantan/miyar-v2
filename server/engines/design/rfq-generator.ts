import { Room } from "./space-program";

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
            supplierName
        });
    };

    const getSchedulesForRoom = (roomId: string) => finishSchedule.filter(f => f.roomId === roomId);

    // Section 1: Flooring Works
    rooms.forEach((room, idx) => {
        const floors = getSchedulesForRoom(room.id).filter(f => f.element === "floor");
        floors.forEach(floor => {
            const mat = getMaterial(floor.materialLibraryId);
            if (mat) {
                pushLine(
                    1,
                    `FL-${room.id}`,
                    `Supply & install ${mat.productName} to ${room.name}`,
                    "sqm",
                    room.sqm,
                    Number(mat.priceAedMin || 0),
                    Number(mat.priceAedMax || 0),
                    mat.supplierName
                );
            }
        });
    });

    // Section 2: Wall Finishes
    rooms.forEach((room, idx) => {
        const walls = getSchedulesForRoom(room.id).filter(f => f.element.startsWith("wall_"));
        walls.forEach(wall => {
            const mat = getMaterial(wall.materialLibraryId);
            if (mat) {
                // Assuming wall area approx 2.5x floor area for paint, 1x for wet/feature
                const areaMultiplier = wall.element === "wall_primary" ? 2.5 : 1.0;
                const qty = room.sqm * areaMultiplier;
                pushLine(
                    2,
                    `WL-${room.id}-${wall.element.split("_")[1]}`,
                    `Supply & apply ${mat.productName} to ${room.name} (${wall.element})`,
                    "sqm",
                    qty,
                    Number(mat.priceAedMin || 0),
                    Number(mat.priceAedMax || 0),
                    mat.supplierName
                );
            }
        });
    });

    // Section 3: Ceiling Works
    rooms.forEach((room, idx) => {
        const ceil = getSchedulesForRoom(room.id).find(f => f.element === "ceiling");
        if (ceil) {
            // Mock standard rates for ceiling types since they are string overrides
            let rateMin = 90;
            let rateMax = 120;
            if (ceil.overrideSpec?.includes("Coffered")) { rateMin = 180; rateMax = 250; }
            if (ceil.overrideSpec?.includes("Cove")) { rateMin = 130; rateMax = 160; }

            pushLine(
                3,
                `CL-${room.id}`,
                `Supply & install ${ceil.overrideSpec || "Gypsum Ceiling"} to ${room.name}`,
                "sqm",
                room.sqm,
                rateMin,
                rateMax,
                "Various Subcontractors"
            );
        }
    });

    // Section 4: Joinery & Built-ins
    rooms.forEach((room, idx) => {
        const joinery = getSchedulesForRoom(room.id).find(f => f.element === "joinery");
        if (joinery && ["MBR", "BD2", "BD3", "KIT", "LVG"].includes(room.id)) {
            // Estimate LM of joinery
            let lm = room.sqm * 0.2;
            let rateMin = 1200;
            let rateMax = 1800; // per LM
            if (room.id === "KIT") { rateMin = 2000; rateMax = 3500; lm = room.sqm * 0.4; } // Kitchens more expensive

            pushLine(
                4,
                `JN-${room.id}`,
                `Custom Joinery / Wardrobes / Cabinets in ${room.name} (${joinery.overrideSpec})`,
                "lm",
                lm,
                rateMin,
                rateMax,
                "Specialist Joinery"
            );
        }
    });

    // Section 5: Sanitaryware & Fittings
    // Group all sanitaryware instances from schedule (which is not in the schedule explicitly mapped by room fixture currently)
    // But wait, the schedule generator might not explicitly map each fixture. So I'll assign standard sets for wet rooms.
    const wetRooms = rooms.filter(r => ["MEN", "BTH", "UTL", "KIT"].includes(r.id));
    wetRooms.forEach(room => {
        // Just find a sanitaryware material randomly if not explicitly in schedule.
        const swMat = materials.find(m => m.category === "sanitaryware");
        if (swMat) {
            pushLine(
                5,
                `SW-${room.id}`,
                `Allow for Sanitaryware & Brassware package for ${room.name}`,
                "set",
                1,
                Number(swMat.priceAedMin || 0) * 3, // rough multiplier for a full room set
                Number(swMat.priceAedMax || 0) * 4,
                swMat.supplierName
            );
        }
    });

    // Section 6: Provisional Sums
    // Contingency 10%
    rfqItems.push({
        projectId,
        organizationId: orgId,
        sectionNo: 6,
        itemCode: "PS-01",
        description: "Contingency (10% of Sections 1-5)",
        unit: "sum",
        quantity: 1,
        unitRateAedMin: subtotalMin * 0.1,
        unitRateAedMax: subtotalMax * 0.1,
        totalAedMin: subtotalMin * 0.1,
        totalAedMax: subtotalMax * 0.1,
        supplierName: ""
    });

    // DM / DDA approval
    rfqItems.push({
        projectId,
        organizationId: orgId,
        sectionNo: 6,
        itemCode: "PS-02",
        description: "DM/DDA Approval Fees (Provisional)",
        unit: "sum",
        quantity: 1,
        unitRateAedMin: 15000,
        unitRateAedMax: 15000,
        totalAedMin: 15000,
        totalAedMax: 15000,
        supplierName: "Dubai Authorities"
    });

    // FF&E Management
    rfqItems.push({
        projectId,
        organizationId: orgId,
        sectionNo: 6,
        itemCode: "PS-03",
        description: "FF&E Procurement Management (Provisional)",
        unit: "sum",
        quantity: 1,
        unitRateAedMin: 25000,
        unitRateAedMax: 25000,
        totalAedMin: 25000,
        totalAedMax: 25000,
        supplierName: "Design Consultant"
    });

    return rfqItems;
}
