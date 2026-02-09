-- V0002__create_update_triggers.sql
-- PostgreSQL triggers for automatic updated_at timestamp updates
-- Generated from Entity @Table annotations
-- Total tables: 173

-- ============================================================
-- Common trigger function for updating timestamps
-- ============================================================
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Create triggers for each table (alphabetical order)
-- ============================================================

-- A
CREATE TRIGGER active_learning_samples_update_timestamp
    BEFORE UPDATE ON active_learning_samples
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER ai_agent_rules_update_timestamp
    BEFORE UPDATE ON ai_agent_rules
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER ai_analysis_results_update_timestamp
    BEFORE UPDATE ON ai_analysis_results
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER ai_audit_logs_update_timestamp
    BEFORE UPDATE ON ai_audit_logs
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER ai_domain_default_intents_update_timestamp
    BEFORE UPDATE ON ai_domain_default_intents
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER ai_intent_config_history_update_timestamp
    BEFORE UPDATE ON ai_intent_config_history
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER ai_intent_configs_update_timestamp
    BEFORE UPDATE ON ai_intent_configs
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER ai_learned_expressions_update_timestamp
    BEFORE UPDATE ON ai_learned_expressions
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER ai_parameter_extraction_rules_update_timestamp
    BEFORE UPDATE ON ai_parameter_extraction_rules
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER ai_quota_configs_update_timestamp
    BEFORE UPDATE ON ai_quota_configs
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER ai_quota_rules_update_timestamp
    BEFORE UPDATE ON ai_quota_rules
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER ai_quota_usage_update_timestamp
    BEFORE UPDATE ON ai_quota_usage
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER ai_report_prompt_configs_update_timestamp
    BEFORE UPDATE ON ai_report_prompt_configs
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER ai_training_samples_update_timestamp
    BEFORE UPDATE ON ai_training_samples
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER ai_usage_log_update_timestamp
    BEFORE UPDATE ON ai_usage_log
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER annotation_queue_update_timestamp
    BEFORE UPDATE ON annotation_queue
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER app_decoration_session_update_timestamp
    BEFORE UPDATE ON app_decoration_session
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER approval_chain_configs_update_timestamp
    BEFORE UPDATE ON approval_chain_configs
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER aps_efficiency_history_update_timestamp
    BEFORE UPDATE ON aps_efficiency_history
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER aps_prediction_model_weights_update_timestamp
    BEFORE UPDATE ON aps_prediction_model_weights
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER aps_weight_history_update_timestamp
    BEFORE UPDATE ON aps_weight_history
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- B
CREATE TRIGGER batch_equipment_usage_update_timestamp
    BEFORE UPDATE ON batch_equipment_usage
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER batch_relations_update_timestamp
    BEFORE UPDATE ON batch_relations
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER batch_voice_task_update_timestamp
    BEFORE UPDATE ON batch_voice_task
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER batch_work_sessions_update_timestamp
    BEFORE UPDATE ON batch_work_sessions
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER behavior_calibration_metrics_update_timestamp
    BEFORE UPDATE ON behavior_calibration_metrics
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER blueprint_applications_update_timestamp
    BEFORE UPDATE ON blueprint_applications
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER blueprint_version_history_update_timestamp
    BEFORE UPDATE ON blueprint_version_history
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER bom_items_update_timestamp
    BEFORE UPDATE ON bom_items
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER bom_labor_cost_configs_update_timestamp
    BEFORE UPDATE ON bom_labor_cost_configs
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER bom_overhead_cost_configs_update_timestamp
    BEFORE UPDATE ON bom_overhead_cost_configs
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- C
CREATE TRIGGER config_change_sets_update_timestamp
    BEFORE UPDATE ON config_change_sets
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER conversation_memory_update_timestamp
    BEFORE UPDATE ON conversation_memory
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER conversation_sessions_update_timestamp
    BEFORE UPDATE ON conversation_sessions
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER conversion_change_history_update_timestamp
    BEFORE UPDATE ON conversion_change_history
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER correction_records_update_timestamp
    BEFORE UPDATE ON correction_records
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER cross_factory_knowledge_update_timestamp
    BEFORE UPDATE ON cross_factory_knowledge
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER cross_factory_knowledge_adoption_update_timestamp
    BEFORE UPDATE ON cross_factory_knowledge_adoption
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER customers_update_timestamp
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- D
CREATE TRIGGER dahua_device_channels_update_timestamp
    BEFORE UPDATE ON dahua_device_channels
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER dahua_devices_update_timestamp
    BEFORE UPDATE ON dahua_devices
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER decision_audit_logs_update_timestamp
    BEFORE UPDATE ON decision_audit_logs
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER departments_update_timestamp
    BEFORE UPDATE ON departments
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER device_activations_update_timestamp
    BEFORE UPDATE ON device_activations
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER device_registrations_update_timestamp
    BEFORE UPDATE ON device_registrations
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER dialect_mappings_update_timestamp
    BEFORE UPDATE ON dialect_mappings
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER disposal_records_update_timestamp
    BEFORE UPDATE ON disposal_records
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER drools_rules_update_timestamp
    BEFORE UPDATE ON drools_rules
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- E
CREATE TRIGGER employee_work_sessions_update_timestamp
    BEFORE UPDATE ON employee_work_sessions
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER encoding_rules_update_timestamp
    BEFORE UPDATE ON encoding_rules
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER equipment_alerts_update_timestamp
    BEFORE UPDATE ON equipment_alerts
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER equipment_maintenance_update_timestamp
    BEFORE UPDATE ON equipment_maintenance
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER error_attribution_statistics_update_timestamp
    BEFORE UPDATE ON error_attribution_statistics
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- F
CREATE TRIGGER factories_update_timestamp
    BEFORE UPDATE ON factories
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER factory_ai_learning_config_update_timestamp
    BEFORE UPDATE ON factory_ai_learning_config
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER factory_blueprint_bindings_update_timestamp
    BEFORE UPDATE ON factory_blueprint_bindings
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER factory_equipment_update_timestamp
    BEFORE UPDATE ON factory_equipment
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER factory_home_layout_update_timestamp
    BEFORE UPDATE ON factory_home_layout
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER factory_scheduling_config_update_timestamp
    BEFORE UPDATE ON factory_scheduling_config
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER factory_settings_update_timestamp
    BEFORE UPDATE ON factory_settings
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER factory_temp_worker_update_timestamp
    BEFORE UPDATE ON factory_temp_worker
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER factory_type_blueprints_update_timestamp
    BEFORE UPDATE ON factory_type_blueprints
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER form_template_versions_update_timestamp
    BEFORE UPDATE ON form_template_versions
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER form_templates_update_timestamp
    BEFORE UPDATE ON form_templates
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- I
CREATE TRIGGER industry_knowledge_entry_update_timestamp
    BEFORE UPDATE ON industry_knowledge_entry
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER industry_template_packages_update_timestamp
    BEFORE UPDATE ON industry_template_packages
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER insert_slots_update_timestamp
    BEFORE UPDATE ON insert_slots
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER intent_match_records_update_timestamp
    BEFORE UPDATE ON intent_match_records
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER intent_optimization_suggestions_update_timestamp
    BEFORE UPDATE ON intent_optimization_suggestions
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER intent_preview_tokens_update_timestamp
    BEFORE UPDATE ON intent_preview_tokens
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER intent_transition_matrix_update_timestamp
    BEFORE UPDATE ON intent_transition_matrix
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER iot_device_data_update_timestamp
    BEFORE UPDATE ON iot_device_data
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER iot_devices_update_timestamp
    BEFORE UPDATE ON iot_devices
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER isapi_device_channels_update_timestamp
    BEFORE UPDATE ON isapi_device_channels
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER isapi_devices_update_timestamp
    BEFORE UPDATE ON isapi_devices
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER isapi_event_logs_update_timestamp
    BEFORE UPDATE ON isapi_event_logs
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- K
CREATE TRIGGER keyword_effectiveness_update_timestamp
    BEFORE UPDATE ON keyword_effectiveness
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER keyword_factory_adoption_update_timestamp
    BEFORE UPDATE ON keyword_factory_adoption
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- L
CREATE TRIGGER label_recognition_configs_update_timestamp
    BEFORE UPDATE ON label_recognition_configs
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER label_recognition_records_update_timestamp
    BEFORE UPDATE ON label_recognition_records
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER labels_update_timestamp
    BEFORE UPDATE ON labels
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER learning_suggestions_update_timestamp
    BEFORE UPDATE ON learning_suggestions
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER learning_tasks_update_timestamp
    BEFORE UPDATE ON learning_tasks
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER line_schedules_update_timestamp
    BEFORE UPDATE ON line_schedules
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER linucb_models_update_timestamp
    BEFORE UPDATE ON linucb_models
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER lowcode_component_definition_update_timestamp
    BEFORE UPDATE ON lowcode_component_definition
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER lowcode_page_config_update_timestamp
    BEFORE UPDATE ON lowcode_page_config
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- M
CREATE TRIGGER material_batch_adjustments_update_timestamp
    BEFORE UPDATE ON material_batch_adjustments
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER material_batches_update_timestamp
    BEFORE UPDATE ON material_batches
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER material_consumptions_update_timestamp
    BEFORE UPDATE ON material_consumptions
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER material_product_conversions_update_timestamp
    BEFORE UPDATE ON material_product_conversions
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER material_spec_configs_update_timestamp
    BEFORE UPDATE ON material_spec_configs
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER mixed_batch_groups_update_timestamp
    BEFORE UPDATE ON mixed_batch_groups
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER mixed_batch_rules_update_timestamp
    BEFORE UPDATE ON mixed_batch_rules
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER ml_model_versions_update_timestamp
    BEFORE UPDATE ON ml_model_versions
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER model_performance_log_update_timestamp
    BEFORE UPDATE ON model_performance_log
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- N
CREATE TRIGGER notifications_update_timestamp
    BEFORE UPDATE ON notifications
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- P
CREATE TRIGGER payroll_records_update_timestamp
    BEFORE UPDATE ON payroll_records
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER piece_rate_rules_update_timestamp
    BEFORE UPDATE ON piece_rate_rules
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER platform_admins_update_timestamp
    BEFORE UPDATE ON platform_admins
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER processing_stage_records_update_timestamp
    BEFORE UPDATE ON processing_stage_records
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER product_types_update_timestamp
    BEFORE UPDATE ON product_types
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER production_batches_update_timestamp
    BEFORE UPDATE ON production_batches
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER production_line_supervisors_update_timestamp
    BEFORE UPDATE ON production_line_supervisors
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER production_lines_update_timestamp
    BEFORE UPDATE ON production_lines
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER production_plan_batch_usages_update_timestamp
    BEFORE UPDATE ON production_plan_batch_usages
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER production_plans_update_timestamp
    BEFORE UPDATE ON production_plans
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER production_process_prompt_configs_update_timestamp
    BEFORE UPDATE ON production_process_prompt_configs
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Q
CREATE TRIGGER quality_check_item_bindings_update_timestamp
    BEFORE UPDATE ON quality_check_item_bindings
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER quality_check_items_update_timestamp
    BEFORE UPDATE ON quality_check_items
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER quality_inspections_update_timestamp
    BEFORE UPDATE ON quality_inspections
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- R
CREATE TRIGGER raw_material_types_update_timestamp
    BEFORE UPDATE ON raw_material_types
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER reflection_memories_update_timestamp
    BEFORE UPDATE ON reflection_memories
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER rework_records_update_timestamp
    BEFORE UPDATE ON rework_records
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER rule_event_bindings_update_timestamp
    BEFORE UPDATE ON rule_event_bindings
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- S
CREATE TRIGGER sample_clusters_update_timestamp
    BEFORE UPDATE ON sample_clusters
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER scale_brand_models_update_timestamp
    BEFORE UPDATE ON scale_brand_models
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER scale_protocol_configs_update_timestamp
    BEFORE UPDATE ON scale_protocol_configs
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER scale_protocol_test_cases_update_timestamp
    BEFORE UPDATE ON scale_protocol_test_cases
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER scheduling_alerts_update_timestamp
    BEFORE UPDATE ON scheduling_alerts
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER scheduling_plans_update_timestamp
    BEFORE UPDATE ON scheduling_plans
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER scheduling_predictions_update_timestamp
    BEFORE UPDATE ON scheduling_predictions
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER scheduling_training_data_update_timestamp
    BEFORE UPDATE ON scheduling_training_data
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER semantic_cache_update_timestamp
    BEFORE UPDATE ON semantic_cache
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER semantic_cache_config_update_timestamp
    BEFORE UPDATE ON semantic_cache_config
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER sessions_update_timestamp
    BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER shipment_records_update_timestamp
    BEFORE UPDATE ON shipment_records
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER sku_complexity_update_timestamp
    BEFORE UPDATE ON sku_complexity
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER smart_bi_alert_thresholds_update_timestamp
    BEFORE UPDATE ON smart_bi_alert_thresholds
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER smart_bi_analysis_cache_update_timestamp
    BEFORE UPDATE ON smart_bi_analysis_cache
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER smart_bi_analysis_config_update_timestamp
    BEFORE UPDATE ON smart_bi_analysis_config
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER smart_bi_billing_config_update_timestamp
    BEFORE UPDATE ON smart_bi_billing_config
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER smart_bi_chart_templates_update_timestamp
    BEFORE UPDATE ON smart_bi_chart_templates
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER smart_bi_datasource_update_timestamp
    BEFORE UPDATE ON smart_bi_datasource
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER smart_bi_department_data_update_timestamp
    BEFORE UPDATE ON smart_bi_department_data
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER smart_bi_dictionary_update_timestamp
    BEFORE UPDATE ON smart_bi_dictionary
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER smart_bi_dynamic_data_update_timestamp
    BEFORE UPDATE ON smart_bi_dynamic_data
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER smart_bi_excel_uploads_update_timestamp
    BEFORE UPDATE ON smart_bi_excel_uploads
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER smart_bi_field_definition_update_timestamp
    BEFORE UPDATE ON smart_bi_field_definition
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER smart_bi_finance_data_update_timestamp
    BEFORE UPDATE ON smart_bi_finance_data
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER smart_bi_incentive_rules_update_timestamp
    BEFORE UPDATE ON smart_bi_incentive_rules
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER smart_bi_metric_formulas_update_timestamp
    BEFORE UPDATE ON smart_bi_metric_formulas
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER smart_bi_pg_analysis_results_update_timestamp
    BEFORE UPDATE ON smart_bi_pg_analysis_results
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER smart_bi_pg_excel_uploads_update_timestamp
    BEFORE UPDATE ON smart_bi_pg_excel_uploads
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER smart_bi_pg_field_definitions_update_timestamp
    BEFORE UPDATE ON smart_bi_pg_field_definitions
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER smart_bi_query_history_update_timestamp
    BEFORE UPDATE ON smart_bi_query_history
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER smart_bi_sales_data_update_timestamp
    BEFORE UPDATE ON smart_bi_sales_data
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER smart_bi_schema_history_update_timestamp
    BEFORE UPDATE ON smart_bi_schema_history
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER smart_bi_skill_update_timestamp
    BEFORE UPDATE ON smart_bi_skill
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER smart_bi_sku_complexity_update_timestamp
    BEFORE UPDATE ON smart_bi_sku_complexity
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER smart_bi_usage_records_update_timestamp
    BEFORE UPDATE ON smart_bi_usage_records
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER sop_configs_update_timestamp
    BEFORE UPDATE ON sop_configs
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER state_machines_update_timestamp
    BEFORE UPDATE ON state_machines
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER suppliers_update_timestamp
    BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER system_enums_update_timestamp
    BEFORE UPDATE ON system_enums
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER system_logs_update_timestamp
    BEFORE UPDATE ON system_logs
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- T
CREATE TRIGGER time_clock_records_update_timestamp
    BEFORE UPDATE ON time_clock_records
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER tool_call_cache_update_timestamp
    BEFORE UPDATE ON tool_call_cache
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER tool_call_records_update_timestamp
    BEFORE UPDATE ON tool_call_records
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER tool_embeddings_update_timestamp
    BEFORE UPDATE ON tool_embeddings
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER tool_reliability_stats_update_timestamp
    BEFORE UPDATE ON tool_reliability_stats
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- U
CREATE TRIGGER unit_of_measurements_update_timestamp
    BEFORE UPDATE ON unit_of_measurements
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER user_feedbacks_update_timestamp
    BEFORE UPDATE ON user_feedbacks
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER users_update_timestamp
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- V
CREATE TRIGGER vehicles_update_timestamp
    BEFORE UPDATE ON vehicles
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER voice_recognition_config_update_timestamp
    BEFORE UPDATE ON voice_recognition_config
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER voice_recognition_history_update_timestamp
    BEFORE UPDATE ON voice_recognition_history
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- W
CREATE TRIGGER whitelists_update_timestamp
    BEFORE UPDATE ON whitelists
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER work_orders_update_timestamp
    BEFORE UPDATE ON work_orders
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER work_types_update_timestamp
    BEFORE UPDATE ON work_types
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER worker_allocation_feedbacks_update_timestamp
    BEFORE UPDATE ON worker_allocation_feedbacks
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER worker_assignments_update_timestamp
    BEFORE UPDATE ON worker_assignments
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER worker_daily_efficiency_update_timestamp
    BEFORE UPDATE ON worker_daily_efficiency
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================================
-- Summary
-- ============================================================
-- Total triggers created: 173
-- Trigger function: update_timestamp()
-- Trigger timing: BEFORE UPDATE
-- Trigger scope: FOR EACH ROW
