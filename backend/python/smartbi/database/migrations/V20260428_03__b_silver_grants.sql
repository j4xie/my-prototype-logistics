-- Grant smartbi_user write privileges on B-stage Silver tables.
-- V20260427_02 created these tables but they were owned by 'postgres' (the
-- migration was applied via sudo because dim_store / dim_product / dim_ingredient
-- have FKs and only postgres can create FKs against postgres-owned tables).
-- Without this grant, the runtime smartbi_user gets InsufficientPrivilegeError
-- when inserting via writers.

GRANT SELECT, INSERT, UPDATE, DELETE ON agg_product_period TO smartbi_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON dim_review_summary TO smartbi_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON fact_review_event TO smartbi_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON dim_finance_subject TO smartbi_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON fact_finance_voucher TO smartbi_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON fact_inventory_snapshot TO smartbi_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON dim_ingredient_threshold TO smartbi_user;

-- Sequences for BIGSERIAL primary keys (writers need USAGE for INSERT)
GRANT USAGE, SELECT ON SEQUENCE agg_product_period_id_seq TO smartbi_user;
GRANT USAGE, SELECT ON SEQUENCE dim_review_summary_id_seq TO smartbi_user;
GRANT USAGE, SELECT ON SEQUENCE fact_review_event_id_seq TO smartbi_user;
GRANT USAGE, SELECT ON SEQUENCE dim_finance_subject_subject_id_seq TO smartbi_user;
GRANT USAGE, SELECT ON SEQUENCE fact_finance_voucher_id_seq TO smartbi_user;
GRANT USAGE, SELECT ON SEQUENCE fact_inventory_snapshot_id_seq TO smartbi_user;
GRANT USAGE, SELECT ON SEQUENCE dim_ingredient_threshold_id_seq TO smartbi_user;

-- Rollback:
--   REVOKE ALL ON <each table> FROM smartbi_user;
--   REVOKE ALL ON SEQUENCE <each seq> FROM smartbi_user;
