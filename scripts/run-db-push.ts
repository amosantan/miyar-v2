import 'dotenv/config';
import { execSync } from 'child_process';

console.log("Running DB Push with dotenv...");
try {
    execSync('npx drizzle-kit push', { stdio: 'inherit' });
} catch (e) {
    console.error(e);
    process.exit(1);
}
