import { DesignVocabulary } from "./vocabulary";
import { Room } from "./space-program";

export function buildFinishSchedule(
    project: any,
    vocab: DesignVocabulary,
    rooms: Room[],
    materials: any[] // Rows from materialLibrary
): any[] {
    const schedule: any[] = [];

    const downgradeTier = (tier: string) => {
        if (tier === "ultra") return "premium";
        if (tier === "premium") return "mid";
        if (tier === "mid") return "affordable";
        return "affordable";
    };

    const getMaterial = (element: string, roomTier: string, elementStyle: string) => {
        // Determine the corresponding category in materialLibrary
        let category = element;
        if (element === "floor") category = "flooring";
        else if (element.startsWith("wall_")) {
            if (element === "wall_wet") category = "wall_tile";
            else category = "wall_paint";
        }

        // Try finding exact match
        let match = materials.find(m =>
            m.category === category &&
            m.tier === roomTier &&
            (m.style === elementStyle || m.style === "all")
        );

        // Fallback 1: Any style in the tier
        if (!match) match = materials.find(m => m.category === category && m.tier === roomTier);

        // Fallback 2: Any tier in the style
        if (!match) match = materials.find(m => m.category === category && (m.style === elementStyle || m.style === "all"));

        // Fallback 3: First in category
        if (!match) match = materials.find(m => m.category === category);

        return match;
    };

    for (const room of rooms) {
        const elements = ["floor", "wall_primary", "wall_feature", "wall_wet", "ceiling", "joinery", "hardware"];

        for (const element of elements) {
            if (element === "wall_wet" && ["LVG", "MBR", "BD2", "BD3", "ENT", "OPN", "MET", "RCP", "BRK", "COR"].includes(room.id)) {
                continue; // Skip wet walls for dry rooms
            }

            if (element === "wall_feature" && ["UTL", "BOH", "COR", "ENT", "BTH", "MEN"].includes(room.id)) {
                continue; // Skip feature walls in utility/secondary spaces
            }

            let activeTier = vocab.materialTier;

            if (room.finishGrade === "C") {
                activeTier = "affordable";
            } else if (room.finishGrade === "B") {
                if (element === "floor" || element === "wall_primary") {
                    activeTier = downgradeTier(activeTier);
                }
            }

            // Determine palette style string to search for based on paletteKey prefix (e.g. warm_minimalism -> minimalist)
            let activeStyle = "modern";
            if (vocab.paletteKey.includes("minimalism")) activeStyle = "minimalist";
            else if (vocab.paletteKey.includes("arabesque")) activeStyle = "arabesque";
            else if (vocab.paletteKey.includes("classic")) activeStyle = "classic";

            const material = getMaterial(element, activeTier, activeStyle);

            let overrideSpec = null;
            if (element === "ceiling") overrideSpec = vocab.ceilingType;
            if (element === "joinery") overrideSpec = vocab.joinery;
            if (element === "hardware") overrideSpec = vocab.hardwareFinish;

            schedule.push({
                projectId: project.id,
                organizationId: project.organizationId,
                roomId: room.id,
                roomName: room.name,
                element: element,
                materialLibraryId: material ? material.id : null,
                overrideSpec: overrideSpec,
                notes: material ? material.notes : null
            });
        }
    }

    return schedule;
}
