#!/usr/bin/env python3
"""
Flan-T5 本地 GPU 微调脚本

用法:
    1. 从服务器下载训练数据:
       curl "http://139.196.165.140:10010/api/admin/discriminator/export-training-data?factoryId=F001&includeSynthetic=true" > intent_judge_train.csv

    2. 运行微调:
       python flan_t5_local_finetune.py

    3. 将 ONNX 模型上传服务器:
       scp -r flan-t5-intent-judge-onnx root@139.196.165.140:/www/wwwroot/cretas/models/

环境要求:
    pip install transformers datasets accelerate peft bitsandbytes
    pip install optimum[onnxruntime] onnx onnxruntime scikit-learn pandas
"""

import os
import sys
import torch
import pandas as pd
import argparse
from pathlib import Path
from datetime import datetime
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from datasets import Dataset
from transformers import (
    T5Tokenizer,
    T5ForConditionalGeneration,
    Seq2SeqTrainingArguments,
    Seq2SeqTrainer,
    DataCollatorForSeq2Seq
)
from peft import LoraConfig, get_peft_model, TaskType


def check_environment():
    """检查 GPU 环境"""
    print("=" * 60)
    print("环境检查")
    print("=" * 60)

    if torch.cuda.is_available():
        print(f"✓ GPU 可用: {torch.cuda.get_device_name(0)}")
        print(f"✓ 显存: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")
        print(f"✓ CUDA 版本: {torch.version.cuda}")
    else:
        print("✗ 未检测到 GPU，将使用 CPU (非常慢)")
        response = input("是否继续? (y/N): ")
        if response.lower() != 'y':
            sys.exit(1)

    print()


def load_training_data(train_path: str, test_size: float = 0.15):
    """加载并分割训练数据"""
    print("=" * 60)
    print("加载数据")
    print("=" * 60)

    df = pd.read_csv(train_path, comment='#')
    print(f"✓ 总样本数: {len(df)}")
    print(f"  - 正样本: {len(df[df['label'] == 1])}")
    print(f"  - 负样本: {len(df[df['label'] == 0])}")

    # 分割数据
    train_df, valid_df = train_test_split(df, test_size=test_size, random_state=42, stratify=df['label'])
    print(f"✓ 训练集: {len(train_df)} 条")
    print(f"✓ 验证集: {len(valid_df)} 条")
    print()

    return train_df, valid_df


def prepare_dataset(df: pd.DataFrame) -> Dataset:
    """将数据转换为 T5 格式"""
    inputs = []
    targets = []

    for _, row in df.iterrows():
        # 输入格式: "判断用户输入是否匹配意图。用户输入: {input} 意图: {intent} - {description}"
        input_text = f"判断用户输入是否匹配意图。用户输入: {row['user_input']} 意图: {row['intent_code']} - {row['intent_description']}"
        # 输出格式: "是" 或 "否"
        target_text = "是" if row['label'] == 1 else "否"

        inputs.append(input_text)
        targets.append(target_text)

    return Dataset.from_dict({
        'input_text': inputs,
        'target_text': targets
    })


