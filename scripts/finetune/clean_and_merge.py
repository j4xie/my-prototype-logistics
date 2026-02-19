#!/usr/bin/env python3
"""
Phase 1 data cleanup: merge duplicates, remove irrelevant intents, clean conflicts.

Steps:
  1A: Sync label_mapping to 170-class production baseline (merge already-merged labels)
  1B: Second-round class merging (remaining duplicates)
  1C: Delete irrelevant intent classes
  1D: Clean conflict labels (>3 labels per text → delete, dedup exact duplicates)

Usage: python scripts/finetune/clean_and_merge.py
"""

import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

BASE_DIR = Path(__file__).parent
DATA_PATH = BASE_DIR / "data" / "full_training_data.jsonl"
LABEL_MAPPING_PATH = BASE_DIR / "data" / "label_mapping.json"
OUTPUT_DATA_PATH = BASE_DIR / "data" / "full_training_data.jsonl"  # overwrite
OUTPUT_MAPPING_PATH = BASE_DIR / "data" / "label_mapping.json"     # overwrite
BACKUP_DATA_PATH = BASE_DIR / "data" / "full_training_data.jsonl.bak"
BACKUP_MAPPING_PATH = BASE_DIR / "data" / "label_mapping.json.bak"

# === 1A: Labels already merged in production (177 → ~168) ===
# These were merged in the previous round but label_mapping.json was not updated
MERGE_ROUND1 = {
    "ALERT_ACKNOWLEDGE": "EQUIPMENT_ALERT_ACKNOWLEDGE",
    "ALERT_LIST": "EQUIPMENT_ALERT_LIST",
    "ALERT_RESOLVE": "EQUIPMENT_ALERT_RESOLVE",
    "ALERT_STATS": "EQUIPMENT_ALERT_STATS",
    "HR_EMPLOYEE_DELETE": "HR_DELETE_EMPLOYEE",
    "NAVIGATION_NEXT_PAGE": "PAGINATION_NEXT",
    "NOTIFICATION_WECHAT_SEND": "NOTIFICATION_SEND_WECHAT",
    "ORDER_MODIFY": "ORDER_UPDATE",
    "SEND_WECHAT_MESSAGE": "NOTIFICATION_SEND_WECHAT",
}

# === 1B: Second-round merges (remaining duplicates) ===
MERGE_ROUND2 = {
    "HRM_DELETE_EMPLOYEE": "HR_DELETE_EMPLOYEE",
    "FILTER_EXCLUDE_SELECTED": "EXCLUDE_SELECTED",
    "SYSTEM_FILTER_EXCLUDE_SELECTED": "EXCLUDE_SELECTED",
    "UI_EXCLUDE_SELECTED": "EXCLUDE_SELECTED",
    # These two merge into targets that will be deleted in 1C
    "NAVIGATION_TO_CITY": "NAVIGATE_TO_CITY",
    "NAVIGATION_TO_LOCATION": "NAVIGATE_TO_LOCATION",
}

# Combined merge map
ALL_MERGES = {**MERGE_ROUND1, **MERGE_ROUND2}

# === 1C: Irrelevant intents to delete entirely ===
DELETE_INTENTS = {
    "NAVIGATE_TO_CITY",        # Map navigation, not food traceability
    "NAVIGATE_TO_LOCATION",    # Map navigation
    "MEDIA_PLAY",              # Media playback
    "MEDIA_PLAY_MUSIC",        # Music playback
    "SHOPPING_CART_CLEAR",     # Mall system, not this app
    "OPEN_CAMERA",             # Redundant with EQUIPMENT_CAMERA_START
}

