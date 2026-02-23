import { getDb } from "../../db";
import { invokeLLM } from "../../_core/llm";
import { projects, scoreMatrices } from "../../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

export async function generateAutonomousDesignBrief(projectId: number): Promise<string> {
    const db = await getDb();
    if (!db) throw new Error("Database not connected");

    // Load project details
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
    if (!project) throw new Error("Project not found");

    // Load latest scores
    const scoreRecords = await db.select()
        .from(scoreMatrices)
        .where(eq(scoreMatrices.projectId, projectId))
        .orderBy(desc(scoreMatrices.computedAt))
        .limit(1);

    const scores = scoreRecords[0] || null;

    // Build the context prompt
    const systemPrompt = `
You are an expert real estate development consultant and interior design strategist for MIYAR.
Write a comprehensive "Design Brief" document based on the provided project data and scores.

The output MUST be presented in well - structured Markdown, containing:
1. Executive Summary
2. Strategic Positioning
3. Key Risks & Mitigations
4. Architectural & Interior Guidelines
5. 5 - Lens Assessment(if scores are available)

Make the tone professional, persuasive, and highly analytical.

Project Context:
- Name: ${project.name}
- Typology: ${project.ctx01Typology}
- Tier: ${project.mkt01Tier}
- Location: ${project.ctx04Location}
- Horizon: ${project.ctx05Horizon}

${scores ? `
Latest Evaluation Scores:
- Composite Score: ${scores.compositeScore}
- Risk Level: ${scores.riskScore}
- Confidence: ${scores.confidenceScore}
- Strategic Alignment: ${scores.saScore}
- Financial Feasibility: ${scores.ffScore}
- Market Positioning: ${scores.mpScore}
- Design & Sustainability: ${scores.dsScore}
- Execution Risk: ${scores.erScore}
` : "No evaluation scores generated yet."
        }
`;

    // Process LLM query
    const response = await invokeLLM({
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: "Please generate the comprehensive design brief." }
        ]
    });

    const content = response.choices?.[0]?.message?.content;
    const markdownOutput = typeof content === "string"
        ? content
        : Array.isArray(content)
            ? content.map((c: any) => c.text || "").join("")
            : "";

    return markdownOutput.trim();
}
