---
description: Run a full project evaluation end-to-end
---
# Run a Full Project Evaluation
1. Create project via `/api/trpc/project.create`
2. Call `project.evaluate` mutation with all 25 ProjectInputs
3. Verify scoreMatrix stored with: saScore, ffScore, mpScore, dsScore, erScore, compositeScore, riskScore
4. Verify decisionStatus is one of: validated / conditional / not_validated
5. Verify explainability report returns no undefined values for all 5 dimensions
6. Verify budgetFitMethod is stored (evidence_backed or benchmark_static)