# Intent display names (for new label_mapping)
INTENT_NAMES = {
    "ALERT_ACTIVE": "活跃告警",
    "ALERT_BY_EQUIPMENT": "按设备告警",
    "ALERT_BY_LEVEL": "按级别告警",
    "ALERT_DIAGNOSE": "告警诊断",
    "ALERT_TRIAGE": "告警分级",
    "ATTENDANCE_ANOMALY": "考勤异常",
    "ATTENDANCE_DEPARTMENT": "部门考勤",
    "ATTENDANCE_HISTORY": "考勤历史",
    "ATTENDANCE_MONTHLY": "月度考勤",
    "ATTENDANCE_STATS": "考勤统计",
    "ATTENDANCE_STATS_BY_DEPT": "部门考勤统计",
    "ATTENDANCE_STATUS": "打卡状态",
    "ATTENDANCE_TODAY": "今日打卡记录",
    "BATCH_UPDATE": "批次更新",
    "CLOCK_IN": "上班打卡",
    "CLOCK_OUT": "下班打卡",
    "COLD_CHAIN_TEMPERATURE": "冷链温度监控",
    "CONDITION_SWITCH": "切换查询条件",
    "CONFIG_RESET": "重置配置",
    "CONTINUE_LAST_OPERATION": "继续最近的操作",
    "CONVERSION_RATE_UPDATE": "转换率配置",
    "COST_QUERY": "成本查询",
    "COST_TREND_ANALYSIS": "成本趋势分析",
    "CUSTOMER_ACTIVE": "活跃客户",
    "CUSTOMER_BY_TYPE": "按类型客户",
    "CUSTOMER_DELETE": "删除客户",
    "CUSTOMER_LIST": "客户列表",
    "CUSTOMER_PURCHASE_HISTORY": "客户购买历史",
    "CUSTOMER_SEARCH": "客户搜索",
    "CUSTOMER_STATS": "客户统计",
    "DATA_BATCH_DELETE": "批量删除数据",
    "EQUIPMENT_ALERT_ACKNOWLEDGE": "确认设备告警",
    "EQUIPMENT_ALERT_LIST": "设备告警列表",
    "EQUIPMENT_ALERT_RESOLVE": "解决设备告警",
    "EQUIPMENT_ALERT_STATS": "设备告警统计",
    "EQUIPMENT_CAMERA_START": "启动相机设备",
    "EQUIPMENT_DELETE": "删除设备",
    "EQUIPMENT_DETAIL": "设备详情查询",
    "EQUIPMENT_LIST": "设备列表查询",
    "EQUIPMENT_MAINTENANCE": "设备维护",
    "EQUIPMENT_START": "启动设备",
    "EQUIPMENT_STATS": "设备统计",
    "EQUIPMENT_STATUS_QUERY": "设备状态查询",
    "EQUIPMENT_STATUS_UPDATE": "设备状态更新",
    "EQUIPMENT_STOP": "停止设备",
    "EXCLUDE_SELECTED": "排除已选项",
    "EXECUTE_SWITCH": "执行切换操作",
    "FACTORY_FEATURE_TOGGLE": "功能开关",
    "FACTORY_NOTIFICATION_CONFIG": "通知设置",
    "FORM_GENERATION": "表单字段生成",
    "HR_DELETE_EMPLOYEE": "删除员工",
    "INTENT_ANALYZE": "分析意图使用",
    "INTENT_CREATE": "创建AI意图",
    "INTENT_UPDATE": "更新AI意图",
    "INVENTORY_CLEAR": "清空库存",
    "ISAPI_CONFIG_FIELD_DETECTION": "配置区域入侵",
    "ISAPI_CONFIG_LINE_DETECTION": "配置行为检测",
    "ISAPI_QUERY_CAPABILITIES": "查询智能分析能力",
    "MATERIAL_ADJUST_QUANTITY": "调整数量",
    "MATERIAL_BATCH_CONSUME": "消耗预留",
    "MATERIAL_BATCH_CREATE": "原料入库",
    "MATERIAL_BATCH_QUERY": "原料批次查询",
    "MATERIAL_BATCH_RELEASE": "释放预留",
    "MATERIAL_BATCH_RESERVE": "预留原料",
    "MATERIAL_BATCH_USE": "使用原料",
    "MATERIAL_EXPIRED_QUERY": "已过期查询",
    "MATERIAL_EXPIRING_ALERT": "即将过期预警",
    "MATERIAL_FIFO_RECOMMEND": "FIFO推荐",
    "MATERIAL_LOW_STOCK_ALERT": "低库存预警",
    "MATERIAL_UPDATE": "原材料更新",
    "MRP_CALCULATION": "MRP计算",
    "NOTIFICATION_SEND_WECHAT": "发送微信通知",
    "OPERATION_UNDO_OR_RECALL": "撤销或回溯操作",
    "ORDER_DELETE": "删除订单",
    "ORDER_FILTER": "订单条件查询",
    "ORDER_LIST": "订单列表",
    "ORDER_STATUS": "订单状态",
    "ORDER_TODAY": "今日订单",
    "ORDER_UPDATE": "修改订单",
    "PAGINATION_NEXT": "下一页",
    "PLAN_UPDATE": "计划更新",
    "PROCESSING_BATCH_CANCEL": "取消生产",
    "PROCESSING_BATCH_COMPLETE": "完成生产",
    "PROCESSING_BATCH_CREATE": "创建生产批次",
    "PROCESSING_BATCH_DETAIL": "生产批次详情",
    "PROCESSING_BATCH_LIST": "生产批次列表",
    "PROCESSING_BATCH_PAUSE": "暂停生产",
    "PROCESSING_BATCH_RESUME": "恢复生产",
    "PROCESSING_BATCH_START": "开始生产",
    "PROCESSING_BATCH_TIMELINE": "生产批次时间线",
    "PROCESSING_BATCH_WORKERS": "批次员工列表",
    "PROCESSING_WORKER_ASSIGN": "分配员工到批次",
    "PROCESSING_WORKER_CHECKOUT": "员工签出",
    "PRODUCTION_STATUS_QUERY": "生产状态查询",
    "PRODUCT_TYPE_QUERY": "产品类型查询",
    "PRODUCT_UPDATE": "产品更新",
    "QUALITY_CHECK_EXECUTE": "执行质检",
    "QUALITY_CHECK_QUERY": "质检项查询",
    "QUALITY_CRITICAL_ITEMS": "关键质检项",
    "QUALITY_DISPOSITION_EVALUATE": "处置评估",
    "QUALITY_DISPOSITION_EXECUTE": "执行处置",
    "QUALITY_STATS": "质检统计",
    "QUERY_DUPONT_ANALYSIS": "杜邦分析",
    "QUERY_EMPLOYEE_PROFILE": "查询员工资料",
    "QUERY_FINANCE_ROA": "ROA查询",
    "QUERY_FINANCE_ROE": "ROE查询",
    "QUERY_GENERIC_DETAIL": "通用详情查询",
    "QUERY_LIQUIDITY": "流动性查询",
    "QUERY_RETRY_LAST": "重复上次查询",
    "QUERY_SOLVENCY": "偿债能力查询",
    "REPORT_ANOMALY": "异常报表",
    "REPORT_DASHBOARD_OVERVIEW": "仪表盘总览",
    "REPORT_EFFICIENCY": "效率分析报表",
    "REPORT_FINANCE": "财务报表",
    "REPORT_INVENTORY": "库存报表",
    "REPORT_KPI": "KPI指标报表",
    "REPORT_PRODUCTION": "生产报表",
    "REPORT_QUALITY": "质量报表",
    "REPORT_TRENDS": "趋势报表",
    "RULE_CONFIG": "规则配置",
    "SCALE_ADD_DEVICE": "自然语言添加秤设备",
    "SCALE_ADD_DEVICE_VISION": "图片识别添加秤设备",
    "SCALE_DELETE_DEVICE": "删除秤设备",
    "SCALE_DEVICE_DETAIL": "查看秤设备详情",
    "SCALE_LIST_DEVICES": "查看秤设备列表",
    "SCALE_UPDATE_DEVICE": "修改秤设备",
    "SCHEDULING_SET_AUTO": "排产全自动",
    "SCHEDULING_SET_DISABLED": "禁用自动排产",
    "SCHEDULING_SET_MANUAL": "排产人工确认",
    "SHIPMENT_BY_CUSTOMER": "客户出货",
    "SHIPMENT_BY_DATE": "日期出货",
    "SHIPMENT_CREATE": "创建发货单",
    "SHIPMENT_QUERY": "查询出货",
    "SHIPMENT_STATS": "出货统计",
    "SHIPMENT_STATUS_UPDATE": "更新出货状态",
    "SHIPMENT_UPDATE": "更新出货",
    "SUPPLIER_ACTIVE": "活跃供应商",
    "SUPPLIER_BY_CATEGORY": "按类别供应商",
    "SUPPLIER_DELETE": "删除供应商",
    "SUPPLIER_EVALUATE": "供应商评估",
    "SUPPLIER_LIST": "供应商列表",
    "SUPPLIER_RANKING": "供应商排名",
    "SUPPLIER_SEARCH": "供应商搜索",
    "SYSTEM_GO_BACK": "返回上一步操作",
    "SYSTEM_RESUME_LAST_ACTION": "续执行上一个操作",
    "TASK_ASSIGN_EMPLOYEE": "分配任务给员工",
    "TASK_ASSIGN_WORKER": "分配任务给员工",
    "TRACE_BATCH": "批次溯源",
    "TRACE_FULL": "完整溯源",
    "TRACE_PUBLIC": "公开溯源",
    "USER_CREATE": "创建用户",
    "USER_DELETE": "删除用户",
    "USER_DISABLE": "禁用用户",
    "USER_ROLE_ASSIGN": "角色分配",
    "USER_UPDATE": "更新员工信息",
    "financial_ratios": "财务比率分析",
    "FOOD_KNOWLEDGE_QUERY": "食品知识查询",
}


