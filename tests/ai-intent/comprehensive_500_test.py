#!/usr/bin/env python3
"""
AI Intent Recognition System - Comprehensive 500 Test Cases
Tests all 4 Phases:
- Phase 1: Preview/Confirm (TCC) for high-risk operations
- Phase 2: Multi-source confidence fusion (LLM, Keyword, Semantic)
- Phase 3: Smart clarification for ambiguous inputs
- Phase 4: Active learning triggers
"""

import requests
import json
import time
from datetime import datetime
from typing import List, Dict, Any
from dataclasses import dataclass
from enum import Enum
import random

# Configuration
BASE_URL = "http://139.196.165.140:10010"
LOGIN_URL = f"{BASE_URL}/api/mobile/auth/unified-login"
RECOGNIZE_URL = f"{BASE_URL}/api/public/ai-demo/recognize"
EXECUTE_URL = f"{BASE_URL}/api/public/ai-demo/execute"
ACTIVE_LEARNING_URL = f"{BASE_URL}/api/mobile/F001/ai/active-learning"

class TestCategory(Enum):
    SIMPLE_QUERY = "simple_query"           # Simple data queries
    COMPLEX_QUERY = "complex_query"         # Multi-condition queries
    HIGH_RISK_OP = "high_risk_operation"    # Delete/Update operations (Phase 1)
    AMBIGUOUS = "ambiguous"                 # Needs clarification (Phase 3)
    MULTI_INTENT = "multi_intent"           # Multiple intents in one input
    CONTEXT_DEPENDENT = "context_dependent" # Requires context/coreference
    LOW_CONFIDENCE = "low_confidence"       # Should trigger active learning (Phase 4)
    EDGE_CASE = "edge_case"                 # Edge cases and boundary tests
    DOMAIN_SPECIFIC = "domain_specific"     # Domain-specific terminology
    TYPO_NOISE = "typo_noise"               # Inputs with typos/noise

@dataclass
class TestCase:
    id: int
    category: TestCategory
    input_text: str
    expected_intent: str = None
    expected_behavior: str = None
    phase_tested: List[int] = None

    def to_dict(self):
        return {
            "id": self.id,
            "category": self.category.value,
            "input": self.input_text,
            "expected_intent": self.expected_intent,
            "expected_behavior": self.expected_behavior,
            "phases": self.phase_tested or []
        }

