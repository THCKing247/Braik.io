-- Optional one-time backfill: set formation_id on plays where play.formation matches
-- exactly one formation (same team_id, side, and trimmed name). Leaves ambiguous
-- or unmatched rows unchanged. Safe to run multiple times (idempotent for already-linked plays).
-- Formation is the primary relationship; this migrates legacy plays that only had the name.

UPDATE plays p
SET formation_id = sub.id,
    updated_at = now()
FROM (
  SELECT p2.id AS play_id,
    (SELECT f2.id FROM formations f2
     WHERE f2.team_id = p2.team_id AND f2.side = p2.side AND trim(f2.name) = trim(p2.formation)
     LIMIT 1) AS id
  FROM plays p2
  WHERE p2.formation_id IS NULL
    AND trim(p2.formation) <> ''
    AND (SELECT count(*) FROM formations f2
         WHERE f2.team_id = p2.team_id AND f2.side = p2.side AND trim(f2.name) = trim(p2.formation)) = 1
) sub
WHERE p.id = sub.play_id AND sub.id IS NOT NULL AND p.formation_id IS NULL;
