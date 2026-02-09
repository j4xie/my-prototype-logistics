-- ============================================================================
-- PostgreSQL ENUM Type Definitions
-- Generated from Java Enums: backend-java/src/main/java/com/cretas/aims/entity/enums/
-- Generated on: 2026-01-26
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Alert & Notification Types
-- ----------------------------------------------------------------------------

-- AlertLevel: Alert severity levels
CREATE TYPE alert_level AS ENUM (
    'CRITICAL',
    'WARNING',
    'INFO'
);
COMMENT ON TYPE alert_level IS 'Alert severity levels (CRITICAL=severe, WARNING=warning, INFO=informational)';

-- AlertStatus: Alert processing status
CREATE TYPE alert_status AS ENUM (
    'ACTIVE',
    'ACKNOWLEDGED',
    'RESOLVED',
    'IGNORED'
);
COMMENT ON TYPE alert_status IS 'Alert processing status';

-- NotificationType: System notification types
CREATE TYPE notification_type AS ENUM (
    'ALERT',
    'INFO',
    'WARNING',
    'SUCCESS',
    'SYSTEM'
);
COMMENT ON TYPE notification_type IS 'System notification types';

-- ----------------------------------------------------------------------------
-- Change Tracking
-- ----------------------------------------------------------------------------

-- ChangeType: Record change types for audit logging
CREATE TYPE change_type AS ENUM (
    'CREATE',
    'UPDATE',
    'DELETE',
    'ACTIVATE',
    'DEACTIVATE'
);
COMMENT ON TYPE change_type IS 'Record change types for audit logging';

-- ----------------------------------------------------------------------------
-- Department & Organization
-- ----------------------------------------------------------------------------

-- Department: Organization departments
CREATE TYPE department AS ENUM (
    'FARMING',
    'PROCESSING',
    'LOGISTICS',
    'QUALITY',
    'MANAGEMENT'
);
COMMENT ON TYPE department IS 'Organization departments';

-- ----------------------------------------------------------------------------
-- Device & Equipment
-- ----------------------------------------------------------------------------

-- DeviceCategory: Device category types (deprecated, use unified_device_type)
CREATE TYPE device_category AS ENUM (
    'TRADITIONAL',
    'IOT_SCALE',
    'IOT_CAMERA',
    'IOT_SENSOR'
);
COMMENT ON TYPE device_category IS 'Device category types (deprecated)';

-- EquipmentStatus: Equipment operational status
CREATE TYPE equipment_status AS ENUM (
    'RUNNING',
    'IDLE',
    'MAINTENANCE',
    'FAULT',
    'OFFLINE'
);
COMMENT ON TYPE equipment_status IS 'Equipment operational status';

-- ----------------------------------------------------------------------------
-- User & Role Management
-- ----------------------------------------------------------------------------

-- FactoryUserRole: Factory user role types
CREATE TYPE factory_user_role AS ENUM (
    'factory_super_admin',
    'hr_admin',
    'procurement_manager',
    'sales_manager',
    'dispatcher',
    'production_manager',
    'warehouse_manager',
    'equipment_admin',
    'quality_manager',
    'finance_manager',
    'workshop_supervisor',
    'quality_inspector',
    'operator',
    'warehouse_worker',
    'permission_admin',
    'department_admin',
    'viewer',
    'unactivated'
);
COMMENT ON TYPE factory_user_role IS 'Factory user role types with hierarchy levels';

-- HireType: Employee hire types
CREATE TYPE hire_type AS ENUM (
    'FULL_TIME',
    'PART_TIME',
    'DISPATCH',
    'INTERN',
    'TEMPORARY'
);
COMMENT ON TYPE hire_type IS 'Employee hire types';

-- PlatformRole: Platform-level user roles
CREATE TYPE platform_role AS ENUM (
    'super_admin',
    'system_admin',
    'operation_admin',
    'auditor'
);
COMMENT ON TYPE platform_role IS 'Platform-level user roles';

-- Status: Generic user/entity status
CREATE TYPE status AS ENUM (
    'active',
    'inactive',
    'locked',
    'pending'
);
COMMENT ON TYPE status IS 'Generic user/entity status';

-- UserType: User type classification
CREATE TYPE user_type AS ENUM (
    'PLATFORM',
    'FACTORY'
);
COMMENT ON TYPE user_type IS 'User type classification';

-- WhitelistStatus: Access whitelist status
CREATE TYPE whitelist_status AS ENUM (
    'ACTIVE',
    'DISABLED',
    'EXPIRED',
    'LIMIT_REACHED',
    'DELETED'
);
COMMENT ON TYPE whitelist_status IS 'Access whitelist status';

-- ----------------------------------------------------------------------------
-- Material & Inventory
-- ----------------------------------------------------------------------------

-- MaterialBatchStatus: Raw material batch status
CREATE TYPE material_batch_status AS ENUM (
    'IN_STOCK',
    'AVAILABLE',
    'FRESH',
    'FROZEN',
    'DEPLETED',
    'USED_UP',
    'EXPIRED',
    'INSPECTING',
    'SCRAPPED',
    'RESERVED'
);
COMMENT ON TYPE material_batch_status IS 'Raw material batch status';

-- MixedBatchType: Mixed batch production types
CREATE TYPE mixed_batch_type AS ENUM (
    'SAME_MATERIAL',
    'SAME_PROCESS'
);
COMMENT ON TYPE mixed_batch_type IS 'Mixed batch production types';

-- ----------------------------------------------------------------------------
-- Production Planning
-- ----------------------------------------------------------------------------

