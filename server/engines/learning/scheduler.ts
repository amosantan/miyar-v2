/**
 * Cross-organization learning is intentionally disabled under TR-05.
 *
 * The former weekly scheduler aggregated every organization's outcomes, scores,
 * and projects into shared accuracy, benchmark, logic, and pattern artifacts.
 * A runtime flag is not sufficient authority to enable that data use.
 *
 * A future implementation requires a separately approved cohort contract with:
 * - explicit organization consent,
 * - anonymization,
 * - at least 10 organizations and 30 projects,
 * - a durable corpus-policy version and approval record.
 */
export function startLearningScheduler() {
  console.info(
    "[Learning Scheduler] Disabled: pooled learning requires separate governance approval"
  );
  return {
    started: false,
    reason: "pooled_learning_disabled" as const,
  };
}
