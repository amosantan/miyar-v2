import { execSync } from 'child_process';
import {
    databaseSafetyChildEnvironment,
    initializeDatabaseSafety,
} from "../server/_core/database-safety";

initializeDatabaseSafety("migrate", { loadDotenv: true });

console.log("Running DB Push with guarded configuration...");
try {
    execSync('npx drizzle-kit push', {
        env: databaseSafetyChildEnvironment("migrate"),
        stdio: 'inherit',
    });
} catch (e) {
    console.error(e);
    process.exit(1);
}
