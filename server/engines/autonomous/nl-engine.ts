import { invokeLLM } from "../../_core/llm";
import { getDb } from "../../db";
import { sql } from "drizzle-orm";
import { nlQueryLog } from "../../../drizzle/schema";

const SCHEMA_CONTEXT = `
You are an expert data analyst for MIYAR, an interior design validation platform. 
Your task is to translate user natural language queries into valid MySQL SELECT queries.

Database Schema Context:
- users: id, email, role, created_at
- projects: id, name, user_id, status, ctx01_typology, ctx04_location, mkt01_tier, created_at, updated_at
- project_score_matrices: id, project_id, composite_score, ras_score, risk_score, confidence_score, decision_status, sa_score, ff_score, mp_score, ds_score, er_score, created_at
- benchmarks: id, typology, location, market_tier, total_cost_mid, area_mid, scope_factors
- platform_alerts: id, severity (critical, high, medium, info), alert_type (price_shock, project_at_risk, accuracy_degraded, pattern_warning, benchmark_drift, market_opportunity), title, message, status (active, acknowledged, resolved), affected_project_ids (JSON), created_at
- learning_signals: id, project_id, metric, predicted_val, actual_val, delta_pct, accuracy_score, status

CRITICAL RULES:
1. Generate ONLY a valid MySQL SELECT query. Do NOT include markdown blocks (like \`\`\`sql).
2. ONLY use SELECT. Do NOT use INSERT, UPDATE, DELETE, DROP.
3. Be aware of the tables and column names provided.
4. If a user asks for "highest risk" or "low score", risk_score > 60 is high risk, score < 50 is low score.
5. Limit the results to 50 rows maximum to prevent huge payloads.
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
        // Remove markdown code blocks if the LLM adds them despite instructions
        generatedSql = generatedSql.replace(/^```sql\n?/, "").replace(/\n?```$/, "").trim();

        // Prevent any non-READ operations
        if (!generatedSql.toUpperCase().startsWith("SELECT")) {
            throw new Error("Only SELECT queries are allowed for security reasons.");
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
                textOutput: `I experienced an error executing the generated query. Error: ${dbError.message}`,
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
