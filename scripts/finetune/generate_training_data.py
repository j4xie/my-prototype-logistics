#!/usr/bin/env python3
"""
生成增量训练数据 - 针对 CLASSIFIER 层混淆的意图

问题意图:
1. PROCESSING_BATCH_LIST vs MATERIAL_BATCH_QUERY
2. CLOCK_IN vs ATTENDANCE_TODAY
3. SHIPMENT_STATS vs MATERIAL_BATCH_QUERY

数据格式: JSON Lines (每行一个样本)
{
    "text": "用户输入",
    "label": "INTENT_CODE"
}
"""

import json
import random
from pathlib import Path

# 问题意图的训练样本
TRAINING_SAMPLES = {
    # ========== PROCESSING_BATCH_LIST (在产批次列表) ==========
    "PROCESSING_BATCH_LIST": [
        # 核心表达
        "查看在产批次",
        "在产批次列表",
        "当前批次有哪些",
        "正在生产的批次",
        "生产中的批次",
        "查一下在产批次",
        "看看在产批次",
        "帮我查在产批次",
        "显示在产批次",
        "列出在产批次",
        # 口语变体
        "现在生产的批次有哪些",
        "目前在做的批次",
        "正在加工的批次",
        "当前生产线上的批次",
        "生产线在跑什么批次",
        "现在有什么批次在生产",
        "查一下当前批次",
        "当前批次情况",
        "在产批次状态",
        "生产中的批次列表",
        # 带前缀
        "帮我查一下在产批次",
        "请帮我看看在产批次",
        "能帮我查下当前批次吗",
        "麻烦看一下在产批次",
        "查询一下生产中的批次",
    ],

    # ========== CLOCK_IN (打卡/签到) ==========
    "CLOCK_IN": [
        # 核心表达
        "我要打卡",
        "帮我打卡",
        "签到",
        "上班打卡",
        "下班打卡",
        "打卡上班",
        "打卡下班",
        "记录签到",
        "签到打卡",
        "打个卡",
        # 口语变体
        "帮我签个到",
        "我来签到",
        "签到一下",
        "打一下卡",
        "记录我的打卡",
        "登记签到",
        "上班签到",
        "下班签到",
        "打卡记录一下",
        "帮忙打个卡",
        # 带前缀
        "帮我查一下签到",  # 这个容易被误判为 ATTENDANCE_TODAY
        "我要签到",
        "现在签到",
        "签到登记",
        "打卡登记",
    ],

    # ========== SHIPMENT_STATS (发货统计) ==========
    "SHIPMENT_STATS": [
        # 核心表达
        "发货统计",
        "出货统计",
        "发货数据统计",
        "出货量统计",
        "发货量",
        "出货量",
        "发货总量",
        "出货总量",
        "发货汇总",
        "出货汇总",
        # 口语变体
        "最近发货量",
        "最近出货量",
        "这周发货多少",
        "本月发货量",
        "上周发货数据",
        "发货数据对比",
        "出货数据统计",
        "发货情况统计",
        "发货量对比",
        "出货量对比",
        # 带前缀
        "查一下最近出货量",  # 这个容易被误判
        "帮我看看发货统计",
        "查询发货量",
        "看看出货量",
        "发货数据怎么样",
    ],

    # ========== 对比意图: MATERIAL_BATCH_QUERY (原料批次查询) ==========
    # 这些是容易被混淆的，需要强化区分
    "MATERIAL_BATCH_QUERY": [
        # 核心表达 - 强调"原料"
        "查看原料批次",
        "原料批次列表",
        "原料有哪些",
        "查询原料",
        "原料信息",
        "原料库存",
        "看看原料",
        "原料情况",
        "原料批次",
        "仓库原料",
        # 口语变体
        "原料还有多少",
        "原料够不够",
        "查一下原料",
        "看下原料批次",
        "原料库存查询",
        "帮我查原料",
        "原料清单",
        "原料列表",
        "有哪些原料",
        "原料都有什么",
    ],

    # ========== 对比意图: ATTENDANCE_TODAY (今日出勤) ==========
    "ATTENDANCE_TODAY": [
        # 核心表达 - 强调"今天/出勤/谁"
        "今天出勤情况",
        "今日出勤",
        "今天谁来了",
        "今天谁上班",
        "今天考勤",
        "今日考勤",
        "今天有谁",
        "今天在岗人员",
        "今日在岗",
        "今天上班的人",
        # 口语变体
        "今天谁有空",
        "今天人员情况",
        "今天出勤了多少人",
        "今日出勤率",
        "今天有多少人上班",
        "今天缺勤的有谁",
        "今天谁没来",
        "今天迟到的有谁",
        "今日考勤统计",
        "今天考勤情况",
    ],
}

# 数据增强：添加前缀变体
PREFIXES = [
    "", "查一下", "帮我查一下", "看看", "帮我看看",
    "请帮我", "麻烦", "能帮我", "帮忙查一下"
]

def augment_samples(samples: list, intent: str) -> list:
    """数据增强：对样本添加前缀变体"""
    augmented = []
    for sample in samples:
        augmented.append(sample)
        # 对于较短的样本，添加前缀变体
        if len(sample) < 8:
            for prefix in PREFIXES[:3]:  # 只用少量前缀
                if prefix and not sample.startswith(prefix):
                    augmented.append(f"{prefix}{sample}")
    return list(set(augmented))  # 去重

def generate_training_data(output_dir: Path, augment: bool = True):
    """生成训练数据"""
    output_dir.mkdir(parents=True, exist_ok=True)

    all_samples = []

    for intent, samples in TRAINING_SAMPLES.items():
        if augment:
            samples = augment_samples(samples, intent)

        for text in samples:
            all_samples.append({
                "text": text,
                "label": intent
            })

    # 打乱顺序
    random.shuffle(all_samples)

    # 输出统计
    intent_counts = {}
    for sample in all_samples:
        intent = sample["label"]
        intent_counts[intent] = intent_counts.get(intent, 0) + 1

    print(f"生成训练数据统计:")
    print(f"{'意图':<30} {'样本数':>8}")
    print("-" * 40)
    for intent, count in sorted(intent_counts.items()):
        print(f"{intent:<30} {count:>8}")
    print("-" * 40)
    print(f"{'总计':<30} {len(all_samples):>8}")

    # 保存为 JSON Lines 格式
    output_file = output_dir / "incremental_training_data.jsonl"
    with open(output_file, "w", encoding="utf-8") as f:
        for sample in all_samples:
            f.write(json.dumps(sample, ensure_ascii=False) + "\n")

    print(f"\n已保存到: {output_file}")

    # 也保存一份 CSV 格式（兼容旧格式）
    csv_file = output_dir / "incremental_training_data.csv"
    with open(csv_file, "w", encoding="utf-8") as f:
        f.write("user_input,intent_code\n")
        for sample in all_samples:
            # 转义逗号和引号
            text = sample["text"].replace('"', '""')
            f.write(f'"{text}",{sample["label"]}\n')

    print(f"CSV 格式保存到: {csv_file}")

    return all_samples

if __name__ == "__main__":
    output_dir = Path(__file__).parent / "data"
    generate_training_data(output_dir, augment=True)
