import { triggerAlertEngine } from "./alert-engine";

export function startAlertScheduler() {
    console.log("[AlertScheduler] Started — evaluating every 15 minutes");

    // Evaluate immediately on start
    runTick();

    // Run every 15 minutes
    setInterval(runTick, 15 * 60 * 1000);
}

async function runTick() {
    try {
        const insertedAlerts = await triggerAlertEngine();
        console.log(`[AlertScheduler] Evaluated alerts, inserted ${insertedAlerts.length} new`);
    } catch (e) {
        console.error("[AlertScheduler] Error during alert evaluation:", e);
    }
}
