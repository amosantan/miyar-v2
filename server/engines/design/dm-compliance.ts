export function buildDMComplianceChecklist(
    projectId: number,
    orgId: number,
    project: any
): any {
    const typology = (project.ctx01Typology || "Residential").toLowerCase();
    const items: any[] = [];

    const pushItem = (code: string, desc: string, status: "Mandatory" | "Conditional") => {
        items.push({
            code,
            description: desc,
            status,
            verified: false
        });
    };

    if (typology === "commercial" || typology === "office") {
        pushItem("DCD-FLS", "Fire Life Safety Code (Dubai Civil Defence) Approval", "Mandatory");
        pushItem("DDA-ACC", "DDA Accessibility Guidelines (POD compliant WC)", "Mandatory");
        pushItem("DM-ASH", "ASHRAE Ventilation standard for open plan (Dubai Municipality)", "Mandatory");
        pushItem("DM-STR", "Structural NOC for internal partitions", "Conditional");
    } else if (typology === "hospitality") {
        pushItem("DM-FHS", "F&B Health & Safety (Dubai Municipality Food Safety Dept)", "Mandatory");
        pushItem("DET-CLS", "Dubai Economy & Tourism (DET) Classification requirements", "Mandatory");
        pushItem("DCD-FLS", "Fire Life Safety Code (Dubai Civil Defence)", "Mandatory");
        pushItem("SIRA-CCTV", "SIRA CCTV Layout Approval", "Mandatory");
    } else {
        // Residential (Villa/Apartment)
        pushItem("DEV-NOC", "Trakhees / Master Developer NOC (e.g. Nakheel, Emaar, DP)", "Mandatory");
        pushItem("DEWA-LV", "DEWA minor load variation approval", "Conditional");
        pushItem("DM-MOD", "Dubai Municipality Modification Permit", "Mandatory");
    }

    return {
        projectId,
        organizationId: orgId,
        items
    };
}
