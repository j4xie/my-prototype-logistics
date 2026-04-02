-- =============================================================================
-- Fix PG17 JSON Column Type Mismatches for Local Development
-- =============================================================================
-- Problem: Hibernate 6 sends varchar/text parameters to json/jsonb columns.
--   PostgreSQL 17 is strict about this type mismatch, causing 500 errors.
-- Fix: Convert json columns to TEXT where the Entity uses String or @Convert.
--   Leave jsonb columns that use @Type(JsonBinaryType.class) as-is (Hypersistence
--   Utils handles those correctly via PGobject).
-- =============================================================================

BEGIN;

-- ─── ai_quota_rules ─────────────────────────────────────────────────────────
-- Entity: AIQuotaRule.roleMultipliers (String, columnDefinition="json")
ALTER TABLE ai_quota_rules ALTER COLUMN role_multipliers TYPE TEXT;

-- ─── ai_intent_configs ──────────────────────────────────────────────────────
-- Entity: AIIntentConfig - multiple String fields stored as json
ALTER TABLE ai_intent_configs ALTER COLUMN example_queries TYPE TEXT;
ALTER TABLE ai_intent_configs ALTER COLUMN follow_up_questions TYPE TEXT;
ALTER TABLE ai_intent_configs ALTER COLUMN metadata TYPE TEXT;
ALTER TABLE ai_intent_configs ALTER COLUMN negative_examples TYPE TEXT;
ALTER TABLE ai_intent_configs ALTER COLUMN negative_keywords TYPE TEXT;
ALTER TABLE ai_intent_configs ALTER COLUMN patterns TYPE TEXT;
ALTER TABLE ai_intent_configs ALTER COLUMN previous_snapshot TYPE TEXT;
ALTER TABLE ai_intent_configs ALTER COLUMN required_roles TYPE TEXT;

-- ─── ai_intent_config_history ───────────────────────────────────────────────
-- Entity: AIIntentConfigHistory - String fields
ALTER TABLE ai_intent_config_history ALTER COLUMN changed_fields TYPE TEXT;
ALTER TABLE ai_intent_config_history ALTER COLUMN snapshot TYPE TEXT;

-- ─── ai_report_prompt_configs ───────────────────────────────────────────────
-- Entity: AIReportPromptConfig - String fields
ALTER TABLE ai_report_prompt_configs ALTER COLUMN analysis_directions TYPE TEXT;
ALTER TABLE ai_report_prompt_configs ALTER COLUMN metadata TYPE TEXT;

-- ─── ai_agent_rules ─────────────────────────────────────────────────────────
ALTER TABLE ai_agent_rules ALTER COLUMN tool_chain_config TYPE TEXT;

-- ─── active_learning_samples ────────────────────────────────────────────────
ALTER TABLE active_learning_samples ALTER COLUMN matched_keywords TYPE TEXT;
ALTER TABLE active_learning_samples ALTER COLUMN top_candidates TYPE TEXT;

-- ─── annotation_queue ───────────────────────────────────────────────────────
ALTER TABLE annotation_queue ALTER COLUMN alternative_intents TYPE TEXT;

-- ─── app_decoration_session ─────────────────────────────────────────────────
-- Entity: AppDecorationSession - String fields with getter/setter JSON parsing
ALTER TABLE app_decoration_session ALTER COLUMN conversation_history TYPE TEXT;
ALTER TABLE app_decoration_session ALTER COLUMN generated_config TYPE TEXT;

-- ─── aps_weight_history ─────────────────────────────────────────────────────
-- Entity: ApsWeightHistory - String fields
ALTER TABLE aps_weight_history ALTER COLUMN performance_metrics TYPE TEXT;
ALTER TABLE aps_weight_history ALTER COLUMN weights_after TYPE TEXT;
ALTER TABLE aps_weight_history ALTER COLUMN weights_before TYPE TEXT;

-- ─── behavior_calibration_metrics ───────────────────────────────────────────
ALTER TABLE behavior_calibration_metrics ALTER COLUMN error_distribution TYPE TEXT;
ALTER TABLE behavior_calibration_metrics ALTER COLUMN tool_distribution TYPE TEXT;

-- ─── blueprint_version_history ──────────────────────────────────────────────
ALTER TABLE blueprint_version_history ALTER COLUMN change_summary TYPE TEXT;
ALTER TABLE blueprint_version_history ALTER COLUMN snapshot_data TYPE TEXT;

