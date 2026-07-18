import {
  initializeDatabaseSafety,
  logDatabaseDecision,
} from "./database-safety";

export const serveDatabaseDecision = initializeDatabaseSafety(
  process.env.NODE_ENV === "test" ? "unit-test" : "serve"
);

if (process.env.NODE_ENV !== "test") {
  logDatabaseDecision(serveDatabaseDecision);
}
