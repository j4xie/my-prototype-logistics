# Maestro E2E Test Coverage Tracker

**Last Updated**: 2026-03-03
**Total Tests**: 75 (R1: 01-13, R2: 14-26, R3: 27-38, R4: 39-57, R5: 58-75)
**Total Screenshots**: ~550+

---

## Coverage by Role

### Factory Admin (FA) — login: `factory_admin1`
| Screen | Test # | Status |
|--------|--------|--------|
| FAHome Dashboard | 02, 06, 74 | COVERED |
| TodayProduction drilldown | 06 | COVERED |
| TodayBatches drilldown | 06 | COVERED |
| MaterialBatch drilldown | 06 | COVERED |
| AIAlerts | 06 | COVERED |
| MaterialBatchDetail | — | UNTESTED |
| HomeLayoutEditor | — | UNTESTED |
| AIAnalysisCenter | 04, 37 | COVERED |
| AICostAnalysis | 37 | COVERED |
| QualityAnalysis | 37 | COVERED |
| AIReport (数据报表) | 25, 37 | COVERED |
| AIChat | 37 | COVERED |
| CreatePlan (AI tab) | — | UNTESTED |
| AIReportDetail | — | UNTESTED |
| IntentSuggestionsList | — | UNTESTED |
| ReportDashboard | 11, 25 | COVERED |
| ProductionReport | 11 | COVERED |
| ProductionAnalysis | 11 | COVERED |
| QualityReport | 39 | COVERED |
| CostReport | 39 | COVERED |
| EfficiencyReport | 39 | COVERED |
| TrendReport | 39 | COVERED |
| PersonnelReport | — | UNTESTED |
| KPIReport | — | UNTESTED |
| ForecastReport | — | UNTESTED |
| AnomalyReport | — | UNTESTED |
| RealtimeReport | — | UNTESTED |
| OeeReport | — | UNTESTED |
| CostVarianceReport | — | UNTESTED |
| CapacityUtilReport | — | UNTESTED |
| OnTimeDeliveryReport | — | UNTESTED |
| DataExport | — | UNTESTED |
| SmartBIHome | 03, 25 | COVERED |
| ExecutiveDashboard | 43 | COVERED |
| SalesAnalysis | 43 | COVERED |
| FinanceAnalysis | 43 | COVERED |
| SmartBIDataAnalysis | 43 | COVERED |
| NLQuery | 43 | COVERED |
| ProductionDashboard | — | UNTESTED |
| QualityDashboard | — | UNTESTED |
| InventoryDashboard | — | UNTESTED |
| ProcurementDashboard | — | UNTESTED |
| SalesFunnel | — | UNTESTED |
| CustomerRFM | — | UNTESTED |
| CashFlow | — | UNTESTED |
| FinancialRatios | — | UNTESTED |
| FAManagement grid | 13, 24, 38 | COVERED |
| EmployeeList | 13, 24 | COVERED |
| UnifiedDeviceManagement | 27 | COVERED |
| EquipmentAnalysis | 27 | COVERED |
| EquipmentDetail | — | UNTESTED |
| IotDeviceList | — | UNTESTED |
| IsapiDeviceList | — | UNTESTED |
| ProductTypeManagement | 13, 24 | COVERED |
| MaterialTypeManagement | 44 | COVERED |
| ConversionRate | 44 | COVERED |
| SupplierManagement | 13, 24 | COVERED |
| CustomerManagement | 13, 24 | COVERED |
| ShipmentManagement | 44 | COVERED |
| DisposalRecordManagement | 44 | COVERED |
| DepartmentManagement | — | UNTESTED |
| SchemaConfig | 38 | COVERED |
| FormTemplateList | 38 | COVERED |
| RuleConfiguration | — | UNTESTED |
| AIBusinessInit | — | UNTESTED |
| EncodingRuleConfig | — | UNTESTED |
| QualityCheckItemConfig | — | UNTESTED |
| SopConfig | — | UNTESTED |
| IntentView | — | UNTESTED |
| WorkReportApproval | 10 | COVERED |
| PurchaseOrderList | 38 | COVERED |
| SalesOrderList | 38 | COVERED |
| FinishedGoodsList | 44 | COVERED |
| TransferList | 44 | COVERED |
| ArApOverview | 44 | COVERED |
| PriceList | 44 | COVERED |
| ReturnOrderList | — | UNTESTED |
| FAProfile | 05, 28, 75 | COVERED |
| PersonalInfo | 28, 75 | COVERED |
| ChangePassword | 28, 75 | COVERED |
| NotificationSettings | 28, 75 | COVERED |
| SystemSettings | 28, 75 | COVERED |
| HelpCenter | 28, 75 | COVERED |
| About | 28, 75 | COVERED |
| Feedback | — | UNTESTED |

