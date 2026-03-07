#!/usr/bin/env python3
"""
Analyze label set inconsistencies across:
  1. merged_label_mapping.json (170 labels)
  2. all_intent_metrics.json (242 intents)
  3. V7 model label_mapping.json (259 labels)
  4. DB active intents (266 intents)

Generates v8_label_mapping.json based on V7 as baseline.
"""
import json
import sys

# === 1. merged_label_mapping ===
with open('scripts/finetune/data/merged_label_mapping.json') as f:
    merged = json.load(f)
merged_labels = set(merged['label_to_id'].keys())
merged_merge_map = merged.get('merge_map', {})

# === 2. all_intent_metrics ===
with open('scripts/finetune/data/all_intent_metrics.json') as f:
    metrics_raw = json.load(f)
metrics_labels = set(item['intent_code'] for item in metrics_raw)

# === 3. V7 model (259 labels) from server ===
v7_labels_ordered = [
    "ALERT_ACTIVE","ALERT_BY_EQUIPMENT","ALERT_BY_LEVEL","ALERT_DIAGNOSE","ALERT_RESOLVE",
    "ALERT_TRIAGE","APPROVAL_CONFIG_PURCHASE_ORDER","ATTENDANCE_ANOMALY","ATTENDANCE_DEPARTMENT",
    "ATTENDANCE_HISTORY","ATTENDANCE_MONTHLY","ATTENDANCE_STATS","ATTENDANCE_STATS_BY_DEPT",
    "ATTENDANCE_STATUS","ATTENDANCE_TODAY","BATCH_UPDATE","CAMERA_ADD","CAMERA_CAPTURE",
    "CAMERA_DETAIL","CAMERA_LIST","CAMERA_STREAMS","CAMERA_SUBSCRIBE","CAMERA_UNSUBSCRIBE",
    "CCP_MONITOR_DATA_DETECTION","CLOCK_IN","CLOCK_OUT","COLD_CHAIN_TEMPERATURE",
    "CONDITION_SWITCH","CONFIG_RESET","CONTINUE_LAST_OPERATION","CONVERSION_RATE_UPDATE",
    "COST_QUERY","COST_TREND_ANALYSIS","CUSTOMER_ACTIVE","CUSTOMER_BY_TYPE","CUSTOMER_DELETE",
    "CUSTOMER_LIST","CUSTOMER_PURCHASE_HISTORY","CUSTOMER_SEARCH","CUSTOMER_STATS",
    "DATA_BATCH_DELETE","EQUIPMENT_ALERT_ACKNOWLEDGE","EQUIPMENT_ALERT_LIST",
    "EQUIPMENT_ALERT_RESOLVE","EQUIPMENT_ALERT_STATS","EQUIPMENT_BREAKDOWN_REPORT",
    "EQUIPMENT_CAMERA_START","EQUIPMENT_DELETE","EQUIPMENT_DETAIL","EQUIPMENT_HEALTH_DIAGNOSIS",
    "EQUIPMENT_LIST","EQUIPMENT_MAINTENANCE","EQUIPMENT_START","EQUIPMENT_STATS",
    "EQUIPMENT_STATUS_QUERY","EQUIPMENT_STATUS_UPDATE","EQUIPMENT_STOP","EXCLUDE_SELECTED",
    "EXECUTE_SWITCH","FACTORY_FEATURE_TOGGLE","FACTORY_NOTIFICATION_CONFIG",
    "FILTER_EXCLUDE_SELECTED","FOOD_KNOWLEDGE_QUERY","FORM_GENERATION","HRM_DELETE_EMPLOYEE",
    "HR_DELETE_EMPLOYEE","INTENT_ANALYZE","INTENT_CREATE","INTENT_UPDATE","INVENTORY_CLEAR",
    "ISAPI_CONFIG_FIELD_DETECTION","ISAPI_CONFIG_LINE_DETECTION","ISAPI_QUERY_CAPABILITIES",
    "MATERIAL_ADJUST_QUANTITY","MATERIAL_BATCH_CONSUME","MATERIAL_BATCH_CREATE",
    "MATERIAL_BATCH_QUERY","MATERIAL_BATCH_RELEASE","MATERIAL_BATCH_RESERVE","MATERIAL_BATCH_USE",
    "MATERIAL_EXPIRED_QUERY","MATERIAL_EXPIRING_ALERT","MATERIAL_FIFO_RECOMMEND",
    "MATERIAL_LOW_STOCK_ALERT","MATERIAL_UPDATE","MEDIA_PLAY","MEDIA_PLAY_MUSIC","MRP_CALCULATION",
    "NAVIGATE_TO_CITY","NAVIGATE_TO_LOCATION","NAVIGATION_TO_CITY","NAVIGATION_TO_LOCATION",
    "NOTIFICATION_SEND_WECHAT","OPEN_CAMERA","OPERATION_UNDO_OR_RECALL","ORDER_DELETE",
    "ORDER_FILTER","ORDER_LIST","ORDER_NEW","ORDER_STATUS","ORDER_TIMEOUT_MONITOR","ORDER_TODAY",
    "ORDER_UPDATE","PAGINATION_NEXT","PAYMENT_STATUS_QUERY","PLAN_UPDATE",
    "PROCESSING_BATCH_CANCEL","PROCESSING_BATCH_COMPLETE","PROCESSING_BATCH_CREATE",
    "PROCESSING_BATCH_DETAIL","PROCESSING_BATCH_LIST","PROCESSING_BATCH_PAUSE",
    "PROCESSING_BATCH_RESUME","PROCESSING_BATCH_START","PROCESSING_BATCH_TIMELINE",
    "PROCESSING_BATCH_WORKERS","PROCESSING_WORKER_ASSIGN","PROCESSING_WORKER_CHECKOUT",
    "PRODUCTION_STATUS_QUERY","PRODUCT_PRODUCT_SALES_RANKING","PRODUCT_SALES_RANKING",
    "PRODUCT_TYPE_QUERY","PRODUCT_UPDATE","QUALITY_CHECK_EXECUTE","QUALITY_CHECK_QUERY",
    "QUALITY_CRITICAL_ITEMS","QUALITY_DISPOSITION_EVALUATE","QUALITY_DISPOSITION_EXECUTE",
    "QUALITY_STATS","QUERY_DUPONT_ANALYSIS","QUERY_EMPLOYEE_PROFILE","QUERY_FINANCE_ROA",
    "QUERY_FINANCE_ROE","QUERY_GENERIC_DETAIL","QUERY_LIQUIDITY","QUERY_MATERIAL_REJECTION_REASON",
    "QUERY_ONLINE_STAFF_COUNT","QUERY_PROCESSING_CURRENT_STEP","QUERY_RETRY_LAST","QUERY_SOLVENCY",
    "REPORT_ANOMALY","REPORT_BENEFIT_OVERVIEW","REPORT_DASHBOARD_OVERVIEW","REPORT_EFFICIENCY",
    "REPORT_FINANCE","REPORT_INTELLIGENT_QUALITY","REPORT_INVENTORY","REPORT_KPI",
    "REPORT_PRODUCTION","REPORT_QUALITY","REPORT_TRENDS","RESTAURANT_AVG_TICKET",
    "RESTAURANT_BESTSELLER_QUERY","RESTAURANT_DISH_CREATE","RESTAURANT_DISH_DELETE",
    "RESTAURANT_DISH_LIST","RESTAURANT_DISH_PRODUCT_SALES_RANKING",
    "RESTAURANT_INGREDIENT_LOW_STOCK","RESTAURANT_MARGIN_ANALYSIS","RESTAURANT_PEAK_HOURS_ANALYSIS",
    "RESTAURANT_PROCUREMENT_CREATE","RESTAURANT_RETURN_RATE","RESTAURANT_SLOW_SELLER_QUERY",
    "RESTAURANT_WASTAGE_ANOMALY","RESTAURANT_WASTAGE_RATE","RESTAURANT_WASTAGE_SUMMARY",
    "RULE_CONFIG","SCALE_ADD_DEVICE","SCALE_ADD_DEVICE_VISION","SCALE_CALIBRATE",
    "SCALE_DELETE_DEVICE","SCALE_DEVICE_DETAIL","SCALE_LIST_DEVICES","SCALE_TROUBLESHOOT",
    "SCALE_UPDATE_DEVICE","SCHEDULING_COVERAGE_QUERY","SCHEDULING_EXECUTE_FOR_DATE",
    "SCHEDULING_LIST","SCHEDULING_SET_AUTO","SCHEDULING_SET_DISABLED","SCHEDULING_SET_MANUAL",
    "SHIPMENT_BY_CUSTOMER","SHIPMENT_BY_DATE","SHIPMENT_CREATE","SHIPMENT_DELETE","SHIPMENT_QUERY",
    "SHIPMENT_STATS","SHIPMENT_STATUS_UPDATE","SHIPMENT_UPDATE","SHOPPING_CART_CLEAR",
    "SUPPLIER_ACTIVE","SUPPLIER_BY_CATEGORY","SUPPLIER_DELETE","SUPPLIER_EVALUATE","SUPPLIER_LIST",
    "SUPPLIER_RANKING","SUPPLIER_SEARCH","SYSTEM_FEEDBACK","SYSTEM_FILTER_EXCLUDE_SELECTED",
    "SYSTEM_GO_BACK","SYSTEM_HELP","SYSTEM_PASSWORD_RESET","SYSTEM_PERMISSION_QUERY",
    "SYSTEM_PROFILE_EDIT","SYSTEM_RESUME_LAST_ACTION","SYSTEM_SETTINGS","SYSTEM_SWITCH_FACTORY",
    "TASK_ASSIGN_EMPLOYEE","TASK_ASSIGN_WORKER","TRACE_BATCH","TRACE_FULL","TRACE_PUBLIC",
    "UI_EXCLUDE_SELECTED","USER_CREATE","USER_DELETE","USER_DISABLE","USER_ROLE_ASSIGN",
    "USER_TODO_LIST","USER_UPDATE","WAGE_REPORT","WAREHOUSE_OUTBOUND","financial_ratios",
    "APPROVAL_SUBMIT","CONTEXT_CONTINUE","INVENTORY_OUTBOUND","INVENTORY_SUMMARY_QUERY",
    "MATERIAL_BATCH_DELETE","ORDER_APPROVAL","OUT_OF_DOMAIN","PRODUCTION_CONFIRM_WORKERS_PRESENT",
    "PRODUCTION_LINE_START","PROFIT_TREND_ANALYSIS","QUALITY_CHECK_CREATE","QUERY_APPROVAL_RECORD",
    "QUERY_EQUIPMENT_STATUS_BY_NAME","QUERY_INVENTORY_QUANTITY","QUERY_INVENTORY_TOTAL",
    "QUERY_MATERIAL_STOCK_SUMMARY","QUERY_ORDER_PENDING_MATERIAL_QUANTITY",
    "QUERY_PROCESSING_BATCH_SUPERVISOR","QUERY_PROCESSING_STEP","QUERY_TRANSPORT_LINE",
    "REPORT_AI_QUALITY","REPORT_WORKSHOP_DAILY","RESTAURANT_DAILY_REVENUE",
    "RESTAURANT_DISH_SALES_RANKING","RESTAURANT_INGREDIENT_EXPIRY_ALERT",
    "RESTAURANT_ORDER_STATISTICS","RESTAURANT_PROCUREMENT_SUGGESTION","RESTAURANT_REVENUE_TREND",
    "SCHEDULING_RUN_TOMORROW","SHIPMENT_EXPEDITE","SHIPMENT_NOTIFY_WAREHOUSE_PREPARE",
    "SUPPLIER_CREATE","SUPPLIER_PRICE_COMPARISON","TASK_ASSIGN_BY_NAME","TASK_PROGRESS_QUERY",
    "WORKER_ARRIVAL_CONFIRM","WORKER_IN_SHOP_REALTIME_COUNT"
]
v7_labels = set(v7_labels_ordered)
assert len(v7_labels) == 259, f"Expected 259, got {len(v7_labels)}"

