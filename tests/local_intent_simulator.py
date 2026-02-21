#!/usr/bin/env python3
"""
本地意图识别模拟器 - 从 IntentKnowledgeBase.java 解析短语映射并测试
模拟 Java 端的第0层(预处理) + 第1层(短语精确匹配) 逻辑
后续层 (BERT/LLM) 不在本地模拟范围，用"FALLBACK"标记
"""
import re
import sys
from pathlib import Path

# ============================================================
# 1. 解析 Java 文件中的短语映射
# ============================================================
JAVA_FILE = Path(__file__).parent.parent / "archive/backup-v21/IntentKnowledgeBase.java"

def parse_phrase_mappings(java_file: Path) -> dict:
    """从 Java 源码提取 phraseToIntentMapping.put(key, value) 映射"""
    pattern = re.compile(r'phraseToIntentMapping\.put\("([^"]+)",\s*"([^"]+)"\)')
    mappings = {}
    with open(java_file, encoding='utf-8') as f:
        for line in f:
            m = pattern.search(line)
            if m:
                phrase, intent = m.group(1), m.group(2)
                # LinkedHashMap 后写覆盖，所以直接覆盖
                mappings[phrase] = intent
    return mappings

# ============================================================
# 2. 预处理规则（模拟 Java 预处理层）
# ============================================================
STOP_WORDS = {"的", "了", "吗", "呢", "啊", "吧", "呀", "嘛", "嗯", "哦",
              "把", "我", "你", "他", "她", "它", "给", "让", "被", "对",
              "从", "到", "为", "以", "等", "也", "就", "都", "还", "很",
              "太", "好", "一下", "一个", "那个"}

ORAL_NORMALIZE = {
    "查下": "查询", "查一下": "查询", "查查": "查询", "查": "查询",
    "看看": "查看", "看一下": "查看", "瞅瞅": "查看", "瞧瞧": "查看",
    "瞅一眼": "查看", "看一眼": "查看",
    "帮我查": "查询", "帮查": "查询", "帮我看": "查看",
}

DELETE_WORDS = {"删除", "移除", "清除", "清空", "作废", "去掉", "销毁", "注销", "撤销"}
CREATE_WORDS = {"创建", "新建", "添加", "新增", "录入", "登记", "建立", "生成", "开一个", "开个"}
QUERY_WORDS  = {"查询", "查看", "查", "看", "显示", "列出", "获取", "搜索", "查找", "浏览"}
UPDATE_WORDS = {"修改", "更新", "编辑", "变更", "更改", "修订", "调整", "设置"}

# 业务白名单（包含这些词不触发澄清）
BUSINESS_KEYWORDS = {
    "删除", "移除", "取消", "作废", "清空", "注销",
    "创建", "新建", "添加", "录入", "获取", "显示", "查询",
    "修改", "更新", "编辑", "变更", "调整",
    "撤销", "废弃", "清理", "批量",
    "打卡", "签到", "签退", "上班", "下班", "到岗",
    "订单", "库存", "考勤", "设备", "质检", "生产", "发货", "客户", "供应商",
    "物料", "原料", "批次", "追溯", "告警", "预警", "温度", "冷链",
    "用户", "账号", "员工", "工时", "绩效", "排班", "班次",
    "出库", "入库", "采购", "销售", "盘点", "成品",
    "产品", "仓库", "配置", "价格", "参数", "进度", "周期",
    "报表", "季度", "年度", "月份",
    "FIFO", "BOM", "SOP", "OEE", "WMS", "TMS", "ERP",
    "先进先出", "物料清单", "标准作业", "设备效率",
    "设备", "批次", "追溯", "溯源", "告警", "质检",
}

VAGUE_BLACKLIST = {
    "查一下", "看看", "看一下", "瞧瞧", "瞅瞅",
    "帮我处理", "处理一下", "处理下",
    "帮我查", "帮查", "查下", "看下",
    "有啥问题", "问题",
    "这个", "那个", "哪个",
    "数据", "报表", "统计", "分析",
    "好的", "可以", "行", "好", "嗯",
    # v12.4: 补充口语澄清词
    "弄一下", "弄下", "整一下", "整下", "搞一下", "搞下",
    "弄弄", "整整", "弄好", "整好",
    "那边", "那边怎么样", "这边", "这边怎么样",
    "随便", "都行", "无所谓",
}

def preprocess(text: str) -> str:
    """简单预处理"""
    t = text.strip()
    # 口语标准化
    for k, v in ORAL_NORMALIZE.items():
        t = t.replace(k, v)
    return t

def is_vague(text: str) -> bool:
    """检测极度模糊输入"""
    normalized = text.strip().lower()
    # 长度<=2且无业务关键词
    if len(normalized) <= 2:
        if not any(kw.lower() in normalized for kw in BUSINESS_KEYWORDS):
            return True
    # 精确匹配黑名单
    if normalized in VAGUE_BLACKLIST:
        if not any(kw.lower() in normalized for kw in BUSINESS_KEYWORDS):
            return True
    return False