### Workshop Supervisor (WS) — login: `workshop_sup1`
| Screen | Test # | Status |
|--------|--------|--------|
| WSHome | 07 | COVERED |
| BatchDetail | 08 | COVERED |
| WSBatches list | 08 | COVERED |
| MaterialConsumption | 08 | COVERED |
| TeamBatchReport | 09 | COVERED |
| WSWorkers | 12 | COVERED |
| WorkerDetail | 12 | COVERED |
| WSEquipment | 12 | COVERED |
| Notifications | 40 | COVERED |
| TaskGuide | 40 | COVERED |
| DraftReports | 40 | COVERED |
| MyWorkReports | 40 | COVERED |
| WSProfile | 40 | COVERED |
| BatchStart | 63 | COVERED |
| BatchStage | — | UNTESTED |
| BatchComplete | — | UNTESTED |
| WorkerAssign | — | UNTESTED |
| ClockIn (WS) | 63 | COVERED |
| AttendanceHistory (WS) | — | UNTESTED |
| EquipmentDetail (WS) | 63 | COVERED |
| EquipmentAlert (WS) | — | UNTESTED |
| EquipmentMaintenance | — | UNTESTED |

### Warehouse Manager (WM) — login: `warehouse_mgr1`
| Screen | Test # | Status |
|--------|--------|--------|
| WHHome | 14 | COVERED |
| WHInboundList | 14 | COVERED |
| WHInboundDetail | 14 | COVERED |
| WHInboundCreate | 14 | COVERED |
| WHOutboundList | 16 | COVERED |
| WHPacking | 16 | COVERED |
| WHLoading | 16 | COVERED |
| WHScanOperation | 16 | COVERED |
| WHInventoryList | 15, 72 | COVERED |
| WHBatchDetail | 15 | COVERED |
| WHInventoryCheck | 15 | COVERED |
| WHInventoryTransfer | 29 | COVERED |
| WHLocationManage | 29 | COVERED |
| WHExpireHandle | 29 | COVERED |
| WHTempMonitor | 29 | COVERED |
| WHIOStatistics | 30 | COVERED |
| WHProfile | 30 | COVERED |
| WHOperationLog | 30 | COVERED |
| WHSettings | 30 | COVERED |
| WHAlertList | 30 | COVERED |
| WHRecallManage | 30 | COVERED |
| WHInventoryAlert | 41 | COVERED |
| WHBatchTrace | 41 | COVERED |
| WHConversionAnalysis | 41 | COVERED |
| WHInspect | — | UNTESTED |
| WHPutaway | — | UNTESTED |
| WHOutboundDetail | — | UNTESTED |
| WHShippingConfirm | — | UNTESTED |
| WHTrackingDetail | — | UNTESTED |
| WHProfileEdit | — | UNTESTED |
| WHAlertHandle | — | UNTESTED |
| WHInventoryWarnings | — | UNTESTED |

### Quality Inspector (QI) — login: `quality_insp1`
| Screen | Test # | Status |
|--------|--------|--------|
| QIHome | 17, 34 | COVERED |
| QIInspectList | 19, 34 | COVERED |
| QIBatchSelect | 17 | COVERED |
| QIForm | 17, 19 | COVERED |
| QIRecords | 18, 69 | COVERED |
| QIRecordDetail | 18, 69 | COVERED |
| QIAnalysis | 18, 33 | COVERED |
| QITrend | 33 | COVERED |
| QIReport | 33 | COVERED |
| QINotifications | 33 | COVERED |
| QIProfile | 18, 34 | COVERED |
| QISettings | 34 | COVERED |
| QIClockIn | 34 | COVERED |
| QIScan | — | UNTESTED (requires camera) |
| QIVoice | — | UNTESTED (requires mic) |
| QICamera | — | UNTESTED (requires camera) |
| QIResult | — | UNTESTED |

