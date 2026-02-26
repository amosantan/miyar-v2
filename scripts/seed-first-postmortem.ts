/**
 * MIYAR Phase A4 — Seed First Post-Mortem Outcome
 *
 * Picks an existing evaluated project and inserts a realistic
 * project outcome to activate the V5 learning loop.
 *
 * Run: npx tsx scripts/seed-first-postmortem.ts
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2";
import { eq, desc } from "drizzle-orm";
import { projects, scoreMatrices, projectOutcomes } from "../drizzle/schema";

async function main() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        console.error("DATABASE_URL not set");
        process.exit(1);
    }

    const url = new URL(databaseUrl);
    const pool = mysql.createPool({
        host: url.hostname,
        port: url.port ? parseInt(url.port) : 3306,
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: url.pathname.slice(1),
        ssl: { rejectUnauthorized: true },
        waitForConnections: true,
        connectionLimit: 5,
    });
    const db = drizzle(pool);

    console.log("🔍 Finding an evaluated project with a score matrix...");

    // Find an evaluated project with scores
    const evaluatedProjects = await db
        .select({
            id: projects.id,
            name: projects.name,
            status: projects.status,
        })
        .from(projects)
        .where(eq(projects.status, "evaluated"))
        .limit(5);

    if (evaluatedProjects.length === 0) {
        console.error("❌ No evaluated projects found. Please evaluate a project first.");
        pool.end();
        process.exit(1);
    }

    const project = evaluatedProjects[0];
    console.log(`✅ Using project: "${project.name}" (ID: ${project.id})`);

    // Get the latest score matrix for this project
    const scores = await db
        .select()
        .from(scoreMatrices)
        .where(eq(scoreMatrices.projectId, project.id))
        .orderBy(desc(scoreMatrices.computedAt))
        .limit(1);

    if (scores.length === 0) {
        console.error("❌ No score matrix found for this project.");
        pool.end();
        process.exit(1);
    }

    const score = scores[0];
    console.log(`📊 Score matrix found — Composite: ${score.compositeScore}, Decision: ${score.decisionStatus}`);

    // Check if a post-mortem already exists
    const existing = await db
        .select()
        .from(projectOutcomes)
        .where(eq(projectOutcomes.projectId, project.id))
        .limit(1);

    if (existing.length > 0) {
        console.log("ℹ️  Post-mortem already exists for this project. Skipping insertion.");
        pool.end();
        return;
    }

    // Create realistic outcome data matching the actual schema:
    // projectOutcomes has: projectId, procurementActualCosts, leadTimesActual, rfqResults,
    //   adoptionMetrics, actualFitoutCostPerSqm, actualTotalCost, projectDeliveredOnTime,
    //   reworkOccurred, reworkCostAed, clientSatisfactionScore, tenderIterations, keyLessonsLearned

    // Simulate realistic post-mortem data
    const addVariance = (base: number, maxPct: number = 10): number => {
        const variance = (Math.random() * 2 - 1) * maxPct;
        return Math.round(base * (1 + variance / 100) * 100) / 100;
    };

    const outcome = {
        projectId: project.id,
        actualFitoutCostPerSqm: String(addVariance(850, 12)),   // AED per sqm, realistic UAE luxury
        actualTotalCost: String(addVariance(2500000, 15)),       // ~2.5M AED with ±15% variance
        projectDeliveredOnTime: Math.random() > 0.3,             // 70% chance on-time
        reworkOccurred: Math.random() > 0.6,                     // 40% chance of rework
        reworkCostAed: String(addVariance(50000, 30)),            // Rework cost if applicable
        clientSatisfactionScore: Math.floor(70 + Math.random() * 25), // 70-95 range
        tenderIterations: Math.floor(2 + Math.random() * 3),     // 2-4 iterations
        keyLessonsLearned: "First post-mortem seeded for V5 learning loop activation. Key findings: actual costs were within acceptable variance of predicted benchmarks. Material procurement timelines were the primary driver of any delays.",
        procurementActualCosts: {
            flooring: addVariance(120000, 10),
            lighting: addVariance(85000, 15),
            joinery: addVariance(200000, 8),
            sanitary: addVariance(65000, 12),
            paintFinishes: addVariance(45000, 10),
        },
        leadTimesActual: {
            flooring: `${Math.floor(6 + Math.random() * 4)} weeks`,
            lighting: `${Math.floor(4 + Math.random() * 3)} weeks`,
            joinery: `${Math.floor(8 + Math.random() * 4)} weeks`,
            sanitary: `${Math.floor(3 + Math.random() * 2)} weeks`,
        },
        rfqResults: {
            totalRfqsSent: 12,
            responsesReceived: 8,
            averageResponseTimeDays: 5,
            bestQuoteVarianceFromBenchmark: "-7%",
        },
        adoptionMetrics: {
            scenariosRun: 4,
            reportsGenerated: 3,
            overridesApplied: 1,
            designBriefsGenerated: 2,
        },
    };

    console.log("\n📝 Inserting post-mortem outcome:");
    console.log(`  Actual fitout cost/sqm: ${outcome.actualFitoutCostPerSqm} AED`);
    console.log(`  Actual total cost: ${outcome.actualTotalCost} AED`);
    console.log(`  Delivered on time: ${outcome.projectDeliveredOnTime}`);
    console.log(`  Rework occurred: ${outcome.reworkOccurred}`);
    console.log(`  Client satisfaction: ${outcome.clientSatisfactionScore}/100`);
    console.log(`  Tender iterations: ${outcome.tenderIterations}`);

    await db.insert(projectOutcomes).values(outcome);

    console.log(`\n🎉 Successfully inserted post-mortem for "${project.name}"`);
    console.log("   The V5 learning loop (comparator → calibrator → ledger) can now activate!");

    pool.end();
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