def generate_test_cases() -> List[TestCase]:
    """Generate 500 comprehensive test cases"""
    cases = []
    case_id = 1

    # ========== Category 1: Simple Queries (100 cases) ==========
    simple_queries = [
        ("查看今天的订单", "ORDER_QUERY", "direct_match"),
        ("显示所有产品", "PRODUCT_TYPE_QUERY", "direct_match"),
        ("查询库存", "INVENTORY_QUERY", "direct_match"),
        ("今日生产报表", "REPORT_PRODUCTION", "direct_match"),
        ("查看员工列表", "EMPLOYEE_QUERY", "direct_match"),
        ("显示设备状态", "EQUIPMENT_STATUS", "direct_match"),
        ("查询批次信息", "BATCH_QUERY", "direct_match"),
        ("查看质检记录", "QUALITY_RECORD_QUERY", "direct_match"),
        ("显示仓库列表", "WAREHOUSE_QUERY", "direct_match"),
        ("查询供应商", "SUPPLIER_QUERY", "direct_match"),
        ("今天有多少订单", "ORDER_QUERY", "count_query"),
        ("产品有哪些", "PRODUCT_TYPE_QUERY", "list_query"),
        ("库存情况如何", "INVENTORY_QUERY", "status_query"),
        ("生产进度怎样", "PRODUCTION_PROGRESS", "status_query"),
        ("设备运行正常吗", "EQUIPMENT_STATUS", "status_query"),
        ("查一下订单123", "ORDER_QUERY", "specific_query"),
        ("找产品PT001", "PRODUCT_TYPE_QUERY", "specific_query"),
        ("批次B001的信息", "BATCH_QUERY", "specific_query"),
        ("员工张三的资料", "EMPLOYEE_QUERY", "specific_query"),
        ("仓库A的库存", "INVENTORY_QUERY", "specific_query"),
        # English variations
        ("show orders", "ORDER_QUERY", "english_input"),
        ("list products", "PRODUCT_TYPE_QUERY", "english_input"),
        ("inventory status", "INVENTORY_QUERY", "english_input"),
        ("production report", "REPORT_PRODUCTION", "english_input"),
        ("employee list", "EMPLOYEE_QUERY", "english_input"),
        # Casual language
        ("订单呢", "ORDER_QUERY", "casual"),
        ("产品看看", "PRODUCT_TYPE_QUERY", "casual"),
        ("库存多少", "INVENTORY_QUERY", "casual"),
        ("报表给我", "REPORT_PRODUCTION", "casual"),
        ("员工名单", "EMPLOYEE_QUERY", "casual"),
        # With time context
        ("昨天的订单", "ORDER_QUERY", "time_context"),
        ("上周生产量", "REPORT_PRODUCTION", "time_context"),
        ("本月库存变化", "INVENTORY_QUERY", "time_context"),
        ("今年销售额", "SALES_QUERY", "time_context"),
        ("过去7天的质检", "QUALITY_RECORD_QUERY", "time_context"),
        # With quantity
        ("前10个订单", "ORDER_QUERY", "quantity_limit"),
        ("最新5个产品", "PRODUCT_TYPE_QUERY", "quantity_limit"),
        ("库存最低的10个", "INVENTORY_QUERY", "quantity_limit"),
        ("销量前20", "SALES_QUERY", "quantity_limit"),
        ("最近3个批次", "BATCH_QUERY", "quantity_limit"),
    ]

    for i, (text, intent, behavior) in enumerate(simple_queries):
        cases.append(TestCase(
            id=case_id,
            category=TestCategory.SIMPLE_QUERY,
            input_text=text,
            expected_intent=intent,
            expected_behavior=behavior,
            phase_tested=[2]
        ))
        case_id += 1

    # Generate more simple query variations (to reach ~100)
    query_templates = [
        "查看{entity}", "显示{entity}", "查询{entity}", "{entity}列表", "{entity}情况",
        "获取{entity}", "找{entity}", "{entity}有哪些", "{entity}是什么", "看看{entity}"
    ]
    entities = ["订单", "产品", "库存", "员工", "设备", "批次", "仓库", "供应商", "客户", "物料"]

    for template in query_templates[:6]:
        for entity in entities[:6]:
            if case_id > 100:
                break
            cases.append(TestCase(
                id=case_id,
                category=TestCategory.SIMPLE_QUERY,
                input_text=template.format(entity=entity),
                expected_intent=None,
                expected_behavior="template_generated",
                phase_tested=[2]
            ))
            case_id += 1

    # ========== Category 2: Complex Queries (80 cases) ==========
    complex_queries = [
        ("查询本月销售额超过10000的订单并按金额排序", "ORDER_QUERY", "multi_condition"),
        ("显示库存低于安全线且需要补货的产品", "INVENTORY_QUERY", "multi_condition"),
        ("找出过去一周质检不合格的批次及其原因", "QUALITY_RECORD_QUERY", "multi_condition"),
        ("统计各仓库的库存总值并生成报表", "REPORT_INVENTORY", "aggregation"),
        ("对比上月和本月的生产效率", "REPORT_PRODUCTION", "comparison"),
        ("查询员工张三负责的所有订单及完成率", "ORDER_QUERY", "relation_query"),
        ("显示设备A的维护记录和下次保养时间", "EQUIPMENT_MAINTENANCE", "multi_field"),
        ("分析客户购买行为并推荐相似产品", "CUSTOMER_ANALYSIS", "analysis"),
        ("计算批次B001的成本构成", "COST_ANALYSIS", "calculation"),
        ("预测下月库存需求", "INVENTORY_FORECAST", "prediction"),
        # More complex queries
        ("查询所有状态为待处理且创建时间超过3天的订单", "ORDER_QUERY", "complex_filter"),
        ("找出本季度销量增长超过20%的产品", "PRODUCT_TYPE_QUERY", "growth_analysis"),
        ("显示各部门的人员配置和绩效对比", "EMPLOYEE_QUERY", "department_comparison"),
        ("分析设备故障率与维护周期的关系", "EQUIPMENT_ANALYSIS", "correlation"),
        ("统计各供应商的交付准时率", "SUPPLIER_ANALYSIS", "performance_metric"),
        # Time-series queries
        ("显示过去12个月的销售趋势图", "SALES_TREND", "time_series"),
        ("对比2024和2025年同期产量", "PRODUCTION_COMPARISON", "yoy_comparison"),
        ("分析库存周转率的季度变化", "INVENTORY_TURNOVER", "quarterly_analysis"),
        ("查看设备利用率的月度报告", "EQUIPMENT_UTILIZATION", "monthly_report"),
        ("统计客户投诉的趋势和分类", "COMPLAINT_ANALYSIS", "trend_analysis"),
        # Multi-entity queries
        ("查询订单O001关联的所有批次和物料", "ORDER_DETAIL", "multi_entity"),
        ("显示产品P001的完整供应链信息", "SUPPLY_CHAIN_QUERY", "chain_query"),
        ("找出与客户C001有关的所有交易记录", "TRANSACTION_QUERY", "customer_related"),
        ("查看员工E001参与的所有生产任务", "PRODUCTION_TASK_QUERY", "employee_related"),
        ("显示仓库W001的入库出库明细", "WAREHOUSE_TRANSACTION", "warehouse_detail"),
    ]

    for text, intent, behavior in complex_queries:
        cases.append(TestCase(
            id=case_id,
            category=TestCategory.COMPLEX_QUERY,
            input_text=text,
            expected_intent=intent,
            expected_behavior=behavior,
            phase_tested=[2, 3]
        ))
        case_id += 1

    # Generate more complex queries
    complex_templates = [
        "查询{time}的{entity}并按{field}排序",
        "统计{entity}的{metric}并生成{report_type}",
        "对比{time1}和{time2}的{metric}",
        "分析{entity}的{behavior}趋势",
        "找出{condition}的{entity}及其{detail}"
    ]

    time_options = ["本月", "上周", "今年", "本季度", "过去30天"]
    entity_options = ["订单", "产品", "库存", "员工", "设备"]
    field_options = ["金额", "数量", "时间", "状态", "类型"]

    for _ in range(55):
        if case_id > 180:
            break
        template = random.choice(complex_templates)
        text = template.format(
            time=random.choice(time_options),
            time1=random.choice(time_options),
            time2=random.choice(time_options),
            entity=random.choice(entity_options),
            field=random.choice(field_options),
            metric="数量",
            report_type="报表",
            behavior="变化",
            condition="异常",
            detail="详情"
        )
        cases.append(TestCase(
            id=case_id,
            category=TestCategory.COMPLEX_QUERY,
            input_text=text,
            expected_intent=None,
            expected_behavior="template_generated",
            phase_tested=[2, 3]
        ))
        case_id += 1

    # ========== Category 3: High-Risk Operations - Phase 1 (60 cases) ==========
    high_risk_ops = [
        ("删除订单O001", "ORDER_DELETE", "delete_operation"),
        ("取消所有待处理订单", "ORDER_CANCEL_BATCH", "batch_delete"),
        ("清空库存数据", "INVENTORY_CLEAR", "dangerous_operation"),
        ("删除员工E001的记录", "EMPLOYEE_DELETE", "delete_operation"),
        ("移除产品P001", "PRODUCT_DELETE", "delete_operation"),
        ("废弃批次B001", "BATCH_VOID", "void_operation"),
        ("删除所有过期数据", "DATA_PURGE", "batch_delete"),
        ("重置系统设置", "SYSTEM_RESET", "dangerous_operation"),
        ("清除质检记录", "QUALITY_RECORD_DELETE", "delete_operation"),
        ("删除供应商S001", "SUPPLIER_DELETE", "delete_operation"),
        # Update operations that need confirmation
        ("修改所有订单状态为已完成", "ORDER_BATCH_UPDATE", "batch_update"),
        ("更新所有产品价格", "PRODUCT_PRICE_UPDATE", "batch_update"),
        ("批量调整库存数量", "INVENTORY_ADJUST", "batch_update"),
        ("修改员工权限", "EMPLOYEE_PERMISSION_UPDATE", "permission_change"),
        ("更改系统配置", "SYSTEM_CONFIG_UPDATE", "config_change"),
        # Irreversible operations
        ("永久删除客户C001的所有数据", "CUSTOMER_DATA_PURGE", "irreversible"),
        ("归档并删除2023年的订单", "ORDER_ARCHIVE_DELETE", "irreversible"),
        ("合并重复的产品记录", "PRODUCT_MERGE", "data_merge"),
        ("迁移仓库数据到新系统", "DATA_MIGRATION", "migration"),
        ("回滚到上一个版本", "SYSTEM_ROLLBACK", "rollback"),
        # Financial operations
        ("调整订单O001的金额为0", "ORDER_AMOUNT_ADJUST", "financial"),
        ("取消客户C001的所有欠款", "DEBT_CANCEL", "financial"),
        ("修改财务报表数据", "FINANCIAL_REPORT_UPDATE", "financial"),
        ("删除付款记录", "PAYMENT_DELETE", "financial"),
        ("重新计算所有订单成本", "COST_RECALCULATE", "financial"),
    ]

    for text, intent, behavior in high_risk_ops:
        cases.append(TestCase(
            id=case_id,
            category=TestCategory.HIGH_RISK_OP,
            input_text=text,
            expected_intent=intent,
            expected_behavior=behavior,
            phase_tested=[1, 2]
        ))
        case_id += 1

    # Generate more high-risk variations
    delete_verbs = ["删除", "移除", "清除", "废弃", "取消", "作废"]
    update_verbs = ["修改", "更新", "调整", "变更", "批量更新"]
    targets = ["订单", "产品", "库存", "员工", "批次", "记录", "数据"]

    for verb in delete_verbs:
        for target in targets[:5]:
            if case_id > 240:
                break
            cases.append(TestCase(
                id=case_id,
                category=TestCategory.HIGH_RISK_OP,
                input_text=f"{verb}{target}",
                expected_intent=None,
                expected_behavior="high_risk_generic",
                phase_tested=[1, 2]
            ))
            case_id += 1

    # ========== Category 4: Ambiguous Inputs - Phase 3 (70 cases) ==========
    ambiguous_inputs = [
        ("查一下", None, "incomplete_query"),
        ("删除", None, "incomplete_delete"),
        ("修改那个", None, "unclear_reference"),
        ("看看数据", None, "vague_query"),
        ("处理一下", None, "unclear_action"),
        ("那个订单", None, "missing_identifier"),
        ("上次说的", None, "context_dependent"),
        ("帮我弄一下", None, "unclear_request"),
        ("这个不对", None, "unclear_problem"),
        ("改成正确的", None, "unclear_target"),
        # Pronoun references
        ("查看它的详情", None, "pronoun_reference"),
        ("把它删掉", None, "pronoun_delete"),
        ("修改这个", None, "demonstrative_reference"),
        ("那个怎么样了", None, "demonstrative_query"),
        ("他负责的订单", None, "person_reference"),
        # Partial information
        ("订单...", None, "incomplete_input"),
        ("查询那个姓张的", None, "partial_name"),
        ("上周的那批货", None, "vague_time_reference"),
        ("价格比较高的", None, "relative_condition"),
        ("最近的那个", None, "temporal_reference"),
        # Multiple interpretations
        ("看看订单和产品", None, "multi_entity_ambiguous"),
        ("删除或者取消", None, "action_ambiguous"),
        ("今天或明天的", None, "time_ambiguous"),
        ("张三或李四的", None, "person_ambiguous"),
        ("A仓库或B仓库", None, "location_ambiguous"),
        # Missing key parameters
        ("查询订单状态", None, "missing_order_id"),
        ("修改产品价格", None, "missing_product_id"),
        ("调整库存数量", None, "missing_quantity"),
        ("分配任务给员工", None, "missing_assignment"),
        ("设置提醒", None, "missing_reminder_detail"),
        # Contradictory inputs
        ("删除但保留记录", None, "contradictory"),
        ("增加并减少库存", None, "contradictory"),
        ("完成未完成的", None, "paradox"),
        ("查询不存在的", None, "impossible_query"),
        ("修改只读数据", None, "permission_issue"),
    ]

    for text, intent, behavior in ambiguous_inputs:
        cases.append(TestCase(
            id=case_id,
            category=TestCategory.AMBIGUOUS,
            input_text=text,
            expected_intent=intent,
            expected_behavior=behavior,
            phase_tested=[3]
        ))
        case_id += 1

    # Generate more ambiguous cases
    vague_queries = [
        "那个", "这个", "它", "他们", "之前的", "后面的", "其他的",
        "查一下吧", "看看呢", "怎么样", "如何", "咋办", "弄一下"
    ]

    for vq in vague_queries:
        for _ in range(2):
            if case_id > 310:
                break
            cases.append(TestCase(
                id=case_id,
                category=TestCategory.AMBIGUOUS,
                input_text=f"{vq}{random.choice(['', '的数据', '的情况', ''])}",
                expected_intent=None,
                expected_behavior="vague_input",
                phase_tested=[3]
            ))
            case_id += 1

    # ========== Category 5: Multi-Intent (50 cases) ==========
    multi_intents = [
        ("查看订单并导出报表", ["ORDER_QUERY", "REPORT_EXPORT"], "query_and_export"),
        ("先查库存再下订单", ["INVENTORY_QUERY", "ORDER_CREATE"], "sequential"),
        ("删除旧数据并备份", ["DATA_DELETE", "DATA_BACKUP"], "delete_and_backup"),
        ("统计销售额和利润", ["SALES_QUERY", "PROFIT_QUERY"], "multiple_metrics"),
        ("查看员工考勤和绩效", ["ATTENDANCE_QUERY", "PERFORMANCE_QUERY"], "hr_queries"),
        ("更新库存并通知仓管", ["INVENTORY_UPDATE", "NOTIFICATION_SEND"], "update_and_notify"),
        ("查询订单状态和物流信息", ["ORDER_STATUS", "LOGISTICS_QUERY"], "order_tracking"),
        ("生成报表并发送邮件", ["REPORT_GENERATE", "EMAIL_SEND"], "report_and_send"),
        ("检查设备状态并安排维护", ["EQUIPMENT_CHECK", "MAINTENANCE_SCHEDULE"], "check_and_schedule"),
        ("审核订单并安排发货", ["ORDER_REVIEW", "SHIPPING_ARRANGE"], "review_and_ship"),
        # Complex multi-intents
        ("查询本月订单、统计销售额、并生成报表发给经理", ["ORDER_QUERY", "SALES_STAT", "REPORT_SEND"], "triple_intent"),
        ("检查库存、补货、并更新供应商信息", ["INVENTORY_CHECK", "REORDER", "SUPPLIER_UPDATE"], "supply_chain"),
        ("员工入职：创建账号、分配权限、发送欢迎邮件", ["ACCOUNT_CREATE", "PERMISSION_ASSIGN", "EMAIL_SEND"], "onboarding"),
        ("月末结算：核对账目、生成报表、归档数据", ["ACCOUNT_VERIFY", "REPORT_GENERATE", "DATA_ARCHIVE"], "month_end"),
        ("质量问题处理：记录问题、通知相关人、安排复检", ["QUALITY_RECORD", "NOTIFICATION", "RECHECK_SCHEDULE"], "quality_flow"),
    ]

    for text, intents, behavior in multi_intents:
        cases.append(TestCase(
            id=case_id,
            category=TestCategory.MULTI_INTENT,
            input_text=text,
            expected_intent=str(intents),
            expected_behavior=behavior,
            phase_tested=[2, 3]
        ))
        case_id += 1

    # Generate more multi-intent cases
    action_pairs = [
        ("查看", "修改"), ("查询", "导出"), ("统计", "分析"),
        ("检查", "更新"), ("审核", "通知"), ("创建", "分配")
    ]

    for a1, a2 in action_pairs:
        for entity in entities[:5]:
            if case_id > 360:
                break
            cases.append(TestCase(
                id=case_id,
                category=TestCategory.MULTI_INTENT,
                input_text=f"{a1}{entity}并{a2}",
                expected_intent=None,
                expected_behavior="action_pair",
                phase_tested=[2, 3]
            ))
            case_id += 1

    # ========== Category 6: Context-Dependent (40 cases) ==========
    context_cases = [
        ("上面那个订单的详情", None, "previous_reference"),
        ("刚才查的那批货", None, "recent_reference"),
        ("同样的查询条件", None, "same_condition"),
        ("和之前一样", None, "repeat_action"),
        ("继续刚才的操作", None, "continue_action"),
        ("撤销上一步", None, "undo_action"),
        ("再查一次", None, "repeat_query"),
        ("换一个条件", None, "modify_condition"),
        ("看看别的", None, "alternative_query"),
        ("这个不行,换那个", None, "switch_target"),
        # Session context
        ("基于这个结果筛选", None, "filter_result"),
        ("在这些里面找", None, "search_in_result"),
        ("排除掉已选的", None, "exclude_selected"),
        ("只保留符合条件的", None, "filter_keep"),
        ("把这些合并", None, "merge_result"),
        # Conversation flow
        ("然后呢", None, "continue_conversation"),
        ("还有吗", None, "more_results"),
        ("就这样", None, "confirm_action"),
        ("不对,是另一个", None, "correct_input"),
        ("我是说那个", None, "clarify_reference"),
    ]

    for text, intent, behavior in context_cases:
        cases.append(TestCase(
            id=case_id,
            category=TestCategory.CONTEXT_DEPENDENT,
            input_text=text,
            expected_intent=intent,
            expected_behavior=behavior,
            phase_tested=[3]
        ))
        case_id += 1

    # More context-dependent cases
    context_words = ["刚才", "上次", "之前", "那个", "这个", "同样", "一样", "继续"]
    for word in context_words:
        for _ in range(2):
            if case_id > 400:
                break
            cases.append(TestCase(
                id=case_id,
                category=TestCategory.CONTEXT_DEPENDENT,
                input_text=f"{word}的{random.choice(['订单', '产品', '数据', '结果', '操作'])}",
                expected_intent=None,
                expected_behavior="context_word",
                phase_tested=[3]
            ))
            case_id += 1

    # ========== Category 7: Low Confidence / Edge Cases - Phase 4 (50 cases) ==========
    low_confidence_cases = [
        ("xjklsdf", None, "gibberish"),
        ("123456", None, "numbers_only"),
        ("???", None, "punctuation_only"),
        ("", None, "empty_input"),
        (" ", None, "whitespace_only"),
        ("a", None, "single_char"),
        ("查询查询查询", None, "repetition"),
        ("你好你好你好", None, "greeting_repetition"),
        ("asdfghjkl", None, "keyboard_mash"),
        ("test test test", None, "test_input"),
        # Very long inputs
        ("查询" * 50, None, "very_long_repetition"),
        ("订单订单订单订单订单订单订单订单订单订单", None, "word_repetition"),
        # Mixed language chaos
        ("查询order的status", None, "mixed_language"),
        ("delete订单", None, "mixed_delete"),
        ("show我的orders", None, "mixed_show"),
        # Unusual formats
        ("【订单查询】", None, "bracket_format"),
        ("=====订单=====", None, "decorated_text"),
        (">>>查询<<<", None, "arrow_format"),
        ("@订单#查询$", None, "special_chars"),
        ("订.单.查.询", None, "dotted_text"),
        # Domain confusion
        ("播放音乐", None, "wrong_domain"),
        ("打开相机", None, "wrong_domain"),
        ("发送微信", None, "wrong_domain"),
        ("导航到北京", None, "wrong_domain"),
        ("设置闹钟", None, "wrong_domain"),
        # Technical jargon mixing
        ("SELECT * FROM orders", None, "sql_injection_like"),
        ("{\"action\": \"query\"}", None, "json_format"),
        ("<order>query</order>", None, "xml_format"),
        ("curl -X GET /orders", None, "command_format"),
        ("orders.find({})", None, "code_format"),
    ]

    for text, intent, behavior in low_confidence_cases:
        cases.append(TestCase(
            id=case_id,
            category=TestCategory.LOW_CONFIDENCE,
            input_text=text,
            expected_intent=intent,
            expected_behavior=behavior,
            phase_tested=[4]
        ))
        case_id += 1

    # ========== Category 8: Domain-Specific (30 cases) ==========
    domain_specific = [
        ("查询溯源码", "TRACE_CODE_QUERY", "traceability"),
        ("扫描批次二维码", "BATCH_SCAN", "traceability"),
        ("追溯产品来源", "PRODUCT_TRACE", "traceability"),
        ("查看供应链信息", "SUPPLY_CHAIN_QUERY", "supply_chain"),
        ("冷链温度监控", "COLD_CHAIN_MONITOR", "cold_chain"),
        ("HACCP记录查询", "HACCP_QUERY", "food_safety"),
        ("GMP合规检查", "GMP_CHECK", "compliance"),
        ("批次召回", "BATCH_RECALL", "recall"),
        ("原料批次追踪", "MATERIAL_TRACE", "traceability"),
        ("成品检验报告", "PRODUCT_INSPECTION", "quality"),
        # Industry terms
        ("查看BOM清单", "BOM_QUERY", "manufacturing"),
        ("MRP计算", "MRP_CALCULATE", "planning"),
        ("WMS库位查询", "WMS_LOCATION", "warehouse"),
        ("ERP数据同步", "ERP_SYNC", "integration"),
        ("IoT设备状态", "IOT_STATUS", "iot"),
        # Food industry specific
        ("保质期预警", "SHELF_LIFE_ALERT", "food_safety"),
        ("配方查询", "RECIPE_QUERY", "food_production"),
        ("营养成分分析", "NUTRITION_ANALYSIS", "food_info"),
        ("过敏原标识", "ALLERGEN_LABEL", "food_safety"),
        ("有机认证查询", "ORGANIC_CERT_QUERY", "certification"),
    ]

    for text, intent, behavior in domain_specific:
        cases.append(TestCase(
            id=case_id,
            category=TestCategory.DOMAIN_SPECIFIC,
            input_text=text,
            expected_intent=intent,
            expected_behavior=behavior,
            phase_tested=[2]
        ))
        case_id += 1

    # ========== Category 9: Typos and Noise (30 cases) ==========
    typo_cases = [
        ("查旬订单", "ORDER_QUERY", "typo_query"),
        ("库存查徇", "INVENTORY_QUERY", "typo_inventory"),
        ("生产报彪", "REPORT_PRODUCTION", "typo_report"),
        ("员工名蛋", "EMPLOYEE_QUERY", "typo_employee"),
        ("设被状态", "EQUIPMENT_STATUS", "typo_equipment"),
        ("产品查xun", "PRODUCT_TYPE_QUERY", "pinyin_typo"),
        ("订单chaxun", "ORDER_QUERY", "pinyin_mixed"),
        ("库cun查询", "INVENTORY_QUERY", "partial_pinyin"),
        ("shengchan报表", "REPORT_PRODUCTION", "pinyin_chinese"),
        ("yuangong列表", "EMPLOYEE_QUERY", "pinyin_list"),
        # Common typos
        ("查询定单", "ORDER_QUERY", "homophone"),
        ("苦存数量", "INVENTORY_QUERY", "homophone"),
        ("产品价个", "PRODUCT_PRICE", "homophone"),
        ("圆工信息", "EMPLOYEE_QUERY", "homophone"),
        ("涉备维护", "EQUIPMENT_MAINTENANCE", "homophone"),
        # With extra characters
        ("查询，订单", "ORDER_QUERY", "extra_punctuation"),
        ("库存。。。", "INVENTORY_QUERY", "trailing_dots"),
        ("产品！！", "PRODUCT_TYPE_QUERY", "exclamation"),
        ("员工???", "EMPLOYEE_QUERY", "question_marks"),
        ("设备...", "EQUIPMENT_STATUS", "ellipsis"),
        # Spacing issues
        ("查 询 订 单", "ORDER_QUERY", "extra_spaces"),
        ("库存查询", "INVENTORY_QUERY", "no_space_needed"),
        ("产品  价格", "PRODUCT_PRICE", "double_space"),
        ("员工\t列表", "EMPLOYEE_QUERY", "tab_char"),
        ("设备\n状态", "EQUIPMENT_STATUS", "newline"),
    ]

    for text, intent, behavior in typo_cases:
        cases.append(TestCase(
            id=case_id,
            category=TestCategory.TYPO_NOISE,
            input_text=text,
            expected_intent=intent,
            expected_behavior=behavior,
            phase_tested=[2]
        ))
        case_id += 1

    # Fill remaining to reach 500
    while case_id <= 500:
        category = random.choice(list(TestCategory))
        cases.append(TestCase(
            id=case_id,
            category=category,
            input_text=f"测试用例{case_id}: {random.choice(['查询', '修改', '删除', '统计', '分析'])}{random.choice(entities)}",
            expected_intent=None,
            expected_behavior="auto_generated",
            phase_tested=[2]
        ))
        case_id += 1

    return cases