### HR Admin (HR) — login: `hr_admin1`
| Screen | Test # | Status |
|--------|--------|--------|
| HRHome | 20, 32 | COVERED |
| StaffList | 20, 21 | COVERED |
| StaffDetail | 20 | COVERED |
| StaffAdd | 20 | COVERED |
| AttendanceManage | 31, 73 | COVERED |
| AttendanceStats | 31 | COVERED |
| AttendanceAnomaly | 31 | COVERED |
| MyAttendance | 31 | COVERED |
| WhitelistList | 21 | COVERED |
| WhitelistAdd | 21 | COVERED |
| DepartmentList | 21 | COVERED |
| HRProfile | 21, 32 | COVERED |
| WorkSchedule | 32 | COVERED |
| Performance | 32 | COVERED |
| LaborCost | 32 | COVERED |
| NewHires | 42 | COVERED |
| MyInfo | 42 | COVERED |
| DepartmentAdd | 42 | COVERED |
| DepartmentDetail | 42 | COVERED |
| StaffAIAnalysis | — | UNTESTED |
| BatchAssignment | — | UNTESTED |

### Dispatcher (DP) — login: `dispatcher1`
| Screen | Test # | Status |
|--------|--------|--------|
| DSHome | 22, 35 | COVERED |
| PlanList | 22, 70 | COVERED |
| PlanCreate | 22 | COVERED |
| PlanGantt | 22, 71 | COVERED |
| UrgentInsert | 22 | COVERED |
| MixedBatch | 22 | COVERED |
| AISchedule | 23, 35 | COVERED |
| AIScheduleAnalysis | 23 | COVERED |
| AICompletionProb | 35 | COVERED |
| AIWorkerOptimize | 35 | COVERED |
| PersonnelList | 23, 36 | COVERED |
| PersonnelDetail | 36 | COVERED |
| PersonnelTransfer | 23 | COVERED |
| PersonnelSchedule | 36 | COVERED |
| PersonnelAttendance | 36 | COVERED |
| DSProfile | 36 | COVERED |
| DSStatistics | 36 | COVERED |
| ApprovalList | 36 | COVERED |
| ResourceOverview | 45 | COVERED |
| PlanDetail | 45 | COVERED |
| WorkshopStatus | 45 | COVERED |
| AIScheduleGenerate | — | UNTESTED (requires data) |
| TaskAssignment | 64 | COVERED |
| SchedulingSettings | 64 | COVERED |
| AlertList (DP) | 64 | COVERED |

### Restaurant Admin (RA) — login: `restaurant_admin1`
| Screen | Test # | Status |
|--------|--------|--------|
| RestaurantHome | 51, 57, 62 | COVERED |
| HomeQuickActions (新建采购/库存查询) | 62 | COVERED |
| RecipeList | 52, 57, 58, 65 | COVERED |
| RecipeDetail | 58 | COVERED |
| RecipeEdit (create) | 58 | COVERED |
| RecipeList search | 65 | COVERED (interaction) |
| RecipeList filter (启用/停用) | 65 | COVERED (interaction) |
| RequisitionCreate | 53, 57, 59, 68 | COVERED |
| RequisitionCreate type toggle | 59, 68 | COVERED (interaction) |
| RequisitionCreate form fill | 68 | COVERED (interaction) |
| RequisitionApproval | — | UNTESTED (requires submitted data) |
| RequisitionDetail | — | UNTESTED (requires existing data) |
| StocktakingList | 54, 57, 60, 67 | COVERED |
| StocktakingList filters | 60, 67 | COVERED (interaction) |
| StocktakingSummary | 60, 67 | COVERED |
| StocktakingExecute | 60 | COVERED |
| WastageList | 55, 57, 61, 66 | COVERED |
| WastageList filters | 61 | COVERED |
| WastageCreate | 61, 66 | COVERED |
| WastageCreate type chips (5) | 61, 66 | COVERED (interaction) |
| WastageCreate form fill | 66 | COVERED (interaction) |
| RestaurantProfile | 57, 62 | COVERED |
| RestaurantProfile sub-screens | 62 | COVERED |
| TabCycle (all 6 tabs) | 57 | COVERED |
| FactoryRegression (no restaurant tabs) | 56 | COVERED |

### Auth Screens
| Screen | Test # | Status |
|--------|--------|--------|
| Login | 01 | COVERED |
| Register | — | UNTESTED |
| ForgotPassword | — | UNTESTED |

### Cross-Role
| Screen | Test # | Status |
|--------|--------|--------|
| All-roles refresh | 26 | COVERED |

---

## Tests by Round

### Round 1 (Tests 01-13) — Basic flows, FA + WS
01-login, 02-home-dashboard, 03-tab-navigation, 04-ai-chat, 05-profile-logout,
06-fa-dashboard-drilldown, 07-ws-dashboard-task, 08-ws-batch-lifecycle,
09-ws-team-report, 10-fa-report-approval, 11-fa-reports-analytics,
12-ws-personnel-equipment, 13-fa-management-modules