def detect_action(text: str) -> str:
    """检测动作类型"""
    for w in DELETE_WORDS:
        if w in text: return "DELETE"
    for w in CREATE_WORDS:
        if w in text: return "CREATE"
    for w in UPDATE_WORDS:
        if w in text: return "UPDATE"
    for w in QUERY_WORDS:
        if w in text: return "QUERY"
    return "UNKNOWN"

# ============================================================
# 3. 领域关键词（从 Java 移植，ORDER 域已加入）
# ============================================================
DOMAIN_KEYWORDS = {
    "ORDER":     ["订单", "订货", "下单", "接单", "订购", "采购单", "销售单", "单子"],
    "SHIPMENT":  ["发货", "出货", "配送", "物流", "运输", "快递", "出库", "溯源", "追溯", "追踪"],
    "MATERIAL":  ["原料", "物料", "材料", "原材料", "辅料", "配料", "成分"],
    "PROCESSING":["生产", "加工", "批次", "工序", "工艺", "产量", "产出", "投产"],
    "QUALITY":   ["质检", "质量", "检验", "检测", "品控", "合格", "不合格", "抽检"],
    "EQUIPMENT": ["设备", "机器", "机台", "产线", "生产线", "设备状态", "设备运行"],
    "ALERT":     ["告警", "报警", "预警", "异常", "故障", "警报", "警告"],
    "CUSTOMER":  ["客户", "顾客", "买家", "采购方", "甲方"],
    "INVENTORY": ["库存", "存货", "储存", "仓库", "入库", "库位"],
    "REPORT":    ["报表", "报告", "统计", "汇总", "分析", "数据"],
    "USER":      ["用户", "员工", "工人", "操作员", "管理员", "人员"],
    "SCALE":     ["电子秤", "秤", "称重", "重量"],
}

def detect_domain(text: str) -> str:
    scores = {}
    for domain, keywords in DOMAIN_KEYWORDS.items():
        score = sum(len(kw) for kw in keywords if kw in text)
        if score > 0:
            scores[domain] = score
    if not scores:
        return "GENERAL"
    return max(scores, key=scores.get)

# ============================================================
# 4. 主匹配逻辑
# ============================================================
# ActionType → 意图族修正表 (模拟 Java correctIntentByActionType)
INTENT_FAMILIES = {
    "ORDER":          {  "QUERY": "ORDER_LIST",            "DELETE": "ORDER_DELETE",    "UPDATE": "ORDER_UPDATE" },
    "MATERIAL_BATCH": {  "CREATE": "MATERIAL_BATCH_CREATE", "QUERY":  "MATERIAL_BATCH_QUERY", "DELETE": "MATERIAL_BATCH_DELETE" },
    "SHIPMENT":       {  "CREATE": "SHIPMENT_CREATE",       "QUERY":  "SHIPMENT_QUERY",  "DELETE": "SHIPMENT_DELETE" },
    "PROCESSING_BATCH":{ "CREATE": "PROCESSING_BATCH_CREATE","QUERY": "PROCESSING_BATCH_LIST","DELETE":"PROCESSING_BATCH_CANCEL","START":"PROCESSING_BATCH_START" },
    "USER":           {  "CREATE": "USER_CREATE",           "QUERY":  "USER_QUERY",      "DELETE": "USER_DELETE" },
    "CUSTOMER":       {  "QUERY":  "CUSTOMER_LIST",         "DELETE": "CUSTOMER_DELETE" },
    "SUPPLIER":       {  "QUERY":  "SUPPLIER_QUERY",        "DELETE": "SUPPLIER_DELETE" },
    "EQUIPMENT":      {  "QUERY":  "EQUIPMENT_STATUS_QUERY","DELETE": "EQUIPMENT_DELETE" },
    "ALERT":          {  "QUERY":  "ALERT_LIST",            "DELETE": "ALERT_RESOLVE" },
}

ACTION_SUFFIXES = ["_CREATE","_QUERY","_UPDATE","_DELETE","_EXECUTE","_LIST",
                   "_DETAIL","_SEARCH","_START","_PAUSE","_RESUME","_COMPLETE","_CANCEL","_STATS"]

def extract_intent_family(intent: str) -> str | None:
    u = intent.upper()
    for suf in ACTION_SUFFIXES:
        if u.endswith(suf):
            return u[:-len(suf)]
    return None

def correct_by_action(intent: str, action: str) -> str:
    """ActionType 感知修正（模拟 Java v17.0 correctIntentByActionType）"""
    if action in ("UNKNOWN", "AMBIGUOUS"):
        return intent
    family = extract_intent_family(intent)
    if family and family in INTENT_FAMILIES:
        corrected = INTENT_FAMILIES[family].get(action)
        if corrected and corrected != intent:
            return corrected
    return intent

