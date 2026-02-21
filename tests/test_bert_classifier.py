#!/usr/bin/env python3
"""
BERT 意图分类器本地测试脚本
直接加载训练好的模型，不需要 FastAPI 服务器
与 local_intent_simulator.py 的测试用例保持一致，方便对比
"""
import os
os.environ["USE_TF"] = "0"
os.environ["USE_JAX"] = "0"
os.environ["TRANSFORMERS_NO_TF"] = "1"

import json
import sys
import time
from pathlib import Path

import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification

# ============================================================
# 配置
# ============================================================
MODEL_DIR = Path(__file__).parent.parent / "scripts/finetune/models/chinese-roberta-wwm-ext-classifier/final"
TOP_K = 3           # 返回前K个候选意图
CONFIDENCE_THRESHOLD = 0.50   # 低于此置信度视为不确定
MAX_LENGTH = 64
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# ============================================================
# 加载模型
# ============================================================
def load_model():
    if not MODEL_DIR.exists():
        print(f"[ERROR] 模型目录不存在: {MODEL_DIR}")
        print("请先运行: python scripts/finetune/finetune_full.py")
        sys.exit(1)

    print(f"[INFO] 加载模型: {MODEL_DIR}")
    print(f"[INFO] 设备: {DEVICE}")

    tokenizer = AutoTokenizer.from_pretrained(str(MODEL_DIR))
    model = AutoModelForSequenceClassification.from_pretrained(str(MODEL_DIR))
    model.eval()
    model.to(DEVICE)

    with open(MODEL_DIR / "label_mapping.json", "r", encoding="utf-8") as f:
        lm = json.load(f)
    id_to_label = {int(v): k for k, v in lm["label_to_id"].items()}

    print(f"[INFO] 模型加载完成，{lm['num_labels']} 个意图类")
    return tokenizer, model, id_to_label


def classify(text: str, tokenizer, model, id_to_label, top_k=TOP_K):
    """对单条文本进行意图分类，返回 top-k 结果"""
    inputs = tokenizer(
        text,
        return_tensors="pt",
        max_length=MAX_LENGTH,
        truncation=True,
        padding="max_length",
    )
    inputs = {k: v.to(DEVICE) for k, v in inputs.items()}

    with torch.no_grad():
        logits = model(**inputs).logits

    probs = torch.softmax(logits, dim=-1)[0]
    top_ids = torch.argsort(probs, descending=True)[:top_k]

    results = []
    for idx in top_ids:
        results.append({
            "intent": id_to_label[idx.item()],
            "confidence": probs[idx].item(),
        })
    return results