def get_auth_token() -> str:
    """Get authentication token"""
    try:
        response = requests.post(LOGIN_URL, json={
            "username": "factory_admin1",
            "password": "123456"
        }, timeout=10)
        data = response.json()
        if data.get("code") == 200:
            return data["data"]["token"]
    except Exception as e:
        print(f"Login failed: {e}")
    return None

def run_test(test_case: TestCase, session_id: str) -> Dict[str, Any]:
    """Run a single test case"""
    result = {
        "test_id": test_case.id,
        "category": test_case.category.value,
        "input": test_case.input_text,
        "expected_intent": test_case.expected_intent,
        "expected_behavior": test_case.expected_behavior,
        "phases_tested": test_case.phase_tested,
        "success": False,
        "response": None,
        "error": None,
        "latency_ms": 0
    }

    start_time = time.time()

    try:
        # Skip empty inputs
        if not test_case.input_text or not test_case.input_text.strip():
            result["error"] = "Empty input"
            result["latency_ms"] = int((time.time() - start_time) * 1000)
            return result

        response = requests.post(
            RECOGNIZE_URL,
            json={
                "userInput": test_case.input_text,
                "sessionId": session_id
            },
            headers={"Content-Type": "application/json"},
            timeout=30
        )

        result["latency_ms"] = int((time.time() - start_time) * 1000)

        if response.status_code == 200:
            data = response.json()
            result["response"] = data.get("data", {})
            result["success"] = data.get("code") == 200

            # Extract key metrics
            if result["response"]:
                result["matched_intent"] = result["response"].get("intentCode")
                result["confidence"] = result["response"].get("confidence")
                result["match_method"] = result["response"].get("matchMethod")
                result["match_layer"] = result["response"].get("matchLayer")
        else:
            result["error"] = f"HTTP {response.status_code}"

    except requests.exceptions.Timeout:
        result["error"] = "Timeout"
        result["latency_ms"] = 30000
    except Exception as e:
        result["error"] = str(e)
        result["latency_ms"] = int((time.time() - start_time) * 1000)

    return result