# === 4. DB active intents ===
db_active_list = [
    "ALERT_ACKNOWLEDGE","ALERT_ACTIVE","ALERT_BY_EQUIPMENT","ALERT_BY_LEVEL","ALERT_DIAGNOSE",
    "ALERT_LIST","ALERT_RESOLVE","ALERT_STATS","ALERT_TRIAGE","ANALYZE_EQUIPMENT",
    "APPROVAL_CONFIG_PURCHASE_ORDER","APPROVAL_SUBMIT","ATTENDANCE_ANOMALY","ATTENDANCE_DEPARTMENT",
    "ATTENDANCE_HISTORY","ATTENDANCE_MONTHLY","ATTENDANCE_STATS","ATTENDANCE_STATS_BY_DEPT",
    "ATTENDANCE_STATUS","ATTENDANCE_TODAY","BATCH_AUTO_LOOKUP","BATCH_UPDATE",
    "CCP_MONITOR_DATA_DETECTION","CLOCK_IN","CLOCK_OUT","COLD_CHAIN_TEMPERATURE","CONFIG_RESET",
    "CONTEXT_CONTINUE","CONTINUE_LAST_OPERATION","CONVERSION_RATE_UPDATE","COST_QUERY",
    "COST_TREND_ANALYSIS","CUSTOMER_ACTIVE","CUSTOMER_BY_TYPE","CUSTOMER_DELETE","CUSTOMER_LIST",
    "CUSTOMER_PURCHASE_HISTORY","CUSTOMER_SEARCH","CUSTOMER_STATS","DAHUA_DEVICE_DISCOVERY",
    "DAHUA_DEVICE_MANAGE","DAHUA_SMART_CONFIG","DATA_BATCH_DELETE","DICTIONARY_ADD",
    "DICTIONARY_BATCH_IMPORT","DICTIONARY_LIST","EQUIPMENT_ALERT_ACKNOWLEDGE","EQUIPMENT_ALERT_LIST",
    "EQUIPMENT_ALERT_RESOLVE","EQUIPMENT_ALERT_STATS","EQUIPMENT_BREAKDOWN_REPORT",
    "EQUIPMENT_CAMERA_START","EQUIPMENT_DELETE","EQUIPMENT_DETAIL","EQUIPMENT_HEALTH_DIAGNOSIS",
    "EQUIPMENT_LIST","EQUIPMENT_MAINTENANCE","EQUIPMENT_START","EQUIPMENT_STATS",
    "EQUIPMENT_STATUS_QUERY","EQUIPMENT_STATUS_UPDATE","EQUIPMENT_STOP","EXCLUDE_SELECTED",
    "EXECUTE_SWITCH","FACTORY_FEATURE_TOGGLE","FACTORY_NOTIFICATION_CONFIG","FILTER_EXCLUDE_SELECTED",
    "FOOD_KNOWLEDGE_QUERY","FORM_GENERATION","HR_DELETE_EMPLOYEE","HR_EMPLOYEE_DELETE",
    "HRM_DELETE_EMPLOYEE","INTENT_ANALYZE","INTENT_CREATE","INTENT_UPDATE","INVENTORY_CLEAR",
    "INVENTORY_OUTBOUND","INVENTORY_SUMMARY_QUERY","INVENTORY_TOTAL_QUERY",
    "ISAPI_CONFIG_FIELD_DETECTION","ISAPI_CONFIG_LINE_DETECTION","ISAPI_QUERY_CAPABILITIES",
    "MATERIAL_ADJUST_QUANTITY","MATERIAL_BATCH_CONSUME","MATERIAL_BATCH_CREATE",
    "MATERIAL_BATCH_DELETE","MATERIAL_BATCH_QUERY","MATERIAL_BATCH_RELEASE","MATERIAL_BATCH_RESERVE",
    "MATERIAL_BATCH_USE","MATERIAL_EXPIRED_QUERY","MATERIAL_EXPIRING_ALERT",
    "MATERIAL_FIFO_RECOMMEND","MATERIAL_LOW_STOCK_ALERT","MATERIAL_UPDATE","MEDIA_PLAY",
    "MRP_CALCULATION","NAVIGATE_TO_CITY","NAVIGATE_TO_LOCATION","NOTIFICATION_SEND_WECHAT",
    "NOTIFICATION_WECHAT_SEND","OPEN_CAMERA","OPERATION_UNDO_OR_RECALL","ORDER_APPROVAL",
    "ORDER_DELETE","ORDER_FILTER","ORDER_LIST","ORDER_MODIFY","ORDER_NEW","ORDER_STATUS",
    "ORDER_TIMEOUT_MONITOR","ORDER_TODAY","ORDER_UPDATE","OUT_OF_DOMAIN","PAGINATION_NEXT",
    "PAYMENT_STATUS_QUERY","PLAN_UPDATE","PROCESSING_BATCH_CANCEL","PROCESSING_BATCH_COMPLETE",
    "PROCESSING_BATCH_CREATE","PROCESSING_BATCH_DETAIL","PROCESSING_BATCH_LIST",
    "PROCESSING_BATCH_PAUSE","PROCESSING_BATCH_RESUME","PROCESSING_BATCH_START",
    "PROCESSING_BATCH_TIMELINE","PROCESSING_BATCH_WORKERS","PROCESSING_WORKER_ASSIGN",
    "PROCESSING_WORKER_CHECKOUT","PRODUCTION_CONFIRM_WORKERS_PRESENT","PRODUCTION_LINE_START",
    "PRODUCTION_PLAN_CREATE_FULL","PRODUCTION_STATUS_QUERY","PRODUCT_SALES_RANKING",
    "PRODUCT_TYPE_QUERY","PRODUCT_UPDATE","PROFIT_TREND_ANALYSIS","QUALITY_BATCH_MARK_AS_INSPECTED",
    "QUALITY_CHECK_CREATE","QUALITY_CHECK_EXECUTE","QUALITY_CHECK_QUERY","QUALITY_CRITICAL_ITEMS",
    "QUALITY_DISPOSITION_EVALUATE","QUALITY_DISPOSITION_EXECUTE","QUALITY_STATS",
    "QUERY_APPROVAL_RECORD","QUERY_DUPONT_ANALYSIS","QUERY_EMPLOYEE_PROFILE",
    "QUERY_EQUIPMENT_STATUS_BY_NAME","QUERY_FINANCE_ROA","QUERY_FINANCE_ROE","QUERY_GENERIC_DETAIL",
    "QUERY_INVENTORY_QUANTITY","QUERY_INVENTORY_TOTAL","QUERY_LIQUIDITY",
    "QUERY_MATERIAL_REJECTION_REASON","QUERY_MATERIAL_STOCK_SUMMARY","QUERY_ONLINE_STAFF_COUNT",
    "QUERY_ORDER_PENDING_MATERIAL_QUANTITY","QUERY_PROCESSING_BATCH_SUPERVISOR",
    "QUERY_PROCESSING_CURRENT_STEP","QUERY_PROCESSING_STEP","QUERY_RETRY_LAST","QUERY_SOLVENCY",
    "QUERY_TRANSPORT_LINE","REPORT_AI_QUALITY","REPORT_ANOMALY","REPORT_BENEFIT_OVERVIEW",
    "REPORT_CHECK","REPORT_DASHBOARD_OVERVIEW","REPORT_EFFICIENCY","REPORT_EXECUTIVE_DAILY",
    "REPORT_FINANCE","REPORT_INTELLIGENT_QUALITY","REPORT_INVENTORY","REPORT_KPI",
    "REPORT_PRODUCTION","REPORT_PRODUCTION_WEEKLY_COMPARISON","REPORT_QUALITY","REPORT_TRENDS",
    "REPORT_WORKSHOP_DAILY","RESTAURANT_BESTSELLER_QUERY","RESTAURANT_DAILY_REVENUE",
    "RESTAURANT_DISH_COST_ANALYSIS","RESTAURANT_DISH_LIST","RESTAURANT_DISH_SALES_RANKING",
    "RESTAURANT_INGREDIENT_COST_TREND","RESTAURANT_INGREDIENT_EXPIRY_ALERT",
    "RESTAURANT_INGREDIENT_LOW_STOCK","RESTAURANT_INGREDIENT_STOCK","RESTAURANT_MARGIN_ANALYSIS",
    "RESTAURANT_ORDER_STATISTICS","RESTAURANT_PEAK_HOURS_ANALYSIS","RESTAURANT_PROCUREMENT_SUGGESTION",
    "RESTAURANT_REVENUE_TREND","RESTAURANT_SLOW_SELLER_QUERY","RESTAURANT_WASTAGE_ANOMALY",
    "RESTAURANT_WASTAGE_RATE","RESTAURANT_WASTAGE_SUMMARY","RULE_CONFIG","SCALE_ADD_DEVICE",
    "SCALE_ADD_DEVICE_VISION","SCALE_DELETE_DEVICE","SCALE_DEVICE_DETAIL","SCALE_LIST_DEVICES",
    "SCALE_UPDATE_DEVICE","SCHEDULING_COVERAGE_QUERY","SCHEDULING_EXECUTE_FOR_DATE",
    "SCHEDULING_LIST","SCHEDULING_RUN_TOMORROW","SCHEDULING_SET_AUTO","SCHEDULING_SET_DISABLED",
    "SCHEDULING_SET_MANUAL","SEND_WECHAT_MESSAGE","SHIPMENT_BY_CUSTOMER","SHIPMENT_BY_DATE",
    "SHIPMENT_CREATE","SHIPMENT_DELETE","SHIPMENT_EXPEDITE","SHIPMENT_NOTIFY_WAREHOUSE_PREPARE",
    "SHIPMENT_QUERY","SHIPMENT_STATS","SHIPMENT_STATUS_UPDATE","SHIPMENT_UPDATE","SHOPPING_CART_CLEAR",
    "SKU_UPDATE_COMPLEXITY","SOP_ANALYZE_COMPLEXITY","SOP_PARSE_DOCUMENT","SUPPLIER_ACTIVE",
    "SUPPLIER_BY_CATEGORY","SUPPLIER_CREATE","SUPPLIER_DELETE","SUPPLIER_EVALUATE","SUPPLIER_LIST",
    "SUPPLIER_PRICE_COMPARISON","SUPPLIER_RANKING","SUPPLIER_SEARCH","SYSTEM_FEEDBACK",
    "SYSTEM_FILTER_EXCLUDE_SELECTED","SYSTEM_GO_BACK","SYSTEM_HELP","SYSTEM_NOTIFICATION",
    "SYSTEM_PASSWORD_RESET","SYSTEM_PERMISSION_QUERY","SYSTEM_PROFILE_EDIT","SYSTEM_RESUME_LAST_ACTION",
    "SYSTEM_SETTINGS","SYSTEM_SWITCH_FACTORY","TASK_ASSIGN_BY_NAME","TASK_ASSIGN_EMPLOYEE",
    "TASK_ASSIGN_WORKER","TASK_PROGRESS_QUERY","TRACE_BATCH","TRACE_FULL","TRACE_PUBLIC",
    "UI_EXCLUDE_SELECTED","USER_CREATE","USER_DELETE","USER_DISABLE","USER_ROLE_ASSIGN",
    "USER_TODO_LIST","USER_UPDATE","WAREHOUSE_OUTBOUND","WORKER_ARRIVAL_CONFIRM",
    "WORKER_IN_SHOP_REALTIME_COUNT","WORK_ORDER_UPDATE"
]
db_labels = set(db_active_list)

