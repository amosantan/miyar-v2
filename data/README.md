# Repository Data

This directory contains versioned data inputs used by explicit import and migration scripts.

| Path       | Purpose                                                    |
| ---------- | ---------------------------------------------------------- |
| `exports/` | Dated source exports consumed by the DLD ingestion scripts |

Do not add credentials, customer records, production database dumps, or undocumented exports. New datasets must identify provenance, acquisition date, intended consumer, sensitivity, and a removal/refresh policy. Prefer external object storage for large or frequently updated datasets.
