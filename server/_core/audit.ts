import { getDb } from "../db";
import { auditLogs } from "../../drizzle/schema";

export async function auditLog(data: typeof auditLogs.$inferInsert) {
    try {
        const db = await getDb();
        if (!db) return;
        await db.insert(auditLogs).values(data);
    } catch (error) {
        console.error("[AuditLog] Failed to insert audit log:", error);
        // Silent fail - audit logging should never crash the main application flow
    }
}