# ========== ANALYSIS ==========
print("=" * 60)
print("LABEL SET COUNTS")
print("=" * 60)
print(f"  merged_label_mapping : {len(merged_labels)} labels")
print(f"  all_intent_metrics   : {len(metrics_labels)} intents")
print(f"  V7 model             : {len(v7_labels)} labels")
print(f"  DB active intents    : {len(db_labels)} intents")

print("\n" + "=" * 60)
print("[A] V7 has BUT merged_label_mapping DOES NOT")
print("    (already in model but missing from training label map)")
print("=" * 60)
v7_not_merged = sorted(v7_labels - merged_labels)
print(f"  Count: {len(v7_not_merged)}")
for x in v7_not_merged:
    in_db = "[DB]" if x in db_labels else ""
    in_metrics = "[metrics]" if x in metrics_labels else ""
    print(f"    + {x}  {in_db} {in_metrics}".rstrip())

print("\n" + "=" * 60)
print("[B] merged_label_mapping has BUT V7 DOES NOT")
print("    (in old training map but V7 dropped/merged them)")
print("=" * 60)
merged_not_v7 = sorted(merged_labels - v7_labels)
print(f"  Count: {len(merged_not_v7)}")
for x in merged_not_v7:
    in_db = "[DB]" if x in db_labels else ""
    in_metrics = "[metrics]" if x in metrics_labels else ""
    is_merge_src = "[merge_src]" if x in merged_merge_map else ""
    is_merge_tgt = "[merge_tgt]" if x in merged_merge_map.values() else ""
    print(f"    - {x}  {in_db} {in_metrics} {is_merge_src} {is_merge_tgt}".rstrip())