### Round 2 (Tests 14-26) — WM, QI, HR, DP core flows
14-wm-inbound-workflow, 15-wm-inventory-ops, 16-wm-outbound-workflow,
17-qi-inspection-flow, 18-qi-records-analysis, 19-qi-inspect-list-search,
20-hr-staff-management, 21-hr-whitelist-crud, 22-dp-plan-scheduling,
23-dp-ai-analysis, 24-fa-management-deep, 25-fa-reports-deep,
26-all-roles-refresh

### Round 3 (Tests 27-38) — Deep sub-screens all roles
27-fa-device-equipment, 28-fa-profile-settings, 29-wm-inventory-advanced,
30-wm-profile-alerts, 31-hr-attendance-deep, 32-hr-department-analytics,
33-qi-analysis-report, 34-qi-profile-clockin, 35-dp-ai-schedule-deep,
36-dp-personnel-profile, 37-fa-ai-analysis, 38-fa-config-inventory

### Round 4 (Tests 39-57) — Reports, SmartBI, WS deep, WM alerts, HR CRUD, DP plan detail, Restaurant tabs
39-fa-reports-sub-screens, 40-ws-profile-notifications, 41-wm-alerts-trace,
42-hr-department-crud, 43-fa-smartbi-deep, 44-fa-erp-modules,
45-dp-plan-detail-resource, 46-fa-reports-extended, 47-ws-equipment-deep,
48-wm-outbound-deep, 49-hr-home-actions, 50-fa-management-config,
51-restaurant-login-tabs, 52-restaurant-recipe-flow, 53-restaurant-requisition-flow,
54-restaurant-stocktaking-flow, 55-restaurant-wastage-flow, 56-factory-regression,
57-restaurant-full-cycle

### Round 5 (Tests 58-75) — Restaurant deep + cross-role gaps + in-depth interaction
**Phase A — Deep Navigation (58-64):**
58-restaurant-recipe-deep, 59-restaurant-requisition-deep, 60-restaurant-stocktaking-deep,
61-restaurant-wastage-deep, 62-restaurant-home-profile,
63-ws-untested-screens, 64-dp-untested-screens

**Phase B — In-Depth Page Interaction (65-75):**
65-interact-recipe-list, 66-interact-wastage-form, 67-interact-stocktaking-list,
68-interact-requisition-form, 69-interact-qi-records, 70-interact-dp-plan-list,
71-interact-dp-gantt, 72-interact-wm-inventory, 73-interact-hr-attendance,
74-interact-fa-dashboard, 75-interact-profile-settings

---

## Interaction Coverage (Phase B — Round 5)

Tests 65-75 exercise in-page interactions beyond navigate-only:

| Test | Page | Interactions Tested |
|------|------|---------------------|
| 65 | RecipeList | Search, filter chips (启用/停用), FAB, card tap, pull-to-refresh, scroll |
| 66 | WastageCreate | 5 type chips, text field fills (qty/cost/notes), button verification |
| 67 | StocktakingList | Filter chips (4 statuses), 盘点汇总 nav, FAB, search, pull-to-refresh |
| 68 | RequisitionCreate | Type toggle (按配方/手动), dish/material selectors, field fills |
| 69 | QIRecords | Filter cycle (全部/今日/合格/不合格), card→detail→back, pull-to-refresh |
| 70 | PlanList | Status filters (4), 甘特图/紧急插单 buttons, search, card tap |
| 71 | PlanGantt | View toggle (时/日), date nav, h/v scroll, task bar tap |
| 72 | WHInventoryList | Search, material type filter (鲜品/冷冻/干货), quick actions, card→detail |
| 73 | AttendanceManage | Date toggle (今日/历史), status filters (正常/迟到/早退/缺勤), search |
| 74 | FAHome | AI洞察, stat drilldowns (3), quick actions, pull-to-refresh, full scroll |
| 75 | FAProfile | PersonalInfo→back, ChangePassword→back, Notification→toggle, System, Help, About |

---

## Untested Roles (no login flow exists)
- `operator` — ALL screens (~10)
- `sales_manager` — ALL screens (~8)
- `procurement_manager` — ALL screens (~3)
- `viewer` — ALL screens (~4)
- `platform_admin` — ALL screens (~50+)

These roles require new login flows in `flows/` before testing.