def main():
    print("=" * 60)
    print("Phase 1: Data Cleanup (1A + 1B + 1C + 1D)")
    print("=" * 60)

    # --- Load data ---
    print("\n[Load] Reading training data...")
    raw_data = []
    with open(DATA_PATH, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line:
                raw_data.append(json.loads(line))
    print(f"  Original samples: {len(raw_data)}")

    # Count original labels
    orig_labels = set(d["label"] for d in raw_data)
    print(f"  Original unique labels: {len(orig_labels)}")

    # --- Backup ---
    print("\n[Backup] Saving backups...")
    import shutil
    shutil.copy2(DATA_PATH, BACKUP_DATA_PATH)
    shutil.copy2(LABEL_MAPPING_PATH, BACKUP_MAPPING_PATH)
    print(f"  {BACKUP_DATA_PATH}")
    print(f"  {BACKUP_MAPPING_PATH}")

    # --- Step 1A+1B: Apply merges ---
    print(f"\n[1A+1B] Applying {len(ALL_MERGES)} label merges...")
    merge_counts = Counter()
    for d in raw_data:
        old_label = d["label"]
        if old_label in ALL_MERGES:
            d["label"] = ALL_MERGES[old_label]
            merge_counts[old_label] += 1

    for old, new in sorted(ALL_MERGES.items()):
        cnt = merge_counts.get(old, 0)
        print(f"  {old} → {new}  ({cnt} samples)")
    print(f"  Total remapped: {sum(merge_counts.values())} samples")

    # --- Step 1C: Delete irrelevant intents ---
    print(f"\n[1C] Deleting {len(DELETE_INTENTS)} irrelevant intents...")
    before_delete = len(raw_data)
    delete_counts = Counter()
    kept_data = []
    for d in raw_data:
        if d["label"] in DELETE_INTENTS:
            delete_counts[d["label"]] += 1
        else:
            kept_data.append(d)

    for label in sorted(DELETE_INTENTS):
        cnt = delete_counts.get(label, 0)
        print(f"  DELETE {label}  ({cnt} samples)")
    raw_data = kept_data
    print(f"  Removed: {before_delete - len(raw_data)} samples, remaining: {len(raw_data)}")

    # --- Step 1D: Clean conflicts ---
    print(f"\n[1D] Cleaning conflict labels...")

    # Find text → set of labels
    text_labels = defaultdict(set)
    for d in raw_data:
        text_labels[d["text"]].add(d["label"])

    # Categorize conflicts
    extreme_conflicts = set()  # >3 labels
    minor_conflicts = {}       # 2-3 labels → keep most common
    clean_texts = set()

    for text, labels in text_labels.items():
        if len(labels) > 3:
            extreme_conflicts.add(text)
        elif len(labels) > 1:
            minor_conflicts[text] = labels
        else:
            clean_texts.add(text)

    print(f"  Clean texts: {len(clean_texts)}")
    print(f"  Minor conflicts (2-3 labels): {len(minor_conflicts)}")
    print(f"  Extreme conflicts (>3 labels): {len(extreme_conflicts)}")

    # For minor conflicts: count label frequency across all data, keep most common
    label_freq = Counter(d["label"] for d in raw_data)

    # Remove extreme conflict texts entirely
    before_conflict = len(raw_data)
    cleaned_data = []
    for d in raw_data:
        if d["text"] in extreme_conflicts:
            continue  # drop
        if d["text"] in minor_conflicts:
            # Keep only the most frequent label for this text
            best_label = max(minor_conflicts[d["text"]], key=lambda l: label_freq[l])
            if d["label"] == best_label:
                cleaned_data.append(d)
            # else: drop the less common label variant
        else:
            cleaned_data.append(d)

    raw_data = cleaned_data
    print(f"  After conflict cleanup: {len(raw_data)} (removed {before_conflict - len(raw_data)})")

    # Dedup exact (text, label) pairs
    before_dedup = len(raw_data)
    seen = set()
    deduped_data = []
    for d in raw_data:
        key = (d["text"], d["label"])
        if key not in seen:
            seen.add(key)
            deduped_data.append(d)

    raw_data = deduped_data
    print(f"  After dedup: {len(raw_data)} (removed {before_dedup - len(raw_data)} duplicates)")

    # --- Build new label_mapping ---
    print(f"\n[Rebuild] Building new label_mapping...")
    final_labels = sorted(set(d["label"] for d in raw_data))
    print(f"  Final unique labels: {len(final_labels)}")

    label_to_id = {label: i for i, label in enumerate(final_labels)}
    id_to_label = {str(i): label for i, label in enumerate(final_labels)}
    intent_names = {}
    for label in final_labels:
        if label in INTENT_NAMES:
            intent_names[label] = INTENT_NAMES[label]
        else:
            intent_names[label] = label  # fallback

    new_mapping = {
        "label_to_id": label_to_id,
        "id_to_label": id_to_label,
        "intent_names": intent_names,
        "num_labels": len(final_labels),
    }

    # --- Per-class sample counts ---
    print(f"\n[Stats] Per-class sample counts:")
    class_counts = Counter(d["label"] for d in raw_data)
    for label in final_labels:
        cnt = class_counts[label]
        marker = " ⚠️" if cnt < 50 else ""
        print(f"  {label}: {cnt}{marker}")

    low_count = sum(1 for c in class_counts.values() if c < 50)
    print(f"\n  Classes with <50 samples: {low_count}")

    # --- Text length stats ---
    lengths = [len(d["text"]) for d in raw_data]
    under_10 = sum(1 for l in lengths if l < 10)
    print(f"\n[Stats] Text length:")
    print(f"  Mean: {sum(lengths)/len(lengths):.1f} chars")
    print(f"  <10 chars: {under_10} ({100*under_10/len(lengths):.1f}%)")
    print(f"  Max: {max(lengths)} chars")

    # --- Save ---
    print(f"\n[Save] Writing cleaned data...")
    with open(OUTPUT_DATA_PATH, 'w', encoding='utf-8') as f:
        for d in raw_data:
            f.write(json.dumps(d, ensure_ascii=False) + '\n')
    print(f"  {OUTPUT_DATA_PATH}: {len(raw_data)} samples")

    with open(OUTPUT_MAPPING_PATH, 'w', encoding='utf-8') as f:
        json.dump(new_mapping, f, ensure_ascii=False, indent=2)
    print(f"  {OUTPUT_MAPPING_PATH}: {new_mapping['num_labels']} classes")

    # --- Summary ---
    print(f"\n{'=' * 60}")
    print(f"SUMMARY")
    print(f"{'=' * 60}")
    print(f"  Labels:  177 → {new_mapping['num_labels']}")
    print(f"  Merges applied: {len(ALL_MERGES)} ({sum(merge_counts.values())} samples)")
    print(f"  Intents deleted: {len(DELETE_INTENTS)}")
    print(f"  Samples: original → {len(raw_data)}")
    print(f"  Backups: .bak files created")
    print(f"{'=' * 60}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
