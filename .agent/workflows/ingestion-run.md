---
description: Run market data ingestion pipeline
---
# Run Market Ingestion
1. Call `ingestion.runAll` via tRPC
2. Check `ingestionRuns` table for new record
3. Verify `connectorHealth` has one row per connector per run
4. Check `evidenceRecords` count increased
5. After ingestion: run `analytics.getTrends` to refresh trend snapshots