def match_intent(text: str, phrase_map: dict) -> dict:
    """
    返回 {'intent': str, 'method': str, 'confidence': float}
    method: PHRASE_MATCH / VAGUE / FALLBACK
    """
    # Step 0: 极度模糊检测
    if is_vague(text):
        return {"intent": "CLARIFICATION", "method": "VAGUE", "confidence": 0.0}

    # 先检测 ActionType（用于后续修正）
    action = detect_action(text)

    # Step 1a: 原始输入精确匹配
    if text in phrase_map:
        intent = phrase_map[text]
        corrected = correct_by_action(intent, action)
        method = "PHRASE_MATCH" if corrected == intent else f"PHRASE_MATCH+ACTION({action})"
        return {"intent": corrected, "method": method, "confidence": 0.98}

    # Step 1b: 预处理后精确匹配
    processed = preprocess(text)
    if processed != text and processed in phrase_map:
        intent = phrase_map[processed]
        corrected = correct_by_action(intent, action)
        method = "PHRASE_MATCH(pre)" if corrected == intent else f"PHRASE_MATCH(pre)+ACTION({action})"
        return {"intent": corrected, "method": method, "confidence": 0.95}

    # Step 1c: 包含匹配（按短语长度降序，最长优先 → 更精确的短语优先命中）
    sorted_phrases = sorted(phrase_map.keys(), key=len, reverse=True)
    for phrase in sorted_phrases:
        if len(phrase) >= 3 and phrase in text:
            intent = phrase_map[phrase]
            corrected = correct_by_action(intent, action)
            method = f"PHRASE_CONTAINS({phrase})" if corrected == intent else f"CONTAINS({phrase})+ACTION({action})"
            return {"intent": corrected, "method": method, "confidence": 0.85}

    # Step 1d: 预处理后包含匹配
    if processed != text:
        for phrase in sorted_phrases:
            if len(phrase) >= 3 and phrase in processed:
                intent = phrase_map[phrase]
                corrected = correct_by_action(intent, action)
                method = f"PHRASE_CONTAINS_PRE({phrase})" if corrected == intent else f"CONTAINS_PRE({phrase})+ACTION"
                return {"intent": corrected, "method": method, "confidence": 0.82}

    # 未匹配 → 需要 BERT/LLM
    return {"intent": "FALLBACK", "method": "FALLBACK", "confidence": 0.0}

