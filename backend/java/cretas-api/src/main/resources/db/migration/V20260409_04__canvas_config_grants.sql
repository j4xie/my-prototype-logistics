-- V20260409_04__canvas_config_grants.sql
-- Grant permissions on canvas config tables to cretas_user
-- (tables created as postgres superuser, app runs as cretas_user)

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cretas_user') THEN
        GRANT ALL ON TABLE module_schemas, factory_templates, factory_configurations,
                          factory_module_configs, config_change_log TO cretas_user;
        GRANT ALL ON SEQUENCE module_schemas_id_seq, factory_templates_id_seq,
                              factory_configurations_id_seq, factory_module_configs_id_seq,
                              config_change_log_id_seq TO cretas_user;
    END IF;
END $$;