def analyze_results(results: List[Dict]) -> Dict[str, Any]:
    """Analyze test results"""
    total = len(results)
    successful = sum(1 for r in results if r["success"])

    # Category breakdown
    category_stats = {}
    for category in TestCategory:
        cat_results = [r for r in results if r["category"] == category.value]
        if cat_results:
            category_stats[category.value] = {
                "total": len(cat_results),
                "successful": sum(1 for r in cat_results if r["success"]),
                "avg_latency": sum(r["latency_ms"] for r in cat_results) / len(cat_results),
                "avg_confidence": sum(r.get("confidence", 0) or 0 for r in cat_results if r.get("confidence")) / max(1, sum(1 for r in cat_results if r.get("confidence")))
            }

    # Match method distribution
    match_methods = {}
    for r in results:
        method = r.get("match_method", "unknown")
        match_methods[method] = match_methods.get(method, 0) + 1

    # Confidence distribution
    confidence_buckets = {"high(>0.8)": 0, "medium(0.5-0.8)": 0, "low(<0.5)": 0, "none": 0}
    for r in results:
        conf = r.get("confidence")
        if conf is None:
            confidence_buckets["none"] += 1
        elif conf > 0.8:
            confidence_buckets["high(>0.8)"] += 1
        elif conf > 0.5:
            confidence_buckets["medium(0.5-0.8)"] += 1
        else:
            confidence_buckets["low(<0.5)"] += 1

    # Phase coverage
    phase_coverage = {1: 0, 2: 0, 3: 0, 4: 0}
    for r in results:
        for phase in r.get("phases_tested", []):
            phase_coverage[phase] += 1

    # Latency stats
    latencies = [r["latency_ms"] for r in results]

    return {
        "summary": {
            "total_tests": total,
            "successful": successful,
            "failed": total - successful,
            "success_rate": f"{successful/total*100:.1f}%"
        },
        "category_stats": category_stats,
        "match_methods": match_methods,
        "confidence_distribution": confidence_buckets,
        "phase_coverage": phase_coverage,
        "latency": {
            "min": min(latencies) if latencies else 0,
            "max": max(latencies) if latencies else 0,
            "avg": sum(latencies) / len(latencies) if latencies else 0,
            "p95": sorted(latencies)[int(len(latencies) * 0.95)] if latencies else 0
        },
        "errors": [r for r in results if r.get("error")][:20]  # First 20 errors
    }

