
export type Room = {
    id: string;
    name: string;
    sqm: number;
    budgetPct: number;
    priority: "high" | "medium" | "low";
    finishGrade: "A" | "B" | "C";
};

export type SpaceProgram = {
    totalFitoutBudgetAed: number;
    rooms: Room[];
    totalAllocatedSqm: number;
};

export function buildSpaceProgram(project: any): SpaceProgram {
    const gfa = Number(project.ctx03Gfa || 0); // sqm
    const budgetCap = Number(project.fin01BudgetCap || 0); // AED/sqft
    const typology = (project.ctx01Typology || "Residential").toLowerCase();

    // totalFitoutBudgetAed = GFA × budgetCap × 10.764 × 0.35
    const totalFitoutBudgetAed = gfa * budgetCap * 10.764 * 0.35;

    let baseRooms: { id: string; name: string; pctSqm: number; pctBudget: number; priority: "high" | "medium" | "low"; finishGrade: "A" | "B" | "C" }[] = [];

    if (typology === "hospitality") {
        baseRooms = [
            { id: "LBY", name: "Hotel Lobby", pctSqm: 0.20, pctBudget: 0.30, priority: "high", finishGrade: "A" },
            { id: "GRM", name: "Guest Room (std)", pctSqm: 0.25, pctBudget: 0.20, priority: "high", finishGrade: "A" },
            { id: "GRS", name: "Guest Room (suite)", pctSqm: 0.10, pctBudget: 0.20, priority: "high", finishGrade: "A" },
            { id: "FBB", name: "F&B / Restaurant", pctSqm: 0.20, pctBudget: 0.15, priority: "high", finishGrade: "A" },
            { id: "COR", name: "Corridors", pctSqm: 0.15, pctBudget: 0.05, priority: "medium", finishGrade: "B" },
            { id: "BOH", name: "Back of House", pctSqm: 0.10, pctBudget: 0.10, priority: "low", finishGrade: "C" },
        ];
    } else if (typology === "commercial" || typology === "office") {
        baseRooms = [
            { id: "OPN", name: "Open Plan Office", pctSqm: 0.40, pctBudget: 0.25, priority: "medium", finishGrade: "B" },
            { id: "MET", name: "Meeting Rooms", pctSqm: 0.20, pctBudget: 0.30, priority: "high", finishGrade: "A" },
            { id: "RCP", name: "Reception", pctSqm: 0.10, pctBudget: 0.20, priority: "high", finishGrade: "A" },
            { id: "BRK", name: "Break Areas", pctSqm: 0.10, pctBudget: 0.10, priority: "medium", finishGrade: "B" },
            { id: "COR", name: "Circulation", pctSqm: 0.10, pctBudget: 0.05, priority: "low", finishGrade: "C" },
            { id: "UTL", name: "Utility & WCs", pctSqm: 0.10, pctBudget: 0.10, priority: "medium", finishGrade: "B" },
        ];
    } else {
        // Default: Residential
        baseRooms = [
            { id: "LVG", name: "Living & Dining", pctSqm: 0.28, pctBudget: 0.28, priority: "high", finishGrade: "A" },
            { id: "MBR", name: "Master Bedroom", pctSqm: 0.18, pctBudget: 0.22, priority: "high", finishGrade: "A" },
            { id: "MEN", name: "Master Ensuite", pctSqm: 0.08, pctBudget: 0.14, priority: "high", finishGrade: "A" },
            { id: "KIT", name: "Kitchen", pctSqm: 0.10, pctBudget: 0.16, priority: "high", finishGrade: "A" },
            { id: "BD2", name: "Bedroom 2", pctSqm: 0.10, pctBudget: 0.07, priority: "medium", finishGrade: "B" },
            { id: "BD3", name: "Bedroom 3", pctSqm: 0.08, pctBudget: 0.05, priority: "medium", finishGrade: "B" },
            { id: "BTH", name: "Bathroom 2", pctSqm: 0.05, pctBudget: 0.05, priority: "medium", finishGrade: "B" },
            { id: "ENT", name: "Entry & Corridors", pctSqm: 0.08, pctBudget: 0.02, priority: "low", finishGrade: "B" },
            { id: "UTL", name: "Utility & Maid's", pctSqm: 0.05, pctBudget: 0.01, priority: "low", finishGrade: "C" },
        ];
    }

    const rooms: Room[] = baseRooms.map(r => ({
        id: r.id,
        name: r.name,
        sqm: Number((gfa * r.pctSqm).toFixed(2)),
        budgetPct: r.pctBudget,
        priority: r.priority,
        finishGrade: r.finishGrade
    }));

    const totalAllocatedSqm = rooms.reduce((sum, r) => sum + r.sqm, 0);

    return {
        totalFitoutBudgetAed,
        rooms,
        totalAllocatedSqm
    };
}
