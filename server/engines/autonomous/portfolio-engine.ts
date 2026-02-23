import { invokeLLM } from "../../_core/llm";
import { getDb } from "../../db";
import { projects, scoreMatrices } from "../../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import {
    computeDistributions,
    computeComplianceHeatmap,
    detectFailurePatterns,
    computeImprovementLevers,
    type PortfolioProject
} from "../portfolio";

export async function generatePortfolioInsights(): Promise<string> {
    const db = await getDb();
    if (!db) throw new Error("Database error");

    // Fetch all scored projects
    const allProjects = await db.select()
        .from(projects)
        .where(eq(projects.status, "evaluated"));

    if (allProjects.length === 0) {
        return "No evaluated projects available for portfolio analysis.";
    }

    const portfolioProjects: PortfolioProject[] = [];

    for (const p of allProjects) {
        const scores = await db.select()
            .from(scoreMatrices)
            .where(eq(scoreMatrices.projectId, p.id))
            .orderBy(desc(scoreMatrices.computedAt))
            .limit(1);

        if (scores.length > 0) {
            const s = scores[0];
            portfolioProjects.push({
                project: p,
                scoreMatrix: s,
                intelligence: {
                    costBand: p.fin01BudgetCap ? p.fin01BudgetCap + " AED/sqft" : "market_mid"
                } as any
            });
        }
    }

    // Generate quantitative metrics
    const distributions = computeDistributions(portfolioProjects);
    const heatmap = computeComplianceHeatmap(portfolioProjects);
    const failurePatterns = detectFailurePatterns(portfolioProjects);
    const levers = computeImprovementLevers(portfolioProjects);

    // Strip down raw project data for token limit safety
    const briefProjects = portfolioProjects.map(p => ({
        name: p.project.name,
        tier: p.project.mkt01Tier || "Unknown",
        score: Number(p.scoreMatrix.compositeScore),
        status: p.project.status,
        risk: Number(p.scoreMatrix.riskScore)
    }));

    const payload = {
        summary: {
            totalProjects: briefProjects.length,
            averageScore: briefProjects.reduce((acc, curr) => acc + curr.score, 0) / briefProjects.length,
        },
        distributions,
        failurePatterns,
        topLevers: levers.slice(0, 5)
    };

    const sysPrompt = [
        "You are the MIYAR Portfolio Intelligence Engine.",
        "You analyze an entire real estate portfolio to identify macroeconomic trends, systemic risks, and cross-project strategic opportunities.",
        "",
        "You will receive a JSON payload containing aggregated portfolio data: score distributions, common failure patterns, and high-impact improvement levers across the whole group of evaluated projects.",
        "",
        "Your objective is to produce a markdown-formatted executive briefing:",
        "1. 'Macro Overview': A summary of the portfolio overall health and the prevailing market tier distributions.",
        "2. 'Systemic Risks': Analysis of the Failure Patterns, identifying repeated flaws in execution, financial viability, or design across multiple projects.",
        "3. 'Strategic Directives': Actionable directives derived from the Improvement Levers, providing guidance to the C-suite on how to lift the portfolio total value.",
        "",
        "Output only valid Markdown formatting. Keep it highly analytical, objective, and extremely professional. Use bolding to highlight key metrics."
    ].join("\\n");

    const userPrompt = [
        "Portfolio Analytics Payload:",
        JSON.stringify(payload, null, 2),
        "",
        "Provide the Portfolio Intelligence Executive Briefing."
    ].join("\\n");

    try {
        const result = await invokeLLM({
            messages: [
                { role: "system", content: sysPrompt },
                { role: "user", content: userPrompt }
            ]
        });

        const choice = result.choices[0];
        let markdown = "Analysis could not be generated.";

        if (choice.message?.content) {
            markdown = choice.message.content as string;
        } else if ((choice as any).text) {
            markdown = (choice as any).text as string;
        }

        return markdown;
    } catch (err: any) {
        console.error("Portfolio Engine Error:", err);
        return "**Error generating portfolio insights:** " + err.message;
    }
}