def train_model(
    train_df: pd.DataFrame,
    valid_df: pd.DataFrame,
    output_dir: str = "./flan-t5-intent-judge",
    model_name: str = "google/flan-t5-base",
    epochs: int = 10,
    batch_size: int = 8,
    learning_rate: float = 3e-4,
    lora_r: int = 16,
    lora_alpha: int = 32,
):
    """训练模型"""
    print("=" * 60)
    print("模型训练")
    print("=" * 60)

    # 加载 tokenizer 和模型
    print(f"加载模型: {model_name}...")
    tokenizer = T5Tokenizer.from_pretrained(model_name)
    model = T5ForConditionalGeneration.from_pretrained(
        model_name,
        torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
        device_map="auto" if torch.cuda.is_available() else None
    )
    print(f"✓ 模型参数量: {model.num_parameters() / 1e6:.1f}M")

    # LoRA 配置
    lora_config = LoraConfig(
        task_type=TaskType.SEQ_2_SEQ_LM,
        r=lora_r,
        lora_alpha=lora_alpha,
        lora_dropout=0.1,
        target_modules=["q", "v"],
    )

    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    # 准备数据集
    print("\n准备数据集...")
    train_dataset = prepare_dataset(train_df)
    valid_dataset = prepare_dataset(valid_df)

    # Tokenization
    MAX_INPUT_LENGTH = 256
    MAX_TARGET_LENGTH = 8

    def tokenize_function(examples):
        model_inputs = tokenizer(
            examples['input_text'],
            max_length=MAX_INPUT_LENGTH,
            truncation=True,
            padding='max_length'
        )

        with tokenizer.as_target_tokenizer():
            labels = tokenizer(
                examples['target_text'],
                max_length=MAX_TARGET_LENGTH,
                truncation=True,
                padding='max_length'
            )

        model_inputs['labels'] = labels['input_ids']
        return model_inputs

    train_tokenized = train_dataset.map(tokenize_function, batched=True)
    valid_tokenized = valid_dataset.map(tokenize_function, batched=True)

    # 训练参数
    training_args = Seq2SeqTrainingArguments(
        output_dir=output_dir,
        num_train_epochs=epochs,
        per_device_train_batch_size=batch_size,
        per_device_eval_batch_size=batch_size,
        learning_rate=learning_rate,
        warmup_steps=100,
        weight_decay=0.01,
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        logging_steps=10,
        report_to="none",
        fp16=torch.cuda.is_available(),
        gradient_accumulation_steps=2,
        predict_with_generate=True,
        generation_max_length=MAX_TARGET_LENGTH,
    )

    data_collator = DataCollatorForSeq2Seq(
        tokenizer,
        model=model,
        label_pad_token_id=-100
    )

    trainer = Seq2SeqTrainer(
        model=model,
        args=training_args,
        train_dataset=train_tokenized,
        eval_dataset=valid_tokenized,
        tokenizer=tokenizer,
        data_collator=data_collator,
    )

    print("\n开始训练...")
    trainer.train()

    return model, tokenizer, valid_tokenized, valid_df


def evaluate_model(model, tokenizer, valid_tokenized, valid_df):
    """评估模型"""
    print("\n" + "=" * 60)
    print("模型评估")
    print("=" * 60)

    model.eval()
    predictions = []

    for i, example in enumerate(valid_tokenized):
        input_ids = torch.tensor([example['input_ids']]).to(model.device)

        with torch.no_grad():
            outputs = model.generate(
                input_ids,
                max_length=8,
                num_beams=1,
                do_sample=False
            )

        pred_text = tokenizer.decode(outputs[0], skip_special_tokens=True)
        pred_label = 1 if "是" in pred_text else 0
        predictions.append(pred_label)

        if (i + 1) % 100 == 0:
            print(f"  评估进度: {i + 1}/{len(valid_tokenized)}")

    true_labels = valid_df['label'].tolist()
    accuracy = accuracy_score(true_labels, predictions)

    print(f"\n准确率: {accuracy:.4f}")
    print("\n分类报告:")
    print(classification_report(true_labels, predictions, target_names=['否', '是']))

    print("\n混淆矩阵:")
    print(confusion_matrix(true_labels, predictions))

    return accuracy, predictions


def export_onnx(model, tokenizer, merged_dir: str, onnx_dir: str):
    """导出 ONNX 模型"""
    print("\n" + "=" * 60)
    print("导出 ONNX")
    print("=" * 60)

    # 合并 LoRA 权重
    print("合并 LoRA 权重...")
    merged_model = model.merge_and_unload()
    merged_model.save_pretrained(merged_dir)
    tokenizer.save_pretrained(merged_dir)
    print(f"✓ 完整模型已保存到: {merged_dir}")

    # 导出 ONNX
    print("\n导出 ONNX 模型...")
    try:
        from optimum.onnxruntime import ORTModelForSeq2SeqLM

        ort_model = ORTModelForSeq2SeqLM.from_pretrained(
            merged_dir,
            export=True
        )
        ort_model.save_pretrained(onnx_dir)
        tokenizer.save_pretrained(onnx_dir)
        print(f"✓ ONNX 模型已保存到: {onnx_dir}")

        # 显示文件大小
        print("\nONNX 文件:")
        for f in os.listdir(onnx_dir):
            path = os.path.join(onnx_dir, f)
            if os.path.isfile(path):
                size = os.path.getsize(path) / 1024 / 1024
                print(f"  {f}: {size:.1f} MB")

    except ImportError:
        print("✗ 未安装 optimum，跳过 ONNX 导出")
        print("  安装命令: pip install optimum[onnxruntime]")


