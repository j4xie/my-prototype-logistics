/**
 * Platform Admin Screens - Barrel Export
 *
 * All screens for platform administrator functionality
 * Total: 59 screens across 11 modules
 */

// ===== Core Platform Screens =====
export { default as PlatformDashboardScreen } from './PlatformDashboardScreen';
export { default as FactoryManagementScreen } from './FactoryManagementScreen';
export { default as AIQuotaManagementScreen } from './AIQuotaManagementScreen';
export { default as BlueprintManagementScreen } from './BlueprintManagementScreen';
export { default as IndustryTemplateManagementScreen } from './IndustryTemplateManagementScreen';
export { default as IndustryTemplateEditScreen } from './IndustryTemplateEditScreen';
export { default as FactorySetupScreen } from './FactorySetupScreen';
export { default as SystemMonitoringScreen } from './SystemMonitoringScreen';
export { default as PlatformReportsScreen } from './PlatformReportsScreen';

// ===== Factory Management Screens (8) =====
export {
  FactoryCreateScreen,
  FactoryEditScreen,
  FactoryListScreen,
  FactoryDetailScreen,
  FactoryAIPreviewScreen,
  FactoryAIQuickScreen,
  FactoryAIWizardScreen,
  FactoryQuotaScreen,
} from './factory';

// ===== System Monitoring Screens (4) =====
export {
  SystemMetricsScreen,
  SystemHealthScreen,
  SystemLogsScreen,
  SystemAlertsScreen,
} from './system';

// ===== Blueprint Management Screens (8) =====
export {
  BlueprintListScreen,
  BlueprintDetailScreen,
  BlueprintCreateScreen,
  BlueprintEditScreen,
  BlueprintVersionsScreen,
  BlueprintBindingsScreen,
  BlueprintPreviewScreen,
  BlueprintApplyScreen,
} from './blueprint';

// ===== Supplier Management Screens (2) =====
export {
  SupplierAdmissionScreen,
  SupplierBlacklistScreen,
} from './supplier';

// ===== Announcement Management Screens (2) =====
export {
  AnnouncementCenterScreen,
  AnnouncementCreateScreen,
} from './announcement';

// ===== Configuration Change Tracking Screens (2) =====
export {
  ConfigChangesetListScreen,
  ConfigChangesetDetailScreen,
} from './config';

// ===== AI Audit and Analysis Screens (3) =====
export {
  AIAuditLogsScreen,
  IntentAnalysisScreen,
  AIBusinessInitScreen,
} from './ai';

// ===== Rule Engine Screens (9) =====
export {
  RuleListScreen,
  RuleEditScreen,
  RuleTestScreen,
  DrlCodeEditorScreen,
  DrlPreviewScreen,
  RulePackDetailScreen,
  StateMachineListScreen,
  StateMachineDesignerScreen,
  StateMachineDetailScreen,
} from './rules';

// ===== User & Role Management Screens (7) =====
export {
  UserListScreen,
  UserDetailScreen,
  UserCreateScreen,
  UserAssignFactoryScreen,
  RoleListScreen,
  RoleEditScreen,
  RolePermissionsScreen,
} from './user';

// ===== Quota Management Screens (4) =====
export {
  QuotaOverviewScreen,
  QuotaRulesScreen,
  QuotaRuleEditScreen,
  QuotaUsageStatsScreen,
} from './quota';