-- ─── conversation_memory ────────────────────────────────────────────────────
-- Entity: ConversationMemory - @Convert converters output String
ALTER TABLE conversation_memory ALTER COLUMN entity_slots TYPE TEXT;
ALTER TABLE conversation_memory ALTER COLUMN recent_messages TYPE TEXT;
ALTER TABLE conversation_memory ALTER COLUMN user_preferences TYPE TEXT;

-- ─── dahua_device_channels ──────────────────────────────────────────────────
ALTER TABLE dahua_device_channels ALTER COLUMN enabled_events TYPE TEXT;

-- ─── dahua_devices ──────────────────────────────────────────────────────────
-- Entity: DahuaDevice - String fields with getter/setter JSON parsing
ALTER TABLE dahua_devices ALTER COLUMN device_capabilities TYPE TEXT;
ALTER TABLE dahua_devices ALTER COLUMN subscribed_events TYPE TEXT;

-- ─── data_completeness_snapshots ────────────────────────────────────────────
-- Entity: DataCompletenessSnapshot.fieldCompleteness (String, columnDefinition="jsonb")
ALTER TABLE data_completeness_snapshots ALTER COLUMN field_completeness TYPE TEXT;

-- ─── decision_audit_logs ────────────────────────────────────────────────────
ALTER TABLE decision_audit_logs ALTER COLUMN input_context TYPE TEXT;
ALTER TABLE decision_audit_logs ALTER COLUMN output_result TYPE TEXT;
ALTER TABLE decision_audit_logs ALTER COLUMN replay_data TYPE TEXT;
ALTER TABLE decision_audit_logs ALTER COLUMN rules_applied TYPE TEXT;

-- ─── error_attribution_statistics ───────────────────────────────────────────
ALTER TABLE error_attribution_statistics ALTER COLUMN confidence_distribution TYPE TEXT;
ALTER TABLE error_attribution_statistics ALTER COLUMN intent_category_stats TYPE TEXT;
ALTER TABLE error_attribution_statistics ALTER COLUMN match_method_stats TYPE TEXT;

-- ─── factories ──────────────────────────────────────────────────────────────
-- Entity: Factory.inferenceData (String, columnDefinition="json")
ALTER TABLE factories ALTER COLUMN inference_data TYPE TEXT;

-- ─── factory_home_layout ────────────────────────────────────────────────────
-- Entity: FactoryHomeLayout - String fields with getter/setter JSON parsing
ALTER TABLE factory_home_layout ALTER COLUMN afternoon_layout TYPE TEXT;
ALTER TABLE factory_home_layout ALTER COLUMN evening_layout TYPE TEXT;
ALTER TABLE factory_home_layout ALTER COLUMN modules_config TYPE TEXT;
ALTER TABLE factory_home_layout ALTER COLUMN morning_layout TYPE TEXT;
ALTER TABLE factory_home_layout ALTER COLUMN theme_config TYPE TEXT;
ALTER TABLE factory_home_layout ALTER COLUMN usage_stats TYPE TEXT;

-- ─── factory_type_blueprints ────────────────────────────────────────────────
ALTER TABLE factory_type_blueprints ALTER COLUMN default_config TYPE TEXT;
ALTER TABLE factory_type_blueprints ALTER COLUMN department_templates TYPE TEXT;
ALTER TABLE factory_type_blueprints ALTER COLUMN form_templates TYPE TEXT;
ALTER TABLE factory_type_blueprints ALTER COLUMN product_type_templates TYPE TEXT;
ALTER TABLE factory_type_blueprints ALTER COLUMN rule_templates TYPE TEXT;

-- ─── industry_template_packages ─────────────────────────────────────────────
ALTER TABLE industry_template_packages ALTER COLUMN templates_json TYPE TEXT;

-- ─── insert_slots ───────────────────────────────────────────────────────────
ALTER TABLE insert_slots ALTER COLUMN impacted_plans TYPE TEXT;

-- ─── intent_match_records ───────────────────────────────────────────────────
ALTER TABLE intent_match_records ALTER COLUMN matched_keywords TYPE TEXT;
ALTER TABLE intent_match_records ALTER COLUMN top_candidates TYPE TEXT;