print("\n" + "=" * 60)
print("[C] DB active has BUT V7 DOES NOT (new DB intents, not yet in model)")
print("=" * 60)
db_not_v7 = sorted(db_labels - v7_labels)
print(f"  Count: {len(db_not_v7)}")
for x in db_not_v7:
    in_merged = "[merged]" if x in merged_labels else ""
    in_metrics = "[metrics]" if x in metrics_labels else ""
    print(f"    + {x}  {in_merged} {in_metrics}".rstrip())

print("\n" + "=" * 60)
print("[D] merged has BUT DB AND V7 both MISSING (orphan labels)")
print("=" * 60)
orphans = sorted(merged_labels - db_labels - v7_labels)
print(f"  Count: {len(orphans)}")
for x in orphans:
    in_metrics = "[metrics]" if x in metrics_labels else ""
    print(f"    ? {x}  {in_metrics}".rstrip())

print("\n" + "=" * 60)
print("[E] DB only (not in V7, not in merged, not in metrics)")
print("    = Completely new intents, need V8 labels + training data")
print("=" * 60)
db_truly_new = sorted(db_labels - v7_labels - merged_labels - metrics_labels)
print(f"  Count: {len(db_truly_new)}")
for x in db_truly_new:
    print(f"    ++ {x}")

print("\n" + "=" * 60)
print("[F] all_intent_metrics has BUT V7 DOES NOT")
print("    (metrics were tracked but model never learned them)")
print("=" * 60)
metrics_not_v7 = sorted(metrics_labels - v7_labels)
print(f"  Count: {len(metrics_not_v7)}")
for x in metrics_not_v7:
    in_db = "[DB]" if x in db_labels else ""
    in_merged = "[merged]" if x in merged_labels else ""
    print(f"    {x}  {in_db} {in_merged}".rstrip())

