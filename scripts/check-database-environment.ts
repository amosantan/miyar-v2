import {
  DATABASE_OPERATIONS,
  DatabaseSafetyError,
  formatDatabaseDecision,
  initializeDatabaseSafety,
  type DatabaseOperation,
} from "../server/_core/database-safety";

const operationArgument = process.argv.find(argument => argument.startsWith("--operation="));
const requestedOperation = operationArgument?.slice("--operation=".length) ?? "serve";

if (!DATABASE_OPERATIONS.includes(requestedOperation as DatabaseOperation)) {
  console.error(`[database-safety] Unknown operation: ${requestedOperation}`);
  process.exit(2);
}

try {
  const decision = initializeDatabaseSafety(requestedOperation as DatabaseOperation);
  console.log(JSON.stringify(formatDatabaseDecision(decision)));
} catch (error) {
  if (error instanceof DatabaseSafetyError) {
    console.error(JSON.stringify(formatDatabaseDecision(error.decision)));
    process.exit(1);
  }
  throw error;
}