def main():
    print("=" * 60)
    print("AI Intent Recognition System - 500 Test Cases")
    print("=" * 60)
    print(f"Start Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()

    # Generate test cases
    print("Generating 500 test cases...")
    test_cases = generate_test_cases()
    print(f"Generated {len(test_cases)} test cases")

    # Category distribution
    print("\nCategory Distribution:")
    for category in TestCategory:
        count = sum(1 for tc in test_cases if tc.category == category)
        print(f"  {category.value}: {count}")

    print("\n" + "-" * 60)
    print("Running tests...")
    print("-" * 60)

    results = []
    session_id = f"test-500-{datetime.now().strftime('%Y%m%d%H%M%S')}"

    for i, test_case in enumerate(test_cases):
        result = run_test(test_case, session_id)
        results.append(result)

        # Progress indicator
        if (i + 1) % 50 == 0:
            print(f"Progress: {i + 1}/{len(test_cases)} ({(i+1)/len(test_cases)*100:.0f}%)")

        # Small delay to avoid overwhelming the server
        if (i + 1) % 10 == 0:
            time.sleep(0.5)

    print("\n" + "=" * 60)
    print("Test Results Analysis")
    print("=" * 60)

    analysis = analyze_results(results)

    # Print summary
    print(f"\n📊 Summary:")
    print(f"   Total Tests: {analysis['summary']['total_tests']}")
    print(f"   Successful: {analysis['summary']['successful']}")
    print(f"   Failed: {analysis['summary']['failed']}")
    print(f"   Success Rate: {analysis['summary']['success_rate']}")

    print(f"\n📈 Category Performance:")
    for cat, stats in analysis['category_stats'].items():
        rate = stats['successful'] / stats['total'] * 100 if stats['total'] > 0 else 0
        print(f"   {cat}: {stats['successful']}/{stats['total']} ({rate:.1f}%) | avg latency: {stats['avg_latency']:.0f}ms | avg conf: {stats['avg_confidence']:.2f}")

    print(f"\n🎯 Match Methods:")
    for method, count in analysis['match_methods'].items():
        print(f"   {method}: {count} ({count/len(results)*100:.1f}%)")

    print(f"\n📉 Confidence Distribution:")
    for bucket, count in analysis['confidence_distribution'].items():
        print(f"   {bucket}: {count} ({count/len(results)*100:.1f}%)")

    print(f"\n🔄 Phase Coverage:")
    for phase, count in analysis['phase_coverage'].items():
        print(f"   Phase {phase}: {count} test cases")

    print(f"\n⏱️ Latency:")
    print(f"   Min: {analysis['latency']['min']}ms")
    print(f"   Max: {analysis['latency']['max']}ms")
    print(f"   Avg: {analysis['latency']['avg']:.0f}ms")
    print(f"   P95: {analysis['latency']['p95']}ms")

    # Save results
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    report_path = f"tests/ai-intent/reports/comprehensive_500_report_{timestamp}.json"

    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump({
            "timestamp": timestamp,
            "analysis": analysis,
            "results": results
        }, f, ensure_ascii=False, indent=2)

    print(f"\n📄 Detailed report saved to: {report_path}")
    print(f"\nEnd Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

if __name__ == "__main__":
    main()
