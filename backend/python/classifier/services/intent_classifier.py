"""
Intent Classifier Service

基于 chinese-roberta-wwm-ext 的意图分类器服务
用于 B2B 食品行业意图识别
"""
import json
import logging
from pathlib import Path
from typing import List, Optional

import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification

logger = logging.getLogger(__name__)


class IntentClassifierService:
    """意图分类器服务"""

    def __init__(self, model_path: Optional[str] = None):
        """
        初始化分类器

        Args:
            model_path: 模型路径，如果为 None 则使用默认路径
        """
        self.model = None
        self.tokenizer = None
        self.label_mapping = None
        self.id_to_label = None
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self._loaded = False

        if model_path:
            self.load_model(model_path)

    def load_model(self, model_path: str) -> bool:
        """
        加载模型

        Args:
            model_path: 模型目录路径

        Returns:
            是否加载成功
        """
        try:
            model_dir = Path(model_path)

            if not model_dir.exists():
                logger.error(f"模型目录不存在: {model_path}")
                return False

            # 加载标签映射
            label_mapping_path = model_dir / "label_mapping.json"
            if label_mapping_path.exists():
                with open(label_mapping_path, 'r', encoding='utf-8') as f:
                    self.label_mapping = json.load(f)
                    self.id_to_label = {v: k for k, v in self.label_mapping.get("label_to_id", {}).items()}
                logger.info(f"加载标签映射: {len(self.id_to_label)} 个标签")
            else:
                logger.warning("标签映射文件不存在")

            # 加载 tokenizer
            logger.info(f"加载 tokenizer: {model_path}")
            self.tokenizer = AutoTokenizer.from_pretrained(str(model_dir))

            # 加载模型
            logger.info(f"加载模型: {model_path}")
            self.model = AutoModelForSequenceClassification.from_pretrained(str(model_dir))
            self.model.to(self.device)
            self.model.eval()

            self._loaded = True
            logger.info(f"模型加载完成，设备: {self.device}")
            return True

        except Exception as e:
            logger.error(f"加载模型失败: {e}")
            return False

    def is_loaded(self) -> bool:
        """检查模型是否已加载"""
        return self._loaded

    def classify(self, text: str, top_k: int = 3) -> dict:
        """
        对文本进行意图分类

        Args:
            text: 输入文本
            top_k: 返回 top-k 个结果

        Returns:
            分类结果，包含 intents 列表和 top_intent
        """
        if not self._loaded:
            return {
                "success": False,
                "message": "模型未加载",
                "intents": [],
                "top_intent": None
            }

        try:
            # Tokenize
            inputs = self.tokenizer(
                text,
                truncation=True,
                padding=True,
                max_length=128,
                return_tensors="pt"
            )
            inputs = {k: v.to(self.device) for k, v in inputs.items()}

            # Inference
            with torch.no_grad():
                outputs = self.model(**inputs)
                logits = outputs.logits

            # Softmax 转换为概率
            probs = torch.softmax(logits, dim=-1)

            # 获取 top-k 结果
            top_k = min(top_k, probs.shape[-1])
            top_probs, top_indices = torch.topk(probs[0], k=top_k)

            intents = []
            for prob, idx in zip(top_probs.cpu().numpy(), top_indices.cpu().numpy()):
                intent_code = self.id_to_label.get(int(idx), f"UNKNOWN_{idx}")
                intents.append({
                    "intent_code": intent_code,
                    "confidence": float(prob),
                    "label_id": int(idx)
                })

            return {
                "success": True,
                "text": text,
                "intents": intents,
                "top_intent": intents[0] if intents else None,
                "device": str(self.device)
            }

        except Exception as e:
            logger.error(f"分类失败: {e}")
            return {
                "success": False,
                "message": str(e),
                "intents": [],
                "top_intent": None
            }

    def classify_batch(self, texts: List[str], top_k: int = 1) -> List[dict]:
        """
        批量分类

        Args:
            texts: 文本列表
            top_k: 每个文本返回 top-k 个结果

        Returns:
            分类结果列表
        """
        if not self._loaded:
            return [{"success": False, "message": "模型未加载"} for _ in texts]

        try:
            # Tokenize all texts
            inputs = self.tokenizer(
                texts,
                truncation=True,
                padding=True,
                max_length=128,
                return_tensors="pt"
            )
            inputs = {k: v.to(self.device) for k, v in inputs.items()}

            # Inference
            with torch.no_grad():
                outputs = self.model(**inputs)
                logits = outputs.logits

            # Softmax
            probs = torch.softmax(logits, dim=-1)

            results = []
            for i, text in enumerate(texts):
                top_probs, top_indices = torch.topk(probs[i], k=min(top_k, probs.shape[-1]))

                intents = []
                for prob, idx in zip(top_probs.cpu().numpy(), top_indices.cpu().numpy()):
                    intent_code = self.id_to_label.get(int(idx), f"UNKNOWN_{idx}")
                    intents.append({
                        "intent_code": intent_code,
                        "confidence": float(prob),
                        "label_id": int(idx)
                    })

                results.append({
                    "success": True,
                    "text": text,
                    "intents": intents,
                    "top_intent": intents[0] if intents else None
                })

            return results

        except Exception as e:
            logger.error(f"批量分类失败: {e}")
            return [{"success": False, "message": str(e)} for _ in texts]

    def get_model_info(self) -> dict:
        """获取模型信息"""
        if not self._loaded:
            return {
                "loaded": False,
                "message": "模型未加载"
            }

        return {
            "loaded": True,
            "device": str(self.device),
            "num_labels": len(self.id_to_label) if self.id_to_label else 0,
            "model_type": type(self.model).__name__ if self.model else None
        }


# 全局分类器实例
_classifier_instance: Optional[IntentClassifierService] = None


def get_classifier() -> IntentClassifierService:
    """获取全局分类器实例"""
    global _classifier_instance

    if _classifier_instance is None:
        _classifier_instance = IntentClassifierService()

        # 尝试加载默认模型路径
        default_paths = [
            # 生产环境路径
            "/www/wwwroot/python-services/models/chinese-roberta-wwm-ext-classifier/final",
            "/www/wwwroot/smartbi/models/chinese-roberta-wwm-ext-classifier/final",
            # 开发环境路径 (Windows)
            "C:/Users/Steve/my-prototype-logistics/scripts/finetune/models/chinese-roberta-wwm-ext-classifier/final",
            # 相对路径
            "../scripts/finetune/models/chinese-roberta-wwm-ext-classifier/final",
            "./models/chinese-roberta-wwm-ext-classifier/final"
        ]

        for path in default_paths:
            if Path(path).exists():
                logger.info(f"发现模型: {path}")
                if _classifier_instance.load_model(path):
                    break

        if not _classifier_instance.is_loaded():
            logger.warning("未能加载默认模型，分类器服务未就绪")

    return _classifier_instance