-- PlanSourceType: Production plan source types
CREATE TYPE plan_source_type AS ENUM (
    'CUSTOMER_ORDER',
    'AI_FORECAST',
    'SAFETY_STOCK',
    'MANUAL',
    'URGENT_INSERT'
);
COMMENT ON TYPE plan_source_type IS 'Production plan source types with priority ranges';

-- ProductionBatchStatus: Production batch status
CREATE TYPE production_batch_status AS ENUM (
    'PLANNED',
    'PLANNING',
    'IN_PROGRESS',
    'PRODUCING',
    'PAUSED',
    'COMPLETED',
    'CANCELLED'
);
COMMENT ON TYPE production_batch_status IS 'Production batch status';

-- ProductionPlanStatus: Production plan status
CREATE TYPE production_plan_status AS ENUM (
    'PLANNED',
    'PENDING',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
    'PAUSED'
);
COMMENT ON TYPE production_plan_status IS 'Production plan status';

-- ProductionPlanType: Production plan types
CREATE TYPE production_plan_type AS ENUM (
    'FUTURE',
    'FROM_INVENTORY'
);
COMMENT ON TYPE production_plan_type IS 'Production plan types';

-- ----------------------------------------------------------------------------
-- Processing Stages
-- ----------------------------------------------------------------------------

-- ProcessingStageType: Food processing stage types
CREATE TYPE processing_stage_type AS ENUM (
    'RECEIVING',
    'THAWING',
    'TRIMMING',
    'SLICING',
    'DICING',
    'MINCING',
    'WASHING',
    'DRAINING',
    'MARINATING',
    'SEASONING',
    'COOKING',
    'FRYING',
    'BAKING',
    'STEAMING',
    'COOLING',
    'FREEZING',
    'CHILLING',
    'PACKAGING',
    'LABELING',
    'BOXING',
    'QUALITY_CHECK',
    'METAL_DETECTION',
    'WEIGHT_CHECK',
    'CLEANING',
    'LINE_CHANGE',
    'OTHER'
);
COMMENT ON TYPE processing_stage_type IS 'Food processing stage types';

-- ----------------------------------------------------------------------------
-- Quality Control
-- ----------------------------------------------------------------------------

-- QualityCheckCategory: Quality check categories
CREATE TYPE quality_check_category AS ENUM (
    'SENSORY',
    'PHYSICAL',
    'CHEMICAL',
    'MICROBIOLOGICAL',
    'PACKAGING'
);
COMMENT ON TYPE quality_check_category IS 'Quality check categories';

-- QualitySeverity: Quality issue severity levels
CREATE TYPE quality_severity AS ENUM (
    'CRITICAL',
    'MAJOR',
    'MINOR'
);
COMMENT ON TYPE quality_severity IS 'Quality issue severity levels';

-- QualityStatus: Quality inspection status
CREATE TYPE quality_status AS ENUM (
    'PENDING_INSPECTION',
    'INSPECTING',
    'PASSED',
    'FAILED',
    'PARTIAL_PASS',
    'REWORK_REQUIRED',
    'REWORKING',
    'REWORK_COMPLETED',
    'SCRAPPED'
);
COMMENT ON TYPE quality_status IS 'Quality inspection status';

-- SamplingStrategy: Quality sampling strategies
CREATE TYPE sampling_strategy AS ENUM (
    'FIRST_PIECE',
    'RANDOM',
    'BATCH_END',
    'FULL_INSPECTION',
    'PERIODIC',
    'AQL'
);
COMMENT ON TYPE sampling_strategy IS 'Quality sampling strategies';

-- ----------------------------------------------------------------------------
-- Rework Management
-- ----------------------------------------------------------------------------

-- ReworkStatus: Rework processing status
CREATE TYPE rework_status AS ENUM (
    'PENDING',
    'IN_PROGRESS',
    'COMPLETED',
    'FAILED',
    'CANCELLED'
);
COMMENT ON TYPE rework_status IS 'Rework processing status';

-- ReworkType: Rework types
CREATE TYPE rework_type AS ENUM (
    'PRODUCTION_REWORK',
    'MATERIAL_REWORK',
    'QUALITY_REWORK',
    'PACKAGING_REWORK',
    'SPECIFICATION_ADJUSTMENT'
);
COMMENT ON TYPE rework_type IS 'Rework types';

-- ----------------------------------------------------------------------------
-- Scheduling & Rescheduling (APS)
-- ----------------------------------------------------------------------------

-- RescheduleMode: Rescheduling modes
CREATE TYPE reschedule_mode AS ENUM (
    'AFFECTED_ONLY',
    'FULL'
);
COMMENT ON TYPE reschedule_mode IS 'Rescheduling modes (local vs global)';

-- TriggerPriority: Reschedule trigger priority levels
CREATE TYPE trigger_priority AS ENUM (
    'CRITICAL',
    'HIGH',
    'MEDIUM',
    'LOW'
);
COMMENT ON TYPE trigger_priority IS 'Reschedule trigger priority levels';

-- TriggerType: Reschedule trigger types
CREATE TYPE trigger_type AS ENUM (
    'LINE_FAULT',
    'URGENT_ORDER_INSERT',
    'LOW_COMPLETION_PROBABILITY',
    'MATERIAL_SHORTAGE'
);
COMMENT ON TYPE trigger_type IS 'Reschedule trigger types';

-- ============================================================================
-- End of ENUM Type Definitions
-- Total: 29 ENUM types
-- ============================================================================