-- ─── intent_optimization_suggestions ────────────────────────────────────────
ALTER TABLE intent_optimization_suggestions ALTER COLUMN suggested_keywords TYPE TEXT;
ALTER TABLE intent_optimization_suggestions ALTER COLUMN supporting_examples TYPE TEXT;

-- ─── isapi_device_channels ──────────────────────────────────────────────────
ALTER TABLE isapi_device_channels ALTER COLUMN enabled_events TYPE TEXT;

-- ─── isapi_devices ──────────────────────────────────────────────────────────
-- Entity: IsapiDevice - String fields with getter/setter JSON parsing
ALTER TABLE isapi_devices ALTER COLUMN device_capabilities TYPE TEXT;
ALTER TABLE isapi_devices ALTER COLUMN subscribed_events TYPE TEXT;

-- ─── isapi_event_logs ───────────────────────────────────────────────────────
-- Entity: IsapiEventLog - String fields with getter/setter JSON parsing
ALTER TABLE isapi_event_logs ALTER COLUMN detection_region TYPE TEXT;
ALTER TABLE isapi_event_logs ALTER COLUMN event_data TYPE TEXT;

-- ─── learning_suggestions ───────────────────────────────────────────────────
ALTER TABLE learning_suggestions ALTER COLUMN supporting_samples TYPE TEXT;

-- ─── learning_tasks ─────────────────────────────────────────────────────────
ALTER TABLE learning_tasks ALTER COLUMN parameters TYPE TEXT;
ALTER TABLE learning_tasks ALTER COLUMN result TYPE TEXT;

-- ─── linucb_models ──────────────────────────────────────────────────────────
ALTER TABLE linucb_models ALTER COLUMN matrix_a TYPE TEXT;
ALTER TABLE linucb_models ALTER COLUMN matrix_a_inverse TYPE TEXT;
ALTER TABLE linucb_models ALTER COLUMN vector_b TYPE TEXT;

-- ─── mixed_batch_groups ─────────────────────────────────────────────────────
ALTER TABLE mixed_batch_groups ALTER COLUMN order_ids TYPE TEXT;

-- ─── mixed_batch_rules ──────────────────────────────────────────────────────
ALTER TABLE mixed_batch_rules ALTER COLUMN notification_config TYPE TEXT;

-- ─── product_types ──────────────────────────────────────────────────────────
-- Entity: ProductType - String fields
ALTER TABLE product_types ALTER COLUMN equipment_ids TYPE TEXT;
ALTER TABLE product_types ALTER COLUMN processing_steps TYPE TEXT;
ALTER TABLE product_types ALTER COLUMN quality_check_ids TYPE TEXT;
ALTER TABLE product_types ALTER COLUMN skill_requirements TYPE TEXT;

-- ─── production_batches ─────────────────────────────────────────────────────
-- photo_completed_stages is json (String), NOT using @Type
ALTER TABLE production_batches ALTER COLUMN photo_completed_stages TYPE TEXT;

-- ─── production_plans ───────────────────────────────────────────────────────
ALTER TABLE production_plans ALTER COLUMN related_orders TYPE TEXT;

-- ─── rule_execution_logs (no Entity but fix anyway) ─────────────────────────
ALTER TABLE rule_execution_logs ALTER COLUMN input_facts TYPE TEXT;
ALTER TABLE rule_execution_logs ALTER COLUMN output_results TYPE TEXT;

-- ─── sample_clusters ────────────────────────────────────────────────────────
ALTER TABLE sample_clusters ALTER COLUMN common_keywords TYPE TEXT;
ALTER TABLE sample_clusters ALTER COLUMN intent_distribution TYPE TEXT;
ALTER TABLE sample_clusters ALTER COLUMN suggested_keywords TYPE TEXT;

-- ─── scale_brand_models ─────────────────────────────────────────────────────
ALTER TABLE scale_brand_models ALTER COLUMN supported_protocol_ids TYPE TEXT;

-- ─── scale_protocol_configs ─────────────────────────────────────────────────
ALTER TABLE scale_protocol_configs ALTER COLUMN api_config TYPE TEXT;
ALTER TABLE scale_protocol_configs ALTER COLUMN frame_format TYPE TEXT;
ALTER TABLE scale_protocol_configs ALTER COLUMN modbus_config TYPE TEXT;
ALTER TABLE scale_protocol_configs ALTER COLUMN serial_config TYPE TEXT;

