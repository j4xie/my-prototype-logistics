#!/usr/bin/env python3
"""
综合模型评估脚本 — NER + Intent 分类

功能:
  - NER micro/macro F1
  - Intent accuracy + per-class F1
  - 回归测试: 与基线模型 (179类) 对比
  - 推理延迟基准 (CPU / GPU)
  - 输出详细报告 (JSON + Markdown)

使用方式:
  python evaluate_model.py --model-dir ./food-ner-intent-model/best --test-ner ./test_ner.jsonl --test-intent ./test_intent.jsonl
  python evaluate_model.py --model-dir ./model --test-intent ./test.jsonl --baseline-dir ./baseline_model --latency
"""

import argparse
import json
import logging
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import torch
import torch.nn as nn

from transformers import AutoModel, AutoTokenizer, set_seed

from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_recall_fscore_support,
)

# ---------------------------------------------------------------------------
# 日志配置
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("evaluate_model")

# ---------------------------------------------------------------------------
# 常量
# ---------------------------------------------------------------------------
DEFAULT_MAX_SEQ_LENGTH = 256
DEFAULT_BATCH_SIZE = 32
DEFAULT_LATENCY_RUNS = 100
DEFAULT_SEED = 42

# NER BIO 标签
NER_LABEL_LIST = [
    "O",
    "B-ADD", "I-ADD", "B-CRT", "I-CRT", "B-EQP", "I-EQP",
    "B-HAZ", "I-HAZ", "B-ING", "I-ING", "B-MIC", "I-MIC",
    "B-NUT", "I-NUT", "B-ORG", "I-ORG", "B-PRM", "I-PRM",
    "B-PRD", "I-PRD", "B-REG", "I-REG", "B-STD", "I-STD",
    "B-TST", "I-TST",
]
NER_LABEL2ID = {label: i for i, label in enumerate(NER_LABEL_LIST)}
NER_ID2LABEL = {i: label for i, label in enumerate(NER_LABEL_LIST)}


# ---------------------------------------------------------------------------
# 多任务模型 (与 finetune_food_ner.py 保持一致)
# ---------------------------------------------------------------------------