# ============================================================
# 5. 测试用例（从 intent-routing-e2e-150.py 提取）
# ============================================================
TEST_CASES = [
    # (input, expected_type, expected_intents_pipe_sep, description)

    # ===== A: 咨询（知识类，短语层不应命中任何业务意图，FALLBACK给LLM/知识库）=====
    # 这些用例期望 FALLBACK → 由 LLM/知识库层处理，短语匹配命中业务意图反而是错误
    ("猪肉的保质期是多久",      "CONSULT", "FOOD_KNOWLEDGE_QUERY",  "A1-保质期知识"),
    ("牛肉加工有什么标准",      "CONSULT", "FOOD_KNOWLEDGE_QUERY",  "A1-加工标准"),
    ("沙门氏菌怎么预防",        "CONSULT", "FOOD_KNOWLEDGE_QUERY",  "A2-沙门氏菌"),
    ("火腿肠生产工艺流程",      "CONSULT", "FOOD_KNOWLEDGE_QUERY",  "A3-工艺流程"),

    # ===== B3: 查询-订单 =====
    ("查看所有订单",     "QUERY", "ORDER_LIST",                     "B3-订单列表"),
    ("逾期未完成的订单", "QUERY", "ORDER_LIST|ORDER_TIMEOUT_MONITOR", "B3-逾期订单"),
    ("未发货的订单有哪些","QUERY","ORDER_LIST",                     "B3-未发货订单"),
    ("已发货但未签收的订单","QUERY","ORDER_LIST",                   "B3-未签收"),
    ("有没有逾期的",    "QUERY", "ORDER_LIST|ORDER_TIMEOUT_MONITOR", "B3-口语逾期"),
    ("发了多少货",      "QUERY", "ORDER_LIST|SHIPMENT_STATS|SHIPMENT_QUERY", "B3-口语发货"),  # 发货统计，两者均合理
    ("有啥新订单",      "QUERY", "ORDER_LIST",                     "B3-新订单"),
    ("本月采购订单总额", "QUERY", "PROCUREMENT_LIST|PROCUREMENT_STATS|ORDER_LIST|REPORT_KPI", "B3-采购总额"),
    # D2: 查询vs写入
    ("查看订单",        "QUERY", "ORDER_LIST",                     "D2-查看订单"),
    ("修改订单状态",    "WRITE", "ORDER_UPDATE|ORDER_MODIFY",       "D2-修改订单"),
    # D3: 口语化/极短
    ("订单",           "QUERY", "ORDER_LIST",                     "D3-单词订单"),
    ("看看订单",       "QUERY", "ORDER_LIST",                     "D3-看看订单"),
    # D5: 深层混淆
    ("订单取消",       "WRITE", "ORDER_UPDATE|ORDER_DELETE|ORDER_MODIFY|ORDER_CANCEL", "D5-订单取消"),
    # F2: 删除/取消
    ("删除这个订单",   "WRITE", "ORDER_DELETE",                   "F2-删除订单"),
    ("取消这个生产批次","WRITE","PROCESSING_BATCH_CANCEL|PROCESSING_BATCH_PAUSE", "F2-取消批次"),
    ("删除发货单",     "WRITE", "SHIPMENT_DELETE|ORDER_DELETE",    "F2-删除发货"),
    # G1: 时间限定
    ("上周的订单",     "QUERY", "ORDER_LIST",                     "G1-上周订单"),
    # H4: HR操作
    ("删除员工李四",   "WRITE", "HR_DELETE_EMPLOYEE|USER_DELETE|PROCESSING_WORKER_ASSIGN", "H4-删员工"),
    # F2+ 高风险
    ("删除用户",       "WRITE", "USER_DELETE",                    "高风险-删用户"),
    ("删除设备",       "WRITE", "EQUIPMENT_DELETE|SCALE_DELETE_DEVICE", "高风险-删设备"),
    ("删除客户",       "WRITE", "CUSTOMER_DELETE",                "高风险-删客户"),
    ("删除供应商",     "WRITE", "SUPPLIER_DELETE",                "高风险-删供应商"),
    ("删除批次",       "WRITE", "MATERIAL_BATCH_DELETE|PROCESSING_BATCH_CANCEL", "高风险-删批次"),
    # 冷链
    ("三号冷库温度记录","QUERY","COLD_CHAIN_TEMPERATURE",          "B6-冷库温度"),
    ("冷链断链",       "QUERY", "COLD_CHAIN_TEMPERATURE|ALERT_LIST","E4-冷链断链"),
    # 查询类核心
    ("仓库猪肉库存有多少","QUERY","REPORT_INVENTORY|MATERIAL_BATCH_QUERY","B1-库存查询"),
    ("查看今天的生产批次","QUERY","PROCESSING_BATCH_LIST",         "B2-今日批次"),
    ("查看考勤记录",   "QUERY", "ATTENDANCE_HISTORY|ATTENDANCE_RECORD","B5-考勤记录"),
    ("设备运行状态",   "QUERY", "EQUIPMENT_STATUS_QUERY",         "B6-设备状态"),
    # 写入类核心
    ("创建一个新的牛肉批次","WRITE","PROCESSING_BATCH_CREATE",     "C1-创建批次"),
    ("帮我打卡",       "WRITE", "CLOCK_IN",                       "C2-打卡"),
    ("我要签到",       "WRITE", "CLOCK_IN",                       "C2-签到"),
    ("上班打卡",       "WRITE", "CLOCK_IN",                       "C2-上班打卡"),
    # 歧义
    ("查看订单",       "QUERY", "ORDER_LIST",                     "歧义-查看订单"),
    ("订单发货了吗",   "QUERY", "ORDER_STATUS",                   "歧义-订单发货状态"),
    ("今天的订单",     "QUERY", "ORDER_TODAY",                    "口语-今日订单"),
    ("订单状态",       "QUERY", "ORDER_STATUS",                   "直接-订单状态"),
    # 澄清
    ("查一下",         "VAGUE", "CLARIFICATION",                  "澄清-查一下"),
    ("看看",           "VAGUE", "CLARIFICATION",                  "澄清-看看"),
    ("帮我处理",       "VAGUE", "CLARIFICATION",                  "澄清-帮我处理"),
    ("这个",           "VAGUE", "CLARIFICATION",                  "澄清-这个"),

    # ===== B1: 查询-仓库/库存 =====
    ("仓库猪肉库存有多少",       "QUERY", "REPORT_INVENTORY|MATERIAL_BATCH_QUERY", "B1-库存查询"),
    ("今天入库了多少鸡肉",       "QUERY", "MATERIAL_BATCH_QUERY|INBOUND_RECORD_QUERY", "B1-入库查询"),
    ("牛肉批次还有多少库存",     "QUERY", "MATERIAL_BATCH_QUERY",           "B1-批次库存"),
    ("本月入库总量是多少",       "QUERY", "MATERIAL_BATCH_QUERY|REPORT_INVENTORY","B1-入库统计"),
    ("猪肉还有没有",            "QUERY", "MATERIAL_BATCH_QUERY|REPORT_INVENTORY","B1-口语库存"),

    # ===== B2: 查询-生产 =====
    ("查看今天的生产批次",       "QUERY", "PROCESSING_BATCH_LIST",          "B2-今日批次"),
    ("月度生产报表",            "QUERY", "REPORT_PRODUCTION",              "B2-生产报表"),
    ("已完成的生产批次",         "QUERY", "PROCESSING_BATCH_LIST",          "B2-完成批次"),

    # ===== B4: 查询-质检 =====
    ("最近的质检报告",           "QUERY", "QUALITY_CHECK_QUERY|QUALITY_BATCH_REPORT","B4-质检报告"),
    ("不合格产品清单",           "QUERY", "QUALITY_CHECK_QUERY",            "B4-不合格清单"),
    ("质检咋样了",              "QUERY", "QUALITY_CHECK_QUERY",            "B4-口语质检"),

    # ===== B5: 考勤/HR =====
    ("查看考勤记录",            "QUERY", "ATTENDANCE_HISTORY|ATTENDANCE_RECORD","B5-考勤记录"),
    ("今天出勤率多少",           "QUERY", "ATTENDANCE_STATS|ATTENDANCE_TODAY","B5-出勤率"),

    # ===== B6: 设备 =====
    ("设备运行状态",            "QUERY", "EQUIPMENT_STATUS_QUERY",         "B6-设备状态"),
    ("三号冷库温度记录",         "QUERY", "COLD_CHAIN_TEMPERATURE",          "B6-冷库温度"),
    ("本周设备报警记录",         "QUERY", "ALERT_LIST|EQUIPMENT_ALERT_LIST", "B6-设备报警"),

    # ===== C1: 写入-创建 =====
    ("创建一个新的牛肉批次",     "WRITE", "PROCESSING_BATCH_CREATE",        "C1-创建批次"),
    ("新建一条猪肉的入库记录",   "WRITE", "MATERIAL_BATCH_CREATE",          "C1-新建入库"),
    ("添加一个新的生产批次",     "WRITE", "PROCESSING_BATCH_CREATE",        "C1-添加批次"),
    ("录入今天的鸡肉入库信息",   "WRITE", "MATERIAL_BATCH_CREATE",          "C1-录入入库"),
    ("帮我创建一个订单",         "WRITE", "ORDER_CREATE|ORDER_NEW",          "C1-创建订单"),
    ("新增一条物料入库记录",     "WRITE", "MATERIAL_BATCH_CREATE",          "C1-新增入库"),
    ("登记一批新的原材料",       "WRITE", "MATERIAL_BATCH_CREATE",          "C1-登记原料"),

    # ===== C2: 打卡 =====
    ("帮我打卡",               "WRITE", "CLOCK_IN",                       "C2-打卡"),
    ("我要签到",               "WRITE", "CLOCK_IN",                       "C2-签到"),
    ("上班打卡",               "WRITE", "CLOCK_IN",                       "C2-上班打卡"),
    ("下班签退",               "WRITE", "CLOCK_IN|CLOCK_OUT",             "C2-签退"),

    # ===== D2: 查询vs写入 =====
    ("查看生产批次",            "QUERY", "PROCESSING_BATCH_LIST",          "D2-查看=查询"),
    ("创建生产批次",            "WRITE", "PROCESSING_BATCH_CREATE",        "D2-创建=写入"),
    ("查询库存",               "QUERY", "MATERIAL_BATCH_QUERY|REPORT_INVENTORY","D2-查询库存"),

    # ===== D3: 极短口语 =====
    ("订单",                  "QUERY", "ORDER_LIST",                     "D3-单词订单"),
    ("质检",                  "QUERY", "QUALITY_CHECK_QUERY",            "D3-单词质检"),
    ("库存",                  "QUERY", "MATERIAL_BATCH_QUERY|REPORT_INVENTORY","D3-单词库存"),
    ("看看订单",               "QUERY", "ORDER_LIST",                     "D3-口语订单"),
    ("打卡",                  "WRITE", "CLOCK_IN",                       "D3-口语打卡"),
    ("查一下设备",             "QUERY", "EQUIPMENT_STATUS_QUERY|EQUIPMENT_LIST","D3-查一下设备"),

    # ===== D5: 深层混淆 =====
    ("订单取消",               "WRITE", "ORDER_UPDATE|ORDER_DELETE|ORDER_MODIFY|ORDER_CANCEL","D5-订单取消"),
    ("查看库存不足的原材料",    "QUERY", "MATERIAL_BATCH_QUERY|MATERIAL_LOW_STOCK_ALERT|REPORT_INVENTORY","D5-库存不足"),
    ("暂停生产线",             "WRITE", "PROCESSING_BATCH_PAUSE|EQUIPMENT_STATUS_QUERY","D5-暂停=写入"),
    ("确认发货",               "WRITE", "SHIPMENT_CREATE|ORDER_UPDATE|SHIPMENT_STATUS_UPDATE",   "D5-确认发货"),

    # ===== E系列: 供应商/发货/报表/告警 =====
    ("供应商列表",             "QUERY", "SUPPLIER_LIST|SUPPLIER_SEARCH",  "E1-供应商列表"),
    ("最近的发货记录",          "QUERY", "SHIPMENT_QUERY|SHIPMENT_STATS|ORDER_LIST","E2-发货记录"),
    ("今日工厂总览",           "QUERY", "REPORT_DASHBOARD_OVERVIEW|REPORT_KPI","E3-总览"),
    ("当前有哪些告警",          "QUERY", "ALERT_LIST|ALERT_ACTIVE|EQUIPMENT_ALERT_LIST","E4-告警列表"),
    ("快过期的原材料",          "QUERY", "MATERIAL_EXPIRING_ALERT|MATERIAL_EXPIRED_QUERY","E4-过期预警"),
    ("冷库温度告警",           "QUERY", "COLD_CHAIN_TEMPERATURE|ALERT_LIST","E4-温度告警"),
    ("客户列表",               "QUERY", "CUSTOMER_LIST|CUSTOMER_SEARCH",  "E7-客户列表"),

    # ===== F系列: 写入操作 =====
    ("删除这个订单",           "WRITE", "ORDER_DELETE",                   "F2-删除订单"),
    ("取消这个生产批次",        "WRITE", "PROCESSING_BATCH_CANCEL|PROCESSING_BATCH_PAUSE","F2-取消批次"),
    ("删除发货单",             "WRITE", "SHIPMENT_DELETE|ORDER_DELETE",   "F2-删除发货"),
    ("确认告警",               "WRITE", "ALERT_ACKNOWLEDGE",              "F3-确认告警"),
    ("解决这个告警",           "WRITE", "ALERT_RESOLVE|ALERT_ACKNOWLEDGE","F3-解决告警"),
    ("处理掉这个告警",         "WRITE", "ALERT_ACKNOWLEDGE|ALERT_RESOLVE","F3-处理告警"),

    # ===== G系列: 边界 =====
    ("上周的订单",             "QUERY", "ORDER_LIST",                     "G1-上周订单"),
    ("帮我瞅瞅仓库",           "QUERY", "REPORT_INVENTORY|MATERIAL_BATCH_QUERY|WAREHOUSE_INVENTORY_CHECK","G3-瞅瞅"),
    ("看一眼设备",             "QUERY", "EQUIPMENT_STATUS_QUERY|EQUIPMENT_LIST","G3-看一眼"),
    ("帮我查查考勤",           "QUERY", "ATTENDANCE_HISTORY|ATTENDANCE_STATS|ATTENDANCE_TODAY","G3-查查考勤"),
    ("告警",                  "QUERY", "ALERT_LIST|ALERT_ACTIVE",        "G4-极短告警"),
    ("供应商",                "QUERY", "SUPPLIER_LIST|SUPPLIER_SEARCH",  "G4-极短供应商"),

    # ===== H: HR/财务 =====
    ("删除员工李四",           "WRITE", "HR_DELETE_EMPLOYEE|USER_DELETE", "H4-删员工"),
    ("本月成本分析",           "QUERY", "COST_TREND_ANALYSIS|COST_QUERY|REPORT_FINANCE","H1-成本分析"),
    ("月度考勤汇总",           "QUERY", "ATTENDANCE_MONTHLY|ATTENDANCE_STATS","H3-月考勤"),

    # ===== 高风险DELETE =====
    ("删除用户",              "WRITE", "USER_DELETE",                    "高风险-删用户"),
    ("删除设备",              "WRITE", "EQUIPMENT_DELETE|SCALE_DELETE_DEVICE","高风险-删设备"),
    ("删除客户",              "WRITE", "CUSTOMER_DELETE",                "高风险-删客户"),
    ("删除供应商",            "WRITE", "SUPPLIER_DELETE",                "高风险-删供应商"),
    ("删除批次",              "WRITE", "MATERIAL_BATCH_DELETE|PROCESSING_BATCH_CANCEL","高风险-删批次"),
    ("删除账号",              "WRITE", "USER_DELETE",                    "高风险-删账号"),
]