-- ─── semantic_cache ─────────────────────────────────────────────────────────
ALTER TABLE semantic_cache ALTER COLUMN execution_result TYPE TEXT;
ALTER TABLE semantic_cache ALTER COLUMN intent_result TYPE TEXT;

-- ─── smart_bi_analysis_cache ────────────────────────────────────────────────
ALTER TABLE smart_bi_analysis_cache ALTER COLUMN chart_data TYPE TEXT;
ALTER TABLE smart_bi_analysis_cache ALTER COLUMN kpi_data TYPE TEXT;

-- ─── smart_bi_analysis_config ───────────────────────────────────────────────
ALTER TABLE smart_bi_analysis_config ALTER COLUMN config_json TYPE TEXT;

-- ─── smart_bi_chart_templates ───────────────────────────────────────────────
ALTER TABLE smart_bi_chart_templates ALTER COLUMN applicable_metrics TYPE TEXT;
ALTER TABLE smart_bi_chart_templates ALTER COLUMN chart_options TYPE TEXT;
ALTER TABLE smart_bi_chart_templates ALTER COLUMN data_mapping TYPE TEXT;
ALTER TABLE smart_bi_chart_templates ALTER COLUMN layout_config TYPE TEXT;

-- ─── smart_bi_datasource ────────────────────────────────────────────────────
ALTER TABLE smart_bi_datasource ALTER COLUMN connection_config TYPE TEXT;

-- ─── smart_bi_dictionary ────────────────────────────────────────────────────
ALTER TABLE smart_bi_dictionary ALTER COLUMN aliases TYPE TEXT;
ALTER TABLE smart_bi_dictionary ALTER COLUMN metadata TYPE TEXT;

-- ─── smart_bi_excel_uploads ─────────────────────────────────────────────────
ALTER TABLE smart_bi_excel_uploads ALTER COLUMN data_features TYPE TEXT;
ALTER TABLE smart_bi_excel_uploads ALTER COLUMN field_mappings TYPE TEXT;

-- ─── smart_bi_field_definition ──────────────────────────────────────────────
ALTER TABLE smart_bi_field_definition ALTER COLUMN chart_types TYPE TEXT;

-- ─── smart_bi_query_history ─────────────────────────────────────────────────
ALTER TABLE smart_bi_query_history ALTER COLUMN chart_config TYPE TEXT;
ALTER TABLE smart_bi_query_history ALTER COLUMN context TYPE TEXT;
ALTER TABLE smart_bi_query_history ALTER COLUMN parameters TYPE TEXT;

-- ─── smart_bi_schema_history ────────────────────────────────────────────────
ALTER TABLE smart_bi_schema_history ALTER COLUMN new_schema TYPE TEXT;
ALTER TABLE smart_bi_schema_history ALTER COLUMN old_schema TYPE TEXT;

-- ─── smart_bi_skill ─────────────────────────────────────────────────────────
ALTER TABLE smart_bi_skill ALTER COLUMN config TYPE TEXT;
ALTER TABLE smart_bi_skill ALTER COLUMN context_needed TYPE TEXT;
ALTER TABLE smart_bi_skill ALTER COLUMN tools TYPE TEXT;
ALTER TABLE smart_bi_skill ALTER COLUMN triggers TYPE TEXT;

-- ─── smart_bi_sku_complexity ────────────────────────────────────────────────
ALTER TABLE smart_bi_sku_complexity ALTER COLUMN analysis_detail_json TYPE TEXT;

-- ─── sop_configs ────────────────────────────────────────────────────────────
ALTER TABLE sop_configs ALTER COLUMN photo_config_json TYPE TEXT;
ALTER TABLE sop_configs ALTER COLUMN steps_json TYPE TEXT;
ALTER TABLE sop_configs ALTER COLUMN validation_rules_json TYPE TEXT;

-- ─── state_machines ─────────────────────────────────────────────────────────
ALTER TABLE state_machines ALTER COLUMN states_json TYPE TEXT;
ALTER TABLE state_machines ALTER COLUMN transitions_json TYPE TEXT;

-- ─── system_enums ───────────────────────────────────────────────────────────
ALTER TABLE system_enums ALTER COLUMN metadata TYPE TEXT;

