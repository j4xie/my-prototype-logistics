-- v3 multi-turn conversation history (Apr 27 2026): extend chat_session
-- with turns_history JSONB to enable FU1 ↔ FU2 ↔ FU3 cross-reference.
--
-- Background: v2 conv memory only stored last (parent_query, parent_answer)
-- pair. When user asks FU1 then FU2, FU2 only sees FU1 (the new "parent").
-- The original main and intermediate turns are lost. v3 keeps last N=3
-- turns in a JSONB array so multi-turn analytical sessions stay coherent.
--
-- turns_history schema: [{q: str, a_summary: str, ts: ISO}]
-- Last entry = latest turn. Truncated to last 3 entries on upsert.

ALTER TABLE smart_bi_chat_session
    ADD COLUMN IF NOT EXISTS turns_history JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN smart_bi_chat_session.turns_history IS
    'v3 multi-turn history: [{q,a_summary,ts}]. Last 3 turns. Newer at end.';
