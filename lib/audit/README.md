# Audit logging

## Expected schema (normalized)

After `20260348000000_audit_logs_normalize.sql`:

| Column | Purpose |
|--------|---------|
| `actor_id` | UUID of the user performing the action (acting user). |
| `team_id` | Optional FK to `teams` for coach-facing filters. |
| `action_type` | Short machine-readable action key (e.g. `message_soft_deleted`). |
| `target_type` | Optional entity type (e.g. `message`, `event`). |
| `target_id` | Optional string id of the affected entity. |
| `metadata_json` | JSON details (reasons, related ids, etc.). |
| `created_at` | Server timestamp. |

Legacy columns (`action`, `metadata`) may still exist on older databases; `writeAuditLog()` attempts normalized insert first, then fallbacks.

## Usage

Use `writeAuditLog()` from `write-audit-log.ts` instead of raw `supabase.from("audit_logs").insert(...)`.