-- ─── tool_call_cache ────────────────────────────────────────────────────────
ALTER TABLE tool_call_cache ALTER COLUMN cached_result TYPE TEXT;

-- ─── tool_call_records ──────────────────────────────────────────────────────
ALTER TABLE tool_call_records ALTER COLUMN tool_parameters TYPE TEXT;

-- ─── tool_reliability_stats ─────────────────────────────────────────────────
ALTER TABLE tool_reliability_stats ALTER COLUMN common_errors TYPE TEXT;

-- ─── worker_allocation_feedbacks ────────────────────────────────────────────
ALTER TABLE worker_allocation_feedbacks ALTER COLUMN context_features TYPE TEXT;
ALTER TABLE worker_allocation_feedbacks ALTER COLUMN task_features TYPE TEXT;
ALTER TABLE worker_allocation_feedbacks ALTER COLUMN team_composition TYPE TEXT;
ALTER TABLE worker_allocation_feedbacks ALTER COLUMN worker_features TYPE TEXT;

-- =============================================================================
-- NOTE: The following jsonb columns are INTENTIONALLY LEFT AS JSONB because they
-- use @Type(JsonBinaryType.class) or @Type(JsonType.class) from Hypersistence
-- Utils, which correctly handles PGobject serialization:
--
--   factory_feature_config.config                (JsonBinaryType)
--   material_batches.custom_fields               (JsonBinaryType)
--   production_batches.custom_fields             (JsonBinaryType)
--   production_reports.hour_entries              (JsonType)
--   production_reports.non_production_entries    (JsonType)
--   production_reports.custom_fields             (JsonType)
--   production_reports.photos                    (JsonType)
--   quality_inspections.custom_fields            (JsonBinaryType)
--   smart_bi_dynamic_data.row_data               (JsonBinaryType)
--   smart_bi_pg_analysis_results.*               (JsonBinaryType)
--   smart_bi_pg_excel_uploads.*                  (JsonBinaryType)
--   smart_bi_pg_field_definitions.*              (JsonBinaryType)
-- =============================================================================


-- =============================================================================
-- Part 2: Fix column type mismatches (int4 vs varchar)
-- =============================================================================

-- production_batches.production_plan_id: Entity=String, DB=int4
ALTER TABLE production_batches ALTER COLUMN production_plan_id TYPE VARCHAR(191) USING production_plan_id::VARCHAR;


-- =============================================================================
-- Part 3: Add missing columns that Entity defines but DB lacks
-- =============================================================================

-- ─── production_plans: 5 missing columns ────────────────────────────────────
ALTER TABLE production_plans ADD COLUMN IF NOT EXISTS suggested_production_line_id VARCHAR(36);
ALTER TABLE production_plans ADD COLUMN IF NOT EXISTS estimated_workers INTEGER;
ALTER TABLE production_plans ADD COLUMN IF NOT EXISTS assigned_supervisor_id BIGINT;
ALTER TABLE production_plans ADD COLUMN IF NOT EXISTS process_name VARCHAR(200);
ALTER TABLE production_plans ADD COLUMN IF NOT EXISTS batch_date DATE;

-- ─── production_reports: 10 missing columns ─────────────────────────────────
ALTER TABLE production_reports ADD COLUMN IF NOT EXISTS version BIGINT;
ALTER TABLE production_reports ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(500);
ALTER TABLE production_reports ADD COLUMN IF NOT EXISTS process_task_id VARCHAR(50);
ALTER TABLE production_reports ADD COLUMN IF NOT EXISTS is_supplemental BOOLEAN DEFAULT false;
ALTER TABLE production_reports ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'PENDING';
ALTER TABLE production_reports ADD COLUMN IF NOT EXISTS approved_by BIGINT;
ALTER TABLE production_reports ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
ALTER TABLE production_reports ADD COLUMN IF NOT EXISTS rejected_reason VARCHAR(500);
ALTER TABLE production_reports ADD COLUMN IF NOT EXISTS notes VARCHAR(500);
ALTER TABLE production_reports ADD COLUMN IF NOT EXISTS reversal_of_id BIGINT;

-- ─── material_batches: 1 missing column ─────────────────────────────────────
ALTER TABLE material_batches ADD COLUMN IF NOT EXISTS inbound_type VARCHAR(30);

COMMIT;