# ============================================================
# 6. 运行测试并输出报告
# ============================================================
def run_tests(phrase_map: dict, test_cases: list, label: str = "Round") -> dict:
    total = len(test_cases)
    correct = 0
    partial = 0  # 意图在多选项中
    wrong = 0
    vague_correct = 0
    fallback_count = 0

    print(f"\n{'='*70}")
    print(f"  {label} - {total} 测试用例")
    print(f"{'='*70}")
    print(f"{'输入':<22} {'期望':<30} {'结果':<30} {'方法':<25} {'✓/✗'}")
    print("-" * 120)

    failures = []
    for (inp, exp_type, exp_intents_str, desc) in test_cases:
        result = match_intent(inp, phrase_map)
        got_intent = result["intent"]
        method = result["method"]
        exp_intents = set(exp_intents_str.split("|"))

        if exp_type == "VAGUE":
            ok = got_intent == "CLARIFICATION"
            mark = "✓" if ok else "✗"
            if ok: vague_correct += 1; correct += 1
            else: wrong += 1; failures.append((inp, exp_intents_str, got_intent, method, desc))
        elif got_intent == "FALLBACK":
            mark = "⚡"  # BERT/LLM层会处理
            fallback_count += 1
            partial += 1
        elif got_intent in exp_intents:
            mark = "✓"
            correct += 1
        else:
            # 检查部分匹配 (意图前缀)
            prefix_ok = any(got_intent.startswith(e.split("_")[0]) for e in exp_intents if e != "CLARIFICATION")
            if prefix_ok:
                mark = "△"
                partial += 1
            else:
                mark = "✗"
                wrong += 1
                failures.append((inp, exp_intents_str, got_intent, method, desc))

        print(f"{inp:<22} {exp_intents_str[:30]:<30} {got_intent:<30} {method[:25]:<25} {mark}")

    phrase_match_rate = (correct) / total * 100
    fallback_rate = fallback_count / total * 100
    wrong_rate = wrong / total * 100

    print(f"\n{'='*70}")
    print(f"  结果统计")
    print(f"{'='*70}")
    print(f"  总用例:     {total}")
    print(f"  精确匹配✓:  {correct}  ({phrase_match_rate:.1f}%)")
    print(f"  FALLBACK⚡:  {fallback_count}  ({fallback_rate:.1f}%)  <- 交给BERT/LLM层")
    print(f"  部分匹配△:  {partial - fallback_count}")
    print(f"  错误✗:      {wrong}  ({wrong_rate:.1f}%)")
    print(f"\n  有效精确率 (错误率):  {wrong_rate:.1f}% 出错")

    if failures:
        print(f"\n{'='*70}")
        print(f"  ✗ 失败详情")
        print(f"{'='*70}")
        for (inp, exp, got, meth, desc) in failures:
            print(f"  [{desc}]")
            print(f"    输入: {inp}")
            print(f"    期望: {exp}")
            print(f"    得到: {got} (via {meth})")

    return {
        "total": total,
        "correct": correct,
        "fallback": fallback_count,
        "wrong": wrong,
        "failures": failures,
        "phrase_map_size": len(phrase_map),
    }