print("\n" + "=" * 60)
print("MERGE MAP STATUS (from merged_label_mapping)")
print("=" * 60)
for old, new in sorted(merged_merge_map.items()):
    in_db = "[in DB]" if old in db_labels else "[NOT in DB]"
    in_v7 = "[in V7]" if old in v7_labels else "[NOT in V7]"
    print(f"  {old} -> {new}  {in_db} {in_v7}")

# ========== BUILD V8 LABEL MAPPING ==========
print("\n" + "=" * 60)
print("BUILDING v8_label_mapping.json")
print("=" * 60)

# Strategy:
# Base: V7 model labels (259) — preserve indices to enable weight transfer
# Add: DB labels not yet in V7 (real new intents that have handlers)
# Exclude: legacy aliases/duplicates that are in DB but known merge targets
#   (NOTIFICATION_WECHAT_SEND, SEND_WECHAT_MESSAGE, ORDER_MODIFY, HR_EMPLOYEE_DELETE
#    are merge aliases in the existing merge_map, not canonical labels)
# Exclude: ATTENDANCE_DEPARTMENT was in DB and metrics but dropped in V7 for good reason?
#   -> it IS in V7 (id=8), keep it.

# New aliases in DB that should be added to merge_map instead of as new labels:
KNOWN_ALIASES = {
    "NOTIFICATION_WECHAT_SEND": "NOTIFICATION_SEND_WECHAT",  # already in merge_map
    "SEND_WECHAT_MESSAGE":      "NOTIFICATION_SEND_WECHAT",  # already in merge_map
    "ORDER_MODIFY":             "ORDER_UPDATE",               # already in merge_map
    "HR_EMPLOYEE_DELETE":       "HR_DELETE_EMPLOYEE",         # already in merge_map
    "ALERT_ACKNOWLEDGE":        "EQUIPMENT_ALERT_ACKNOWLEDGE",# old alias
    "ALERT_LIST":               "EQUIPMENT_ALERT_LIST",       # old alias
    "ALERT_RESOLVE":            "EQUIPMENT_ALERT_RESOLVE",    # old alias (but V7 has it as distinct!)
    "ALERT_STATS":              "EQUIPMENT_ALERT_STATS",      # old alias
}
# NOTE: ALERT_RESOLVE is in V7 as a separate label (id=4) AND merged_label_mapping had it merged
# to EQUIPMENT_ALERT_RESOLVE. V7 kept it separate. We keep V7's structure.

