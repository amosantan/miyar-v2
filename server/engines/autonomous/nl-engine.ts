import { invokeLLM } from "../../_core/llm";
import { getDb } from "../../db";
import { sql } from "drizzle-orm";
import { nlQueryLog } from "../../../drizzle/schema";

const SCHEMA_CONTEXT = `
You are an expert data analyst for MIYAR, an interior design validation platform. 
Your task is to translate user natural language queries into valid MySQL SELECT queries.

Database Schema Context (Use exact camelCase column names as provided):
- users: id, email, role, createdAt
- projects: id, name, userId, status, ctx01Typology, ctx04Location, mkt01Tier, createdAt, updatedAt
- score_matrices: id, projectId, compositeScore, rasScore, riskScore, confidenceScore, decisionStatus, saScore, ffScore, mpScore, dsScore, erScore, createdAt
- benchmark_data: id, typology, location, marketTier, totalCostMid, areaMid, scopeFactors
- platform_alerts: id, severity (critical, high, medium, info), alertType (price_shock, project_at_risk, accuracy_degraded, pattern_warning, benchmark_drift, market_opportunity), title, message, status (active, acknowledged, resolved), affectedProjectIds (JSON), createdAt
- project_outcomes: id, projectId, metric, predictedVal, actualVal, deltaPct, accuracyScore, status

CRITICAL RULES:
1. Generate ONLY a valid MySQL SELECT query. Do NOT include markdown blocks (like \`\`\`sql).
2. ONLY use SELECT. Do NOT use INSERT, UPDATE, DELETE, DROP.
3. Be aware of the tables and EXACT column names provided (they use camelCase).
4. If a user asks for "highest risk" or "low score", riskScore > 60 is high risk, score < 50 is low score.
5. Limit the results to 50 rows maximum to prevent huge payloads.
6. If the user asks a conversational question (e.g. "hi"), or asks you to perform an action (e.g. "create a project", "delete this"), DO NOT output SQL. Output a polite conversational response starting exactly with the prefix "MESSAGE: " and explain your capabilities (you are a data retrieval assistant).
`;

export async function processNlQuery(userId: number, query: string): Promise<{ textOutput: string; rawData: any[]; sqlGenerated: string }> {
    const startTime = Date.now();
    let generatedSql = "";
    let rawData: any[] = [];
    let textOutput = "";
    let status: "success" | "error" | "blocked" = "success";

    try {
        // Phase 1: Text to SQL
        const sqlResponse = await invokeLLM({
            messages: [
                { role: "system", content: SCHEMA_CONTEXT },
                { role: "user", content: `User query: ${query}\nGenerate the MySQL query.` }
            ],
        });

        const content = sqlResponse.choices?.[0]?.message?.content;
        generatedSql = typeof content === "string"
            ? content
            : Array.isArray(content)
                ? content.map((c: any) => c.text || "").join("")
                : "";

        generatedSql = generatedSql.trim();

        // Handle conversational bypass
        if (generatedSql.startsWith("MESSAGE:")) {
            return {
                textOutput: generatedSql.replace("MESSAGE:", "").trim(),
                rawData: [],
                sqlGenerated: ""
            };
        }

        // Remove markdown code blocks if the LLM adds them despite instructions
        generatedSql = generatedSql.replace(/^```sql\n?/, "").replace(/\n?```$/, "").trim();

        // Prevent any non-READ operations gracefully instead of crashing
        if (!generatedSql.toUpperCase().startsWith("SELECT")) {
            return {
                textOutput: "I am a read-only data assistant and cannot perform actions that modify data (like creating or updating records). Please use the MIYAR platform interfaces to perform those actions, or ask me for data insights!",
                rawData: [],
                sqlGenerated: generatedSql
            };
        }

        const db = await getDb();
        if (!db) throw new Error("Database not connected");

        try {
            // Execute raw SQL using Drizzle sql.raw
            const result = await db.execute(sql.raw(generatedSql));

            if (Array.isArray(result) && result.length > 0 && Array.isArray(result[0])) {
                // PlanetScale/MySQL2 driver returns exactly [rows, fields]
                rawData = result[0];
            } else {
                rawData = result as any[];
            }
        } catch (dbError: any) {
            console.error("[NlEngine] SQL Execution Error:", dbError);
            status = "error";
            return {
                textOutput: `I experienced an error executing the generated query. I might need a more specific prompt. (Internal Error: ${dbError.message})`,
                rawData: [],
                sqlGenerated: generatedSql
            };
        }

        // Phase 3: Interpretation
        const interpretationContext = `
You are a helpful MIYAR data analyst assistant.
The user asked a question, we translated it to SQL, and got the following raw JSON data.
Please provide a clear, concise, and professional answer to the user based on the data.
Avoid exposing raw JSON or SQL. 
Explain the findings in simple terms.
`;

        // Limit the data sent to the LLM to avoid context limits
        const truncatedData = rawData.slice(0, 20);

        const answerResponse = await invokeLLM({
            messages: [
                { role: "system", content: interpretationContext },
                { role: "user", content: `User Question: ${query}\n\nData Returned:\n${JSON.stringify(truncatedData, null, 2)}` }
            ]
        });

        const ansContent = answerResponse.choices?.[0]?.message?.content;
        textOutput = typeof ansContent === "string"
            ? ansContent
            : Array.isArray(ansContent)
                ? ansContent.map((c: any) => c.text || "").join("")
                : "";

        return {
            textOutput,
            rawData,
            sqlGenerated: generatedSql
        };

    } catch (error: any) {
        console.error("[NlEngine] Query processing failed:", error);
        status = "error";
        throw new Error(error.message || "Failed to process natural language query.");
    } finally {
        const executionMs = Date.now() - startTime;
        const db = await getDb();
        if (db && userId) {
            try {
                await db.insert(nlQueryLog).values({
                    userId,
                    queryText: query,
                    sqlGenerated: generatedSql || undefined,
                    rowsReturned: rawData.length,
                    executionMs,
                    status
                });
            } catch (logErr) {
                console.error("[NlEngine] Failed to log NL query:", logErr);
            }
        }
    }
}
