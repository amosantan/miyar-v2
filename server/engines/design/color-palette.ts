
import { DesignVocabulary } from "./vocabulary";
import { paletteSeeds } from "./palette-seeds";
import { invokeLLM } from "../../_core/llm";

export async function buildColorPalette(
    project: any,
    vocab: DesignVocabulary
): Promise<any> {
    const palette = paletteSeeds[vocab.paletteKey] || paletteSeeds["warm_minimalism"];

    const prompt = `Why these colors (${palette.colors.map((c: any) => c.name).join(", ")}) work for ${project.name} in ${project.ctx04Location || "Dubai"} given the ${vocab.styleFamily} direction and ${vocab.materialTier} market position. Please write a 3-sentence stylistic rationale narrative. Do not use asterisks or markdown in your response.`;

    let rationale = "A curated selection of tones tailored for optimal aesthetic and functional resonance.";
    try {
        const result = await invokeLLM({
            messages: [{ role: "user", content: prompt }]
        });

        if (result && result.choices && result.choices.length > 0) {
            rationale = result.choices[0].message.content as string;
        }
    } catch (err) {
        console.error("Failed to generate palette rationale:", err);
    }

    return {
        projectId: project.id,
        organizationId: project.organizationId,
        paletteKey: vocab.paletteKey,
        colors: palette.colors,
        geminiRationale: rationale
    };
}