def test_onnx_inference(onnx_dir: str):
    """测试 ONNX 推理"""
    print("\n" + "=" * 60)
    print("ONNX 推理测试")
    print("=" * 60)

    try:
        from optimum.onnxruntime import ORTModelForSeq2SeqLM
        import time

        onnx_model = ORTModelForSeq2SeqLM.from_pretrained(onnx_dir)
        onnx_tokenizer = T5Tokenizer.from_pretrained(onnx_dir)

        test_cases = [
            ("这个月销售怎么样", "sales_overview", "销售情况概览查询", 1),
            ("删除这条记录", "sales_overview", "销售情况概览查询", 0),
            ("查一下库存", "material_query", "原料库存查询", 1),
        ]

        print("\n测试用例:")
        for text, intent, desc, expected in test_cases:
            prompt = f"判断用户输入是否匹配意图。用户输入: {text} 意图: {intent} - {desc}"
            inputs = onnx_tokenizer(prompt, return_tensors="pt")

            start = time.time()
            outputs = onnx_model.generate(**inputs, max_length=8)
            latency = (time.time() - start) * 1000

            result = onnx_tokenizer.decode(outputs[0], skip_special_tokens=True)
            pred = 1 if "是" in result else 0
            status = "✓" if pred == expected else "✗"

            print(f"  {status} 输入: {text}")
            print(f"    意图: {intent}")
            print(f"    判断: {result} (期望: {'是' if expected else '否'})")
            print(f"    延迟: {latency:.1f}ms")
            print()

    except Exception as e:
        print(f"ONNX 测试失败: {e}")


def main():
    parser = argparse.ArgumentParser(description='Flan-T5 本地 GPU 微调')
    parser.add_argument('--train-data', type=str, default='intent_judge_train.csv',
                        help='训练数据 CSV 文件路径')
    parser.add_argument('--output-dir', type=str, default='./flan-t5-intent-judge',
                        help='模型输出目录')
    parser.add_argument('--epochs', type=int, default=10, help='训练轮数')
    parser.add_argument('--batch-size', type=int, default=8, help='批次大小')
    parser.add_argument('--lr', type=float, default=3e-4, help='学习率')
    parser.add_argument('--skip-onnx', action='store_true', help='跳过 ONNX 导出')

    args = parser.parse_args()

    print("\n" + "=" * 60)
    print("Flan-T5 意图判别器微调")
    print(f"时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60 + "\n")

    # 检查环境
    check_environment()

    # 检查训练数据
    if not os.path.exists(args.train_data):
        print(f"✗ 训练数据不存在: {args.train_data}")
        print("\n请先从服务器下载训练数据:")
        print('  curl "http://139.196.165.140:10010/api/admin/discriminator/export-training-data?factoryId=F001" > intent_judge_train.csv')
        sys.exit(1)

    # 加载数据
    train_df, valid_df = load_training_data(args.train_data)

    # 训练
    model, tokenizer, valid_tokenized, valid_df = train_model(
        train_df, valid_df,
        output_dir=args.output_dir,
        epochs=args.epochs,
        batch_size=args.batch_size,
        learning_rate=args.lr
    )

    # 评估
    accuracy, _ = evaluate_model(model, tokenizer, valid_tokenized, valid_df)

    # 导出 ONNX
    if not args.skip_onnx:
        merged_dir = f"{args.output_dir}-merged"
        onnx_dir = f"{args.output_dir}-onnx"
        export_onnx(model, tokenizer, merged_dir, onnx_dir)
        test_onnx_inference(onnx_dir)

    print("\n" + "=" * 60)
    print("完成!")
    print("=" * 60)
    print(f"\n下一步: 上传 ONNX 模型到服务器:")
    print(f"  scp -r {args.output_dir}-onnx root@139.196.165.140:/www/wwwroot/cretas/models/flan-t5-base")


if __name__ == '__main__':
    main()