# ============================================================
# 7. 主程序
# ============================================================
if __name__ == "__main__":
    print("Loading phrase mappings from IntentKnowledgeBase.java...")
    phrase_map = parse_phrase_mappings(JAVA_FILE)
    print(f"Loaded {len(phrase_map)} phrase mappings.")

    stats = run_tests(phrase_map, TEST_CASES, label="第4轮 - v12.4热词修复")

    print(f"\n{'='*70}")
    print(f"  短语映射数量: {stats['phrase_map_size']}")
    print(f"  错误需立即修复: {stats['wrong']} 条")
    print(f"  FALLBACK(交给BERT/LLM): {stats['fallback']} 条")
    print(f"{'='*70}")

    # ============================================================
    # 盲测集：全新表达，验证泛化能力（非过拟合检验）
    # ============================================================
    BLIND_TESTS = [
        # --- 订单查询 ---
        ("昨天有什么订单",      "QUERY", "ORDER_LIST",                           "盲-订单-昨天"),
        ("本周新增了几个订单",  "QUERY", "ORDER_LIST",                           "盲-订单-本周"),
        ("帮我找找订单",        "QUERY", "ORDER_LIST",                           "盲-订单-帮找"),
        ("最近接了多少单",      "QUERY", "ORDER_LIST|SHIPMENT_STATS",            "盲-接单"),
        ("有多少待处理的订单",  "QUERY", "ORDER_LIST",                           "盲-待处理订单"),

        # --- 库存查询 ---
        ("羊肉库存剩多少",      "QUERY", "MATERIAL_BATCH_QUERY",                 "盲-羊肉库存"),
        ("鱼库存还够吗",        "QUERY", "MATERIAL_BATCH_QUERY|MATERIAL_LOW_STOCK_ALERT", "盲-鱼库存"),
        ("现在仓库有多少货",    "QUERY", "REPORT_INVENTORY|MATERIAL_BATCH_QUERY","盲-仓库多少货"),
        ("库存快用完了吗",      "QUERY", "MATERIAL_BATCH_QUERY|MATERIAL_LOW_STOCK_ALERT","盲-快用完"),
        ("帮我查一查库存",      "QUERY", "MATERIAL_BATCH_QUERY|REPORT_INVENTORY","盲-查库存"),

        # --- 生产批次 ---
        ("今天生产了多少",      "QUERY", "PROCESSING_BATCH_LIST|PRODUCTION_STATUS_QUERY","盲-今天生产多少"),
        ("在产的批次有哪些",    "QUERY", "PROCESSING_BATCH_LIST",                "盲-在产批次"),
        ("加工进度怎么样",      "QUERY", "PROCESSING_BATCH_LIST",                "盲-加工进度"),
        ("帮我开个新批次",      "WRITE", "PROCESSING_BATCH_CREATE",              "盲-开新批次"),

        # --- 质检 ---
        ("品控有问题吗",        "QUERY", "QUALITY_CHECK_QUERY",                  "盲-品控问题"),
        ("今天抽检结果",        "QUERY", "QUALITY_CHECK_QUERY",                  "盲-抽检结果"),
        ("有没有质量问题",      "QUERY", "QUALITY_CHECK_QUERY",                  "盲-质量问题"),
        ("合格率多少",          "QUERY", "QUALITY_CHECK_QUERY|QUALITY_STATS",    "盲-合格率"),

        # --- 考勤 ---
        ("今天谁迟到了",        "QUERY", "ATTENDANCE_STATS|ATTENDANCE_HISTORY|ATTENDANCE_ANOMALY","盲-谁迟到"),
        ("本月缺勤情况",        "QUERY", "ATTENDANCE_STATS|ATTENDANCE_MONTHLY|ATTENDANCE_HISTORY","盲-缺勤"),
        ("员工打卡情况",        "QUERY", "ATTENDANCE_HISTORY",                   "盲-打卡情况"),

        # --- 设备 ---
        ("机器运转正常吗",      "QUERY", "EQUIPMENT_STATUS_QUERY",               "盲-机器运转"),
        ("哪台设备出问题了",    "QUERY", "EQUIPMENT_STATUS_QUERY|ALERT_LIST",    "盲-设备出问题"),
        ("生产线状态",          "QUERY", "EQUIPMENT_STATUS_QUERY",               "盲-生产线状态"),

        # --- 告警 ---
        ("现在有没有报警",      "QUERY", "ALERT_LIST",                           "盲-现在报警"),
        ("异常情况有哪些",      "QUERY", "ALERT_LIST",                           "盲-异常情况"),
        ("哪里出故障了",        "QUERY", "ALERT_LIST|EQUIPMENT_STATUS_QUERY",    "盲-哪里故障"),

        # --- 高风险DELETE变体 ---
        ("把这个用户删掉",      "WRITE", "USER_DELETE",                          "盲-删用户变体"),
        ("移除这台设备",        "WRITE", "EQUIPMENT_DELETE",                     "盲-移除设备"),
        ("清除这个客户",        "WRITE", "CUSTOMER_DELETE",                      "盲-清除客户"),
        ("作废这笔订单",        "WRITE", "ORDER_DELETE|ORDER_CANCEL",            "盲-作废订单"),

        # --- 打卡变体 ---
        ("我上班了",            "WRITE", "CLOCK_IN",                             "盲-我上班了"),
        ("开始上班",            "WRITE", "CLOCK_IN",                             "盲-开始上班"),
        ("下班了",              "WRITE", "CLOCK_OUT",                            "盲-下班了"),
        ("我要下班",            "WRITE", "CLOCK_OUT",                            "盲-我要下班"),

        # --- 发货变体 ---
        ("今天发出去多少货",    "QUERY", "SHIPMENT_STATS|SHIPMENT_QUERY",        "盲-发出多少"),
        ("发货单状态",          "QUERY", "SHIPMENT_QUERY|SHIPMENT_STATUS_UPDATE","盲-发货单状态"),
        ("这批货发走了吗",      "QUERY", "SHIPMENT_QUERY",                       "盲-货发走了吗"),

        # --- 歧义/澄清变体 ---
        ("弄一下",              "VAGUE", "CLARIFICATION",                        "盲-澄清-弄一下"),
        ("整一下",              "VAGUE", "CLARIFICATION",                        "盲-澄清-整一下"),
        ("那边怎么样",          "VAGUE", "CLARIFICATION",                        "盲-澄清-那边"),
    ]

    print(f"\n{'='*70}")
    print(f"  【盲测集】全新表达 - 验证泛化能力")
    print(f"{'='*70}")
    blind_stats = run_tests(phrase_map, BLIND_TESTS, label="盲测集 - v12.4")
    print(f"\n{'='*70}")
    print(f"  盲测错误数: {blind_stats['wrong']} / {blind_stats['total']}")
    print(f"  盲测FALLBACK(正常交给BERT/LLM): {blind_stats['fallback']}")
    print(f"{'='*70}")