class MultiTaskModel(nn.Module):
    """多任务模型: 共享编码器 + NER 头 + Intent 头"""

    def __init__(
        self,
        base_model_name: str,
        num_ner_labels: int,
        num_intent_labels: int,
        dropout_rate: float = 0.1,
    ):
        super().__init__()
        self.encoder = AutoModel.from_pretrained(base_model_name)
        hidden_size = self.encoder.config.hidden_size

        self.ner_dropout = nn.Dropout(dropout_rate)
        self.ner_classifier = nn.Linear(hidden_size, num_ner_labels)

        self.intent_dropout = nn.Dropout(dropout_rate)
        self.intent_classifier = nn.Sequential(
            nn.Linear(hidden_size, hidden_size),
            nn.Tanh(),
            nn.Dropout(dropout_rate),
            nn.Linear(hidden_size, num_intent_labels),
        )

        self.num_ner_labels = num_ner_labels
        self.num_intent_labels = num_intent_labels

    def forward(
        self,
        input_ids: torch.Tensor,
        attention_mask: torch.Tensor,
        token_type_ids: Optional[torch.Tensor] = None,
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        outputs = self.encoder(
            input_ids=input_ids,
            attention_mask=attention_mask,
            token_type_ids=token_type_ids,
        )
        sequence_output = outputs.last_hidden_state
        cls_output = sequence_output[:, 0, :]

        ner_logits = self.ner_classifier(self.ner_dropout(sequence_output))
        intent_logits = self.intent_classifier(self.intent_dropout(cls_output))

        return ner_logits, intent_logits


# ---------------------------------------------------------------------------
# 模型加载
# ---------------------------------------------------------------------------

def load_model_and_tokenizer(
    model_dir: str,
    base_model: str,
    device: str,
) -> Tuple[MultiTaskModel, AutoTokenizer, Dict]:
    """加载模型、tokenizer 和标签映射。"""
    model_dir = Path(model_dir)

    # 标签映射
    label_mapping = {}
    for candidate in [model_dir / "label_mapping.json", model_dir.parent / "label_mapping.json"]:
        if candidate.exists():
            with open(candidate, "r", encoding="utf-8") as f:
                label_mapping = json.load(f)
            break

    num_ner = label_mapping.get("num_ner_labels", len(NER_LABEL_LIST))
    num_intent = label_mapping.get("num_intent_labels", 230)

    # Tokenizer
    tokenizer_path = model_dir if (model_dir / "tokenizer_config.json").exists() else base_model
    tokenizer = AutoTokenizer.from_pretrained(tokenizer_path)

    # 模型
    model = MultiTaskModel(
        base_model_name=base_model,
        num_ner_labels=num_ner,
        num_intent_labels=num_intent,
    )

    model_pt = model_dir / "model.pt"
    if model_pt.exists():
        state_dict = torch.load(model_pt, map_location=device)
        model.load_state_dict(state_dict, strict=False)
        logger.info("加载模型: %s", model_pt)

    model.to(device)
    model.eval()

    return model, tokenizer, label_mapping


# ---------------------------------------------------------------------------
# 数据加载
# ---------------------------------------------------------------------------

def load_ner_test_data(path: str) -> List[Dict]:
    """加载 NER 测试数据。"""
    data = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
                if "text" in record and "labels" in record:
                    data.append(record)
            except json.JSONDecodeError:
                continue
    logger.info("NER 测试数据: %d 条", len(data))
    return data


def load_intent_test_data(path: str) -> List[Dict]:
    """加载 Intent 测试数据。"""
    data = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
                if "text" in record and "label" in record:
                    data.append(record)
            except json.JSONDecodeError:
                continue
    logger.info("Intent 测试数据: %d 条", len(data))
    return data


# ---------------------------------------------------------------------------
# NER 评估
# ---------------------------------------------------------------------------

def evaluate_ner(
    model: MultiTaskModel,
    tokenizer: AutoTokenizer,
    test_data: List[Dict],
    device: str,
    max_length: int,
) -> Dict:
    """
    NER 评估。
    返回 micro F1, macro F1, per-class 指标。
    """
    all_true_labels = []
    all_pred_labels = []

    for record in test_data:
        text = record["text"]
        char_labels = record["labels"]

        encoding = tokenizer(
            text,
            max_length=max_length,
            truncation=True,
            padding="max_length",
            return_tensors="pt",
            return_offsets_mapping=True,
        )

        offsets = encoding.pop("offset_mapping")[0]
        input_ids = encoding["input_ids"].to(device)
        attention_mask = encoding["attention_mask"].to(device)

        with torch.no_grad():
            ner_logits, _ = model(input_ids, attention_mask)
            preds = ner_logits.argmax(dim=-1)[0].cpu().tolist()

        for idx, (offset, pred_id) in enumerate(zip(offsets, preds)):
            start, end = offset.tolist()
            if start == 0 and end == 0:
                continue  # 特殊 token
            if start < len(char_labels):
                true_label = char_labels[start]
                pred_label = NER_ID2LABEL.get(pred_id, "O")
                all_true_labels.append(true_label)
                all_pred_labels.append(pred_label)

    # 计算指标
    entity_labels = sorted(set(l for l in set(all_true_labels + all_pred_labels) if l != "O"))

    micro_f1 = f1_score(all_true_labels, all_pred_labels, labels=entity_labels,
                         average="micro", zero_division=0)
    macro_f1 = f1_score(all_true_labels, all_pred_labels, labels=entity_labels,
                         average="macro", zero_division=0)

    report_dict = classification_report(
        all_true_labels, all_pred_labels, labels=entity_labels,
        output_dict=True, zero_division=0,
    )

    # 实体级别统计
    entity_type_metrics = {}
    for label in entity_labels:
        if label.startswith("B-"):
            prefix = label[2:]
            b_label = f"B-{prefix}"
            i_label = f"I-{prefix}"
            related_labels = [l for l in entity_labels if l.endswith(f"-{prefix}")]
            type_f1 = f1_score(
                all_true_labels, all_pred_labels, labels=related_labels,
                average="micro", zero_division=0,
            )
            entity_type_metrics[prefix] = type_f1

    return {
        "micro_f1": round(micro_f1, 4),
        "macro_f1": round(macro_f1, 4),
        "per_label": {k: {
            "precision": round(v.get("precision", 0), 4),
            "recall": round(v.get("recall", 0), 4),
            "f1-score": round(v.get("f1-score", 0), 4),
            "support": v.get("support", 0),
        } for k, v in report_dict.items() if k in entity_labels},
        "entity_type_f1": {k: round(v, 4) for k, v in sorted(entity_type_metrics.items())},
        "total_tokens": len(all_true_labels),
    }


# ---------------------------------------------------------------------------
# Intent 评估
# ---------------------------------------------------------------------------

def evaluate_intent(
    model: MultiTaskModel,
    tokenizer: AutoTokenizer,
    test_data: List[Dict],
    label2id: Dict[str, int],
    id2label: Dict[int, str],
    device: str,
    max_length: int,
) -> Dict:
    """
    Intent 分类评估。
    返回 accuracy, micro/macro F1, per-class 指标。
    """
    all_true = []
    all_pred = []

    for record in test_data:
        text = record["text"]
        true_label = record["label"]

        if true_label not in label2id:
            continue

        encoding = tokenizer(
            text,
            max_length=max_length,
            truncation=True,
            padding="max_length",
            return_tensors="pt",
        )

        input_ids = encoding["input_ids"].to(device)
        attention_mask = encoding["attention_mask"].to(device)

        with torch.no_grad():
            _, intent_logits = model(input_ids, attention_mask)
            pred_id = intent_logits.argmax(dim=-1).item()

        pred_label = id2label.get(str(pred_id), id2label.get(pred_id, "UNKNOWN"))
        all_true.append(true_label)
        all_pred.append(pred_label)

    accuracy = accuracy_score(all_true, all_pred)
    micro_f1 = f1_score(all_true, all_pred, average="micro", zero_division=0)
    macro_f1 = f1_score(all_true, all_pred, average="macro", zero_division=0)
    weighted_f1 = f1_score(all_true, all_pred, average="weighted", zero_division=0)

    report_dict = classification_report(all_true, all_pred, output_dict=True, zero_division=0)

    # 按 F1 排序的低分类别
    per_class = {}
    for label in set(all_true):
        if label in report_dict:
            per_class[label] = {
                "precision": round(report_dict[label].get("precision", 0), 4),
                "recall": round(report_dict[label].get("recall", 0), 4),
                "f1-score": round(report_dict[label].get("f1-score", 0), 4),
                "support": report_dict[label].get("support", 0),
            }

    low_f1_classes = sorted(
        [(k, v["f1-score"]) for k, v in per_class.items()],
        key=lambda x: x[1],
    )[:10]

    return {
        "accuracy": round(accuracy, 4),
        "micro_f1": round(micro_f1, 4),
        "macro_f1": round(macro_f1, 4),
        "weighted_f1": round(weighted_f1, 4),
        "total_samples": len(all_true),
        "num_classes": len(set(all_true)),
        "per_class": per_class,
        "low_f1_top10": low_f1_classes,
    }


# ---------------------------------------------------------------------------
# 延迟基准测试
# ---------------------------------------------------------------------------

def benchmark_latency(
    model: MultiTaskModel,
    tokenizer: AutoTokenizer,
    device: str,
    max_length: int,
    num_runs: int,
) -> Dict:
    """CPU/GPU 推理延迟基准。"""
    sample_text = "根据GB2760标准，酸奶中山梨酸钾的最大使用量为0.075g/kg，请问具体规定是什么"

    encoding = tokenizer(
        sample_text,
        max_length=max_length,
        truncation=True,
        padding="max_length",
        return_tensors="pt",
    )
    input_ids = encoding["input_ids"].to(device)
    attention_mask = encoding["attention_mask"].to(device)

    results = {}

    for test_device in ["cpu", "cuda"]:
        if test_device == "cuda" and not torch.cuda.is_available():
            logger.info("跳过 GPU 基准 (CUDA 不可用)")
            continue

        test_model = model.to(test_device)
        test_ids = input_ids.to(test_device)
        test_mask = attention_mask.to(test_device)

        # Warmup
        for _ in range(10):
            with torch.no_grad():
                test_model(test_ids, test_mask)

        if test_device == "cuda":
            torch.cuda.synchronize()

        # Benchmark
        times = []
        for _ in range(num_runs):
            start = time.perf_counter()
            with torch.no_grad():
                test_model(test_ids, test_mask)
            if test_device == "cuda":
                torch.cuda.synchronize()
            elapsed = (time.perf_counter() - start) * 1000
            times.append(elapsed)

        results[test_device] = {
            "mean_ms": round(np.mean(times), 2),
            "p50_ms": round(np.percentile(times, 50), 2),
            "p95_ms": round(np.percentile(times, 95), 2),
            "p99_ms": round(np.percentile(times, 99), 2),
            "min_ms": round(np.min(times), 2),
            "max_ms": round(np.max(times), 2),
        }

        logger.info(
            "%s: mean=%.2f ms | p50=%.2f | p95=%.2f | p99=%.2f",
            test_device.upper(),
            results[test_device]["mean_ms"],
            results[test_device]["p50_ms"],
            results[test_device]["p95_ms"],
            results[test_device]["p99_ms"],
        )

    # 恢复到原始设备
    model.to(device)

    return results


# ---------------------------------------------------------------------------
# 回归测试
# ---------------------------------------------------------------------------

def regression_test(
    current_metrics: Dict,
    baseline_metrics: Optional[Dict],
) -> Dict:
    """
    对比当前模型与基线模型指标。
    """
    if baseline_metrics is None:
        return {"status": "skipped", "reason": "无基线数据"}

    regressions = []
    improvements = []

    metric_pairs = [
        ("intent_accuracy", "accuracy"),
        ("intent_micro_f1", "micro_f1"),
        ("intent_macro_f1", "macro_f1"),
        ("ner_micro_f1", "micro_f1"),
        ("ner_macro_f1", "macro_f1"),
    ]

    for metric_name, sub_key in metric_pairs:
        current_val = None
        baseline_val = None

        # 从当前指标中查找
        if "intent" in metric_name and "intent" in current_metrics:
            current_val = current_metrics["intent"].get(sub_key)
        elif "ner" in metric_name and "ner" in current_metrics:
            current_val = current_metrics["ner"].get(sub_key)

        # 从基线指标中查找
        if "intent" in metric_name and "intent" in baseline_metrics:
            baseline_val = baseline_metrics["intent"].get(sub_key)
        elif "ner" in metric_name and "ner" in baseline_metrics:
            baseline_val = baseline_metrics["ner"].get(sub_key)

        if current_val is not None and baseline_val is not None:
            diff = current_val - baseline_val
            item = {
                "metric": metric_name,
                "current": current_val,
                "baseline": baseline_val,
                "diff": round(diff, 4),
            }
            if diff < -0.01:  # 超过 1% 的下降视为回归
                regressions.append(item)
            elif diff > 0.01:
                improvements.append(item)

    status = "PASS" if not regressions else "REGRESSION"

    return {
        "status": status,
        "regressions": regressions,
        "improvements": improvements,
    }


# ---------------------------------------------------------------------------
# 报告生成
# ---------------------------------------------------------------------------

def generate_markdown_report(results: Dict, output_path: Path) -> None:
    """生成 Markdown 格式的评估报告。"""
    lines = [
        "# 食品领域 NER + Intent 模型评估报告\n",
        f"- 评估时间: {time.strftime('%Y-%m-%d %H:%M:%S')}",
        f"- 设备: {results.get('device', 'unknown')}",
        "",
    ]

    # NER 结果
    if "ner" in results:
        ner = results["ner"]
        lines.extend([
            "## NER 评估结果\n",
            f"| 指标 | 值 |",
            f"|------|------|",
            f"| Micro F1 | {ner['micro_f1']} |",
            f"| Macro F1 | {ner['macro_f1']} |",
            f"| 总 Token 数 | {ner['total_tokens']} |",
            "",
        ])

        if ner.get("entity_type_f1"):
            lines.extend([
                "### 各实体类型 F1\n",
                "| 实体类型 | F1 |",
                "|----------|------|",
            ])
            for etype, f1 in ner["entity_type_f1"].items():
                lines.append(f"| {etype} | {f1} |")
            lines.append("")

    # Intent 结果
    if "intent" in results:
        intent = results["intent"]
        lines.extend([
            "## Intent 评估结果\n",
            f"| 指标 | 值 |",
            f"|------|------|",
            f"| Accuracy | {intent['accuracy']} |",
            f"| Micro F1 | {intent['micro_f1']} |",
            f"| Macro F1 | {intent['macro_f1']} |",
            f"| Weighted F1 | {intent['weighted_f1']} |",
            f"| 总样本数 | {intent['total_samples']} |",
            f"| 类别数 | {intent['num_classes']} |",
            "",
        ])

        if intent.get("low_f1_top10"):
            lines.extend([
                "### F1 最低的 10 个类别\n",
                "| 类别 | F1 |",
                "|------|------|",
            ])
            for label, f1 in intent["low_f1_top10"]:
                lines.append(f"| {label} | {f1} |")
            lines.append("")

    # 延迟
    if "latency" in results:
        lines.extend(["## 推理延迟\n"])
        for dev, metrics in results["latency"].items():
            lines.extend([
                f"### {dev.upper()}\n",
                f"| 指标 | 值 (ms) |",
                f"|------|---------|",
                f"| Mean | {metrics['mean_ms']} |",
                f"| P50 | {metrics['p50_ms']} |",
                f"| P95 | {metrics['p95_ms']} |",
                f"| P99 | {metrics['p99_ms']} |",
                "",
            ])

    # 回归测试
    if "regression" in results:
        reg = results["regression"]
        status_emoji = "PASS" if reg["status"] == "PASS" else "REGRESSION"
        lines.extend([
            f"## 回归测试: {status_emoji}\n",
        ])
        if reg.get("regressions"):
            lines.extend(["### 回归项\n",
                          "| 指标 | 当前 | 基线 | 差值 |",
                          "|------|------|------|------|"])
            for r in reg["regressions"]:
                lines.append(
                    f"| {r['metric']} | {r['current']} | {r['baseline']} | {r['diff']} |"
                )
            lines.append("")
        if reg.get("improvements"):
            lines.extend(["### 提升项\n",
                          "| 指标 | 当前 | 基线 | 差值 |",
                          "|------|------|------|------|"])
            for r in reg["improvements"]:
                lines.append(
                    f"| {r['metric']} | {r['current']} | {r['baseline']} | +{r['diff']} |"
                )
            lines.append("")

    output_path.write_text("\n".join(lines), encoding="utf-8")
    logger.info("Markdown 报告已保存: %s", output_path)


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="综合模型评估: NER + Intent (食品领域)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--model-dir", type=str, required=True, help="模型目录")
    parser.add_argument("--base-model", type=str, default="hfl/chinese-roberta-wwm-ext")
    parser.add_argument("--test-ner", type=str, default=None, help="NER 测试数据 (JSONL)")
    parser.add_argument("--test-intent", type=str, default=None, help="Intent 测试数据 (JSONL)")
    parser.add_argument("--baseline-dir", type=str, default=None, help="基线模型目录 (用于回归测试)")
    parser.add_argument("--baseline-metrics", type=str, default=None, help="基线指标 JSON 文件")
    parser.add_argument("--output-dir", type=str, default="./eval_results", help="评估结果输出目录")
    parser.add_argument("--max-seq-length", type=int, default=DEFAULT_MAX_SEQ_LENGTH)
    parser.add_argument("--latency", action="store_true", help="运行延迟基准测试")
    parser.add_argument("--latency-runs", type=int, default=DEFAULT_LATENCY_RUNS)
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    set_seed(args.seed)
    device = "cuda" if torch.cuda.is_available() else "cpu"

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    logger.info("=" * 60)
    logger.info("食品领域模型综合评估")
    logger.info("模型: %s", args.model_dir)
    logger.info("设备: %s", device)
    logger.info("=" * 60)

    # 加载模型
    model, tokenizer, label_mapping = load_model_and_tokenizer(
        args.model_dir, args.base_model, device,
    )

    results: Dict[str, Any] = {"device": device, "model_dir": args.model_dir}

    # NER 评估
    if args.test_ner:
        logger.info("--- NER 评估 ---")
        ner_data = load_ner_test_data(args.test_ner)
        if ner_data:
            ner_metrics = evaluate_ner(model, tokenizer, ner_data, device, args.max_seq_length)
            results["ner"] = ner_metrics
            logger.info("NER: micro_F1=%.4f, macro_F1=%.4f",
                        ner_metrics["micro_f1"], ner_metrics["macro_f1"])
        else:
            logger.warning("NER 测试数据为空")

    # Intent 评估
    if args.test_intent:
        logger.info("--- Intent 评估 ---")
        intent_data = load_intent_test_data(args.test_intent)

        intent_label2id = label_mapping.get("intent_label2id", {})
        intent_id2label = label_mapping.get("intent_id2label", {})

        # 如果标签映射为空，从测试数据中构建
        if not intent_label2id:
            all_labels = sorted(set(r["label"] for r in intent_data))
            intent_label2id = {l: i for i, l in enumerate(all_labels)}
            intent_id2label = {str(i): l for l, i in intent_label2id.items()}

        if intent_data:
            intent_metrics = evaluate_intent(
                model, tokenizer, intent_data, intent_label2id, intent_id2label,
                device, args.max_seq_length,
            )
            results["intent"] = intent_metrics
            logger.info(
                "Intent: accuracy=%.4f, micro_F1=%.4f, macro_F1=%.4f",
                intent_metrics["accuracy"],
                intent_metrics["micro_f1"],
                intent_metrics["macro_f1"],
            )
        else:
            logger.warning("Intent 测试数据为空")

    # 延迟基准
    if args.latency:
        logger.info("--- 推理延迟基准测试 ---")
        latency = benchmark_latency(
            model, tokenizer, device, args.max_seq_length, args.latency_runs,
        )
        results["latency"] = latency

    # 回归测试
    baseline_metrics = None
    if args.baseline_metrics and Path(args.baseline_metrics).exists():
        with open(args.baseline_metrics, "r", encoding="utf-8") as f:
            baseline_metrics = json.load(f)
    elif args.baseline_dir:
        baseline_json = Path(args.baseline_dir) / "eval_results.json"
        if baseline_json.exists():
            with open(baseline_json, "r", encoding="utf-8") as f:
                baseline_metrics = json.load(f)

    if baseline_metrics:
        logger.info("--- 回归测试 ---")
        reg_results = regression_test(results, baseline_metrics)
        results["regression"] = reg_results
        logger.info("回归测试状态: %s", reg_results["status"])
        if reg_results.get("regressions"):
            for r in reg_results["regressions"]:
                logger.warning(
                    "  回归: %s — 当前 %.4f vs 基线 %.4f (差 %.4f)",
                    r["metric"], r["current"], r["baseline"], r["diff"],
                )
    else:
        results["regression"] = {"status": "skipped", "reason": "无基线数据"}

    # 保存结果
    json_path = output_dir / "eval_results.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2, default=str)
    logger.info("JSON 报告: %s", json_path)

    md_path = output_dir / "eval_report.md"
    generate_markdown_report(results, md_path)

    logger.info("=" * 60)
    logger.info("评估完成!")
    if "ner" in results:
        logger.info("  NER: micro_F1=%.4f, macro_F1=%.4f",
                     results["ner"]["micro_f1"], results["ner"]["macro_f1"])
    if "intent" in results:
        logger.info("  Intent: accuracy=%.4f, F1=%.4f",
                     results["intent"]["accuracy"], results["intent"]["micro_f1"])
    logger.info("  报告目录: %s", output_dir.resolve())
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
