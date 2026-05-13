-- QHJ revenue-report tables grants follow-up (Phase I hotfix).
--
-- V20260513_01 created agg_daily_order_type_meal and V20260513_03 created
-- smart_bi_report_audit_log, both as POSTGRES owner without granting privileges
-- to smartbi_user. The Python app connects as smartbi_user, so /audit-log
-- returned 500 "permission denied for table smart_bi_report_audit_log" and
-- /generate would have failed similarly on first attempt.
--
-- This follow-up grants the same privilege set used by every existing
-- smartbi_user-accessed table (smart_bi_pg_excel_uploads, fact_pos_*, etc.).
--
-- Discovered during active E2E run on test env, 2026-05-13.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE smart_bi_report_audit_log TO smartbi_user;
GRANT USAGE, SELECT ON SEQUENCE smart_bi_report_audit_log_id_seq TO smartbi_user;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE agg_daily_order_type_meal TO smartbi_user;