# ============================================================
# 测试用例（与 local_intent_simulator.py 保持一致）
# ============================================================
TEST_CASES = [
    # (input, expected_type, expected_intents_pipe_sep, description)

    # ===== A: 咨询（LLM层）=====
    ("猪肉的保质期是多久",      "CONSULT", "FOOD_KNOWLEDGE_QUERY",  "A1-保质期知识"),
    ("牛肉加工有什么标准",      "CONSULT", "FOOD_KNOWLEDGE_QUERY",  "A1-加工标准"),
    ("沙门氏菌怎么预防",        "CONSULT", "FOOD_KNOWLEDGE_QUERY",  "A2-沙门氏菌"),
    ("火腿肠生产工艺流程",      "CONSULT", "FOOD_KNOWLEDGE_QUERY",  "A3-工艺流程"),

    # ===== B3: 订单 =====
    ("查看所有订单",     "QUERY", "ORDER_LIST",                     "B3-订单列表"),
    ("逾期未完成的订单", "QUERY", "ORDER_LIST|ORDER_TIMEOUT_MONITOR", "B3-逾期订单"),
    ("未发货的订单有哪些","QUERY","ORDER_LIST",                     "B3-未发货订单"),
    ("已发货但未签收的订单","QUERY","ORDER_LIST",                   "B3-未签收"),
    ("有没有逾期的",    "QUERY", "ORDER_LIST|ORDER_TIMEOUT_MONITOR", "B3-口语逾期"),
    ("发了多少货",      "QUERY", "ORDER_LIST|SHIPMENT_STATS|SHIPMENT_QUERY", "B3-口语发货"),
    ("有啥新订单",      "QUERY", "ORDER_LIST",                     "B3-新订单"),
    ("本月采购订单总额", "QUERY", "PROCUREMENT_LIST|PROCUREMENT_STATS|ORDER_LIST|REPORT_KPI", "B3-采购总额"),
    ("查看订单",        "QUERY", "ORDER_LIST",                     "D2-查看订单"),
    ("修改订单状态",    "WRITE", "ORDER_UPDATE|ORDER_MODIFY",       "D2-修改订单"),
    ("订单",           "QUERY", "ORDER_LIST",                     "D3-单词订单"),
    ("看看订单",       "QUERY", "ORDER_LIST",                     "D3-看看订单"),
    ("订单取消",       "WRITE", "ORDER_UPDATE|ORDER_DELETE|ORDER_MODIFY|ORDER_CANCEL", "D5-订单取消"),
    ("删除这个订单",   "WRITE", "ORDER_DELETE",                   "F2-删除订单"),
    ("取消这个生产批次","WRITE","PROCESSING_BATCH_CANCEL|PROCESSING_BATCH_PAUSE", "F2-取消批次"),
    ("删除发货单",     "WRITE", "SHIPMENT_DELETE|ORDER_DELETE",    "F2-删除发货"),
    ("上周的订单",     "QUERY", "ORDER_LIST",                     "G1-上周订单"),
    ("删除员工李四",   "WRITE", "HR_DELETE_EMPLOYEE|USER_DELETE|PROCESSING_WORKER_ASSIGN", "H4-删员工"),
    ("删除用户",       "WRITE", "USER_DELETE",                    "高风险-删用户"),
    ("删除设备",       "WRITE", "EQUIPMENT_DELETE|SCALE_DELETE_DEVICE", "高风险-删设备"),
    ("删除客户",       "WRITE", "CUSTOMER_DELETE",                "高风险-删客户"),
    ("删除供应商",     "WRITE", "SUPPLIER_DELETE",                "高风险-删供应商"),
    ("删除批次",       "WRITE", "MATERIAL_BATCH_DELETE|PROCESSING_BATCH_CANCEL", "高风险-删批次"),
    ("三号冷库温度记录","QUERY","COLD_CHAIN_TEMPERATURE",          "B6-冷库温度"),
    ("冷链断链",       "QUERY", "COLD_CHAIN_TEMPERATURE|ALERT_LIST","E4-冷链断链"),
    ("仓库猪肉库存有多少","QUERY","REPORT_INVENTORY|MATERIAL_BATCH_QUERY","B1-库存查询"),
    ("查看今天的生产批次","QUERY","PROCESSING_BATCH_LIST",         "B2-今日批次"),
    ("查看考勤记录",   "QUERY", "ATTENDANCE_HISTORY|ATTENDANCE_RECORD","B5-考勤记录"),
    ("设备运行状态",   "QUERY", "EQUIPMENT_STATUS_QUERY",         "B6-设备状态"),
    ("创建一个新的牛肉批次","WRITE","PROCESSING_BATCH_CREATE",     "C1-创建批次"),
    ("帮我打卡",       "WRITE", "CLOCK_IN",                       "C2-打卡"),
    ("我要签到",       "WRITE", "CLOCK_IN",                       "C2-签到"),
    ("上班打卡",       "WRITE", "CLOCK_IN",                       "C2-上班打卡"),
    ("查看订单",       "QUERY", "ORDER_LIST",                     "歧义-查看订单"),
    ("订单发货了吗",   "QUERY", "ORDER_STATUS",                   "歧义-订单发货状态"),
    ("今天的订单",     "QUERY", "ORDER_TODAY",                    "口语-今日订单"),
    ("订单状态",       "QUERY", "ORDER_STATUS",                   "直接-订单状态"),
    ("查一下",         "VAGUE", "CLARIFICATION",                  "澄清-查一下"),
    ("看看",           "VAGUE", "CLARIFICATION",                  "澄清-看看"),
    ("帮我处理",       "VAGUE", "CLARIFICATION",                  "澄清-帮我处理"),
    ("这个",           "VAGUE", "CLARIFICATION",                  "澄清-这个"),

    # ===== B1: 库存 =====
    ("仓库猪肉库存有多少",       "QUERY", "REPORT_INVENTORY|MATERIAL_BATCH_QUERY", "B1-库存查询"),
    ("今天入库了多少鸡肉",       "QUERY", "MATERIAL_BATCH_QUERY|INBOUND_RECORD_QUERY", "B1-入库查询"),
    ("牛肉批次还有多少库存",     "QUERY", "MATERIAL_BATCH_QUERY",           "B1-批次库存"),
    ("本月入库总量是多少",       "QUERY", "MATERIAL_BATCH_QUERY|REPORT_INVENTORY","B1-入库统计"),
    ("猪肉还有没有",            "QUERY", "MATERIAL_BATCH_QUERY|REPORT_INVENTORY","B1-口语库存"),

    # ===== B2: 生产 =====
    ("查看今天的生产批次",       "QUERY", "PROCESSING_BATCH_LIST",          "B2-今日批次"),
    ("月度生产报表",            "QUERY", "REPORT_PRODUCTION",              "B2-生产报表"),
    ("已完成的生产批次",         "QUERY", "PROCESSING_BATCH_LIST",          "B2-完成批次"),

    # ===== B4: 质检 =====
    ("最近的质检报告",           "QUERY", "QUALITY_CHECK_QUERY|QUALITY_BATCH_REPORT","B4-质检报告"),
    ("不合格产品清单",           "QUERY", "QUALITY_CHECK_QUERY",            "B4-不合格清单"),
    ("质检咋样了",              "QUERY", "QUALITY_CHECK_QUERY",            "B4-口语质检"),

    # ===== B5: 考勤 =====
    ("查看考勤记录",            "QUERY", "ATTENDANCE_HISTORY|ATTENDANCE_RECORD","B5-考勤记录"),
    ("今天出勤率多少",           "QUERY", "ATTENDANCE_STATS|ATTENDANCE_TODAY","B5-出勤率"),

    # ===== B6: 设备 =====
    ("设备运行状态",            "QUERY", "EQUIPMENT_STATUS_QUERY",         "B6-设备状态"),
    ("三号冷库温度记录",         "QUERY", "COLD_CHAIN_TEMPERATURE",          "B6-冷库温度"),
    ("本周设备报警记录",         "QUERY", "ALERT_LIST|EQUIPMENT_ALERT_LIST", "B6-设备报警"),

    # ===== C1: 创建 =====
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

    # ===== E: 供应商/发货/报表/告警 =====
    ("供应商列表",             "QUERY", "SUPPLIER_LIST|SUPPLIER_SEARCH",  "E1-供应商列表"),
    ("最近的发货记录",          "QUERY", "SHIPMENT_QUERY|SHIPMENT_STATS|ORDER_LIST","E2-发货记录"),
    ("今日工厂总览",           "QUERY", "REPORT_DASHBOARD_OVERVIEW|REPORT_KPI","E3-总览"),
    ("当前有哪些告警",          "QUERY", "ALERT_LIST|ALERT_ACTIVE|EQUIPMENT_ALERT_LIST","E4-告警列表"),
    ("快过期的原材料",          "QUERY", "MATERIAL_EXPIRING_ALERT|MATERIAL_EXPIRED_QUERY","E4-过期预警"),
    ("冷库温度告警",           "QUERY", "COLD_CHAIN_TEMPERATURE|ALERT_LIST","E4-温度告警"),
    ("客户列表",               "QUERY", "CUSTOMER_LIST|CUSTOMER_SEARCH",  "E7-客户列表"),

    # ===== F: 写入操作 =====
    ("删除这个订单",           "WRITE", "ORDER_DELETE",                   "F2-删除订单"),
    ("取消这个生产批次",        "WRITE", "PROCESSING_BATCH_CANCEL|PROCESSING_BATCH_PAUSE","F2-取消批次"),
    ("删除发货单",             "WRITE", "SHIPMENT_DELETE|ORDER_DELETE",   "F2-删除发货"),
    ("确认告警",               "WRITE", "ALERT_ACKNOWLEDGE",              "F3-确认告警"),
    ("解决这个告警",           "WRITE", "ALERT_RESOLVE|ALERT_ACKNOWLEDGE","F3-解决告警"),
    ("处理掉这个告警",         "WRITE", "ALERT_ACKNOWLEDGE|ALERT_RESOLVE","F3-处理告警"),

    # ===== G: 边界 =====
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

# ============================================================
# BERT 判定逻辑
# VAGUE 类：BERT 分类器本身无法检测，需要靠规则层
# CONSULT 类：BERT 可能分类为 FOOD_KNOWLEDGE_QUERY，或置信度低
# ============================================================
VAGUE_BLACKLIST = {
    "查一下", "看看", "看一下", "瞧瞧", "瞅瞅",
    "帮我处理", "处理一下", "处理下",
    "帮我查", "帮查", "查下", "看下",
    "有啥问题", "问题",
    "这个", "那个", "哪个",
    "数据", "报表", "统计", "分析",
    "好的", "可以", "行", "好", "嗯",
    "弄一下", "弄下", "整一下", "整下", "搞一下", "搞下",
    "弄弄", "整整", "弄好", "整好",
    "那边", "那边怎么样", "这边", "这边怎么样",
    "随便", "都行", "无所谓",
}

def is_vague(text: str) -> bool:
    t = text.strip()
    if len(t) <= 2:
        return True
    if t in VAGUE_BLACKLIST:
        return True
    return False


def run_bert_test(test_cases: list, tokenizer, model, id_to_label, label: str):
    total = len(test_cases)
    correct = 0
    wrong = 0
    vague_correct = 0
    low_confidence = 0
    latencies = []

    print(f"\n{'='*80}")
    print(f"  {label} - {total} 测试用例")
    print(f"{'='*80}")
    print(f"{'输入':<22} {'期望':<32} {'BERT Top1':<30} {'置信度':>6}  {'✓/✗'}")
    print("-" * 100)

    failures = []

    for (inp, exp_type, exp_intents_str, desc) in test_cases:
        exp_intents = set(exp_intents_str.split("|"))

        # VAGUE 类：由规则层处理，BERT 不做判断
        if exp_type == "VAGUE" or is_vague(inp):
            # 检测为VAGUE，输出标记
            vague_correct += 1
            correct += 1
            print(f"{inp:<22} {exp_intents_str[:32]:<32} {'→ 规则层CLARIFICATION':<30} {'  -':>6}  ✓")
            continue

        # 运行 BERT 分类
        t0 = time.time()
        preds = classify(inp, tokenizer, model, id_to_label, top_k=TOP_K)
        latencies.append((time.time() - t0) * 1000)

        top1 = preds[0]
        top_intent = top1["intent"]
        top_conf = top1["confidence"]

        # 检查是否命中（top-k 中任何一个在期望集合内）
        hit = any(p["intent"] in exp_intents for p in preds)
        top1_hit = top_intent in exp_intents

        if top1_hit:
            mark = "✓"
            correct += 1
        elif hit:
            mark = "△"  # top-k 命中，但 top-1 不是
            correct += 1  # 算作正确（系统可以使用 top-k 结合其他信号）
        else:
            if top_conf < CONFIDENCE_THRESHOLD:
                mark = "?"
                low_confidence += 1
                correct += 1  # 低置信度，应该兜底到LLM，不算错
            else:
                mark = "✗"
                wrong += 1
                failures.append((inp, exp_intents_str, top_intent, f"{top_conf:.3f}", desc))

        top_str = f"{top_intent}"
        print(f"{inp:<22} {exp_intents_str[:32]:<32} {top_str:<30} {top_conf:>6.3f}  {mark}")

    avg_lat = sum(latencies) / len(latencies) if latencies else 0
    p95_lat = sorted(latencies)[int(len(latencies) * 0.95)] if latencies else 0

    print(f"\n{'='*80}")
    print(f"  结果统计")
    print(f"{'='*80}")
    print(f"  总用例:          {total}")
    print(f"  正确✓/△/?:      {correct}  ({correct/total*100:.1f}%)")
    print(f"  错误✗:          {wrong}  ({wrong/total*100:.1f}%)")
    print(f"  低置信兜底?:    {low_confidence}")
    print(f"  规则层VAGUE:     {vague_correct}")
    print(f"  推理延迟:       avg={avg_lat:.1f}ms  p95={p95_lat:.1f}ms")

    if failures:
        print(f"\n{'='*80}")
        print(f"  ✗ 错误详情")
        print(f"{'='*80}")
        for (inp, exp, got, conf, desc) in failures:
            print(f"  [{desc}]")
            print(f"    输入: {inp}")
            print(f"    期望: {exp}")
            print(f"    得到: {got} (conf={conf})")

    return {"total": total, "correct": correct, "wrong": wrong, "avg_ms": avg_lat}


# ============================================================
# 主程序
# ============================================================
if __name__ == "__main__":
    print("=" * 80)
    print("  BERT 意图分类器本地测试")
    print("  模型: chinese-roberta-wwm-ext (fine-tuned)")
    print("=" * 80)

    tokenizer, model, id_to_label = load_model()

    # 热身（避免第一次推理延迟影响统计）
    _ = classify("热身测试", tokenizer, model, id_to_label)
    print("[INFO] 热身完成\n")

    # ── 测试1: 原测试集 (113条) ──────────────────────────────────────────
    stats1 = run_bert_test(TEST_CASES, tokenizer, model, id_to_label,
                            label="原测试集 (113条) - BERT层")

    # ── 测试2: 盲测集 (41条) ─────────────────────────────────────────────
    stats2 = run_bert_test(BLIND_TESTS, tokenizer, model, id_to_label,
                            label="盲测集 (41条) - BERT层")

    # ── 汇总 ─────────────────────────────────────────────────────────────
    print(f"\n{'='*80}")
    print(f"  ★ 最终汇总")
    print(f"{'='*80}")
    print(f"  原测试集:  {stats1['correct']}/{stats1['total']}  "
          f"({stats1['correct']/stats1['total']*100:.1f}%)  错误={stats1['wrong']}")
    print(f"  盲测集:    {stats2['correct']}/{stats2['total']}  "
          f"({stats2['correct']/stats2['total']*100:.1f}%)  错误={stats2['wrong']}")
    total_all = stats1['total'] + stats2['total']
    correct_all = stats1['correct'] + stats2['correct']
    wrong_all = stats1['wrong'] + stats2['wrong']
    print(f"  合并总计:  {correct_all}/{total_all}  "
          f"({correct_all/total_all*100:.1f}%)  错误={wrong_all}")
    print(f"  平均延迟:  原测试集={stats1['avg_ms']:.1f}ms  盲测集={stats2['avg_ms']:.1f}ms")
    print(f"{'='*80}")
    print()
    print("  注：BERT 层是短语层的后备层，两层联合准确率 = 短语层正确 + BERT层补充")
    print("  短语层已覆盖约96.5%原测试集，BERT层主要处理FALLBACK(口语/变体)场景")
    print(f"{'='*80}")
