"""Export BGE-base-zh-v1.5 to ONNX with CLS pooling + L2 normalization baked in.

The cretas-embedding Java service uses DJL's SentenceEmbeddingTranslator which
supports two output shapes:
  - 2D [batch, hidden_size]: treats as sentence_embedding directly (with optional L2 norm)
  - 3D [batch, seq_len, hidden_size]: applies mean pooling

BGE recommends CLS pooling (first token), not mean pooling. So we wrap the
underlying BertModel with a small module that:
  1. Runs BertModel
  2. Takes CLS token (output[:, 0])
  3. L2 normalizes
  4. Returns 2D sentence embedding

Output ONNX has 1 output (2D) → translator uses path 2D-already-pooled.

Run on server 47:
    cd /www/wwwroot/cretas/code/backend/python && source venv38/bin/activate
    python /tmp/export-bge-onnx.py
"""
from pathlib import Path

import torch
import torch.nn as nn
import torch.nn.functional as F
from transformers import AutoModel, AutoTokenizer

MODEL_DIR = "/tmp/models/models--BAAI--bge-base-zh-v1.5/snapshots/f03589ceff5aac7111bd60cfc7d497ca17ecac65"
OUT_DIR = Path("/tmp/bge-onnx-cls")
OUT_DIR.mkdir(parents=True, exist_ok=True)


class BgeSentenceEmbedding(nn.Module):
    """Wrap BertModel → CLS pooling → L2 normalize, returning 2D embedding."""

    def __init__(self, base_model: nn.Module):
        super().__init__()
        self.base = base_model

    def forward(self, input_ids, attention_mask, token_type_ids):
        out = self.base(
            input_ids=input_ids,
            attention_mask=attention_mask,
            token_type_ids=token_type_ids,
        )
        # last_hidden_state shape [batch, seq_len, hidden]
        cls = out.last_hidden_state[:, 0]
        # L2 normalize for cosine similarity
        return F.normalize(cls, p=2, dim=1)


def main():
    print(f"Loading model from {MODEL_DIR}")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_DIR)
    base = AutoModel.from_pretrained(MODEL_DIR)
    base.eval()

    wrapped = BgeSentenceEmbedding(base)
    wrapped.eval()

    # Sanity: forward pass on dummy input
    dummy = tokenizer(
        ["测试输入用于 ONNX 导出"],
        padding="max_length",
        truncation=True,
        max_length=128,
        return_tensors="pt",
    )
    with torch.no_grad():
        out = wrapped(dummy["input_ids"], dummy["attention_mask"], dummy["token_type_ids"])
    print(f"Sanity forward: shape={tuple(out.shape)}, norm={out.norm().item():.4f}")

    # Export ONNX
    onnx_path = OUT_DIR / "model.onnx"
    print(f"Exporting to {onnx_path}")
    torch.onnx.export(
        wrapped,
        (dummy["input_ids"], dummy["attention_mask"], dummy["token_type_ids"]),
        onnx_path,
        opset_version=14,
        input_names=["input_ids", "attention_mask", "token_type_ids"],
        output_names=["sentence_embedding"],
        dynamic_axes={
            "input_ids": {0: "batch", 1: "seq"},
            "attention_mask": {0: "batch", 1: "seq"},
            "token_type_ids": {0: "batch", 1: "seq"},
            "sentence_embedding": {0: "batch"},
        },
        do_constant_folding=True,
    )

    # Copy tokenizer + config files
    import shutil
    src_dir = Path(MODEL_DIR)
    for fn in ["tokenizer.json", "tokenizer_config.json", "special_tokens_map.json", "vocab.txt", "config.json"]:
        src = src_dir / fn
        if src.exists():
            shutil.copy(src, OUT_DIR / fn)
            print(f"  Copied {fn}")

    print(f"\nDone. Model directory: {OUT_DIR}")
    # Verify ONNX inputs/outputs
    import onnx
    m = onnx.load(str(onnx_path))
    print("ONNX inputs:", [(i.name, [d.dim_param or d.dim_value for d in i.type.tensor_type.shape.dim]) for i in m.graph.input])
    print("ONNX outputs:", [(o.name, [d.dim_param or d.dim_value for d in o.type.tensor_type.shape.dim]) for o in m.graph.output])


if __name__ == "__main__":
    main()