# Genuinely new DB intents to add (not aliases, not in V7):
new_canonical = sorted([
    x for x in (db_labels - v7_labels)
    if x not in KNOWN_ALIASES
])

print(f"  V7 base labels: {len(v7_labels)}")
print(f"  New canonical labels to add: {len(new_canonical)}")
for x in new_canonical:
    print(f"    + {x}")

# Build ordered list: V7 order preserved, then new labels alphabetically
v8_ordered = list(v7_labels_ordered) + new_canonical
assert len(set(v8_ordered)) == len(v8_ordered), "Duplicates in v8 list!"

label_to_id = {label: idx for idx, label in enumerate(v8_ordered)}
id_to_label = {str(idx): label for idx, label in enumerate(v8_ordered)}

# Build updated merge_map: carry over old ones + new alias mappings
new_merge_map = dict(merged_merge_map)
for alias, canonical in KNOWN_ALIASES.items():
    if alias not in new_merge_map:
        new_merge_map[alias] = canonical

v8_mapping = {
    "label_to_id": label_to_id,
    "id_to_label": id_to_label,
    "num_labels": len(v8_ordered),
    "v7_num_labels": 259,
    "new_labels_added": len(new_canonical),
    "new_labels": new_canonical,
    "merge_map": new_merge_map,
    "note": (
        "V8 label mapping. Base: V7 model (259 labels, indices 0-258 preserved). "
        "New labels appended at indices 259+. "
        "Use smart_weight_transfer.py to initialize new label heads from similar classes."
    )
}

out_path = "scripts/finetune/data/v8_label_mapping.json"
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(v8_mapping, f, ensure_ascii=False, indent=2)

print(f"\n  Written: {out_path}")
print(f"  Total V8 labels: {len(v8_ordered)}")
print(f"  V7 index range preserved: 0-{len(v7_labels_ordered)-1}")
print(f"  New label index range: {len(v7_labels_ordered)}-{len(v8_ordered)-1}")

# Final cross-check
print("\n" + "=" * 60)
print("CROSS-CHECK: DB intents coverage in V8")
print("=" * 60)
v8_labels = set(label_to_id.keys())
db_not_v8 = sorted(db_labels - v8_labels - set(new_merge_map.keys()))
print(f"  DB intents NOT covered by V8 labels or merge_map: {len(db_not_v8)}")
for x in db_not_v8:
    print(f"    UNCOVERED: {x}")

db_via_alias = sorted(x for x in db_labels if x in new_merge_map)
print(f"\n  DB intents covered via merge_map alias ({len(db_via_alias)}):")
for x in db_via_alias:
    print(f"    {x} -> {new_merge_map[x]}")

print("\nDone.")
