#!/usr/bin/env python3
"""
知识库文档批量导入脚本

从目录中读取文档 (PDF, TXT, HTML)，清洗并调用 food-kb API 导入。

功能:
  - 支持 PDF (PyPDF2 / pdfplumber)、TXT、HTML 格式
  - 文本清洗和规范化
  - 分块处理长文档
  - 批量调用 API 导入
  - 支持 dry-run 模式
  - 详细的导入统计

使用方式:
  python ingest_documents.py --input-dir ./documents --api-url http://localhost:10010/api/food-kb/ingest
  python ingest_documents.py --input-dir ./docs --api-url http://localhost:10010/api/food-kb/ingest --dry-run
  python ingest_documents.py --input-dir ./standards --category 标准 --source GB --batch-size 5
"""

import argparse
import hashlib
import json
import logging
import re
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import requests

# ---------------------------------------------------------------------------
# 日志配置
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("ingest_documents")

# ---------------------------------------------------------------------------
# 常量
# ---------------------------------------------------------------------------
DEFAULT_API_URL = "http://localhost:10010/api/food-kb/ingest"
DEFAULT_BATCH_SIZE = 10
DEFAULT_CHUNK_SIZE = 2000  # 每块最大字符数
DEFAULT_CHUNK_OVERLAP = 200  # 块间重叠字符数
DEFAULT_CATEGORY = "通用"
DEFAULT_SOURCE = "未知"
SUPPORTED_EXTENSIONS = {".pdf", ".txt", ".html", ".htm", ".md"}
REQUEST_TIMEOUT = 60


# ---------------------------------------------------------------------------
# 文档解析器
# ---------------------------------------------------------------------------

def parse_pdf(file_path: Path) -> str:
    """
    解析 PDF 文件，提取文本。
    优先使用 pdfplumber，回退到 PyPDF2。
    """
    text = ""

    # 尝试 pdfplumber (表格提取更好)
    try:
        import pdfplumber
        with pdfplumber.open(file_path) as pdf:
            pages_text = []
            for i, page in enumerate(pdf.pages):
                page_text = page.extract_text()
                if page_text:
                    pages_text.append(page_text)

                # 提取表格
                tables = page.extract_tables()
                for table in tables:
                    if table:
                        for row in table:
                            cells = [str(cell or "").strip() for cell in row]
                            if any(cells):
                                pages_text.append(" | ".join(cells))

            text = "\n\n".join(pages_text)
            logger.debug("pdfplumber 解析成功: %s (%d 页)", file_path.name, len(pdf.pages))
            return text
    except ImportError:
        pass
    except Exception as exc:
        logger.debug("pdfplumber 解析失败: %s — %s", file_path.name, exc)

    # 回退到 PyPDF2
    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(str(file_path))
        pages_text = []
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                pages_text.append(page_text)
        text = "\n\n".join(pages_text)
        logger.debug("PyPDF2 解析成功: %s (%d 页)", file_path.name, len(reader.pages))
    except ImportError:
        logger.error("请安装 PDF 解析库: pip install pdfplumber PyPDF2")
    except Exception as exc:
        logger.error("PDF 解析失败: %s — %s", file_path.name, exc)

    return text


def parse_html(file_path: Path) -> str:
    """解析 HTML 文件，提取纯文本。"""
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        logger.error("请安装 BeautifulSoup: pip install beautifulsoup4")
        return ""

    try:
        # 尝试多种编码
        content = None
        for encoding in ["utf-8", "gbk", "gb2312", "latin-1"]:
            try:
                content = file_path.read_text(encoding=encoding)
                break
            except (UnicodeDecodeError, LookupError):
                continue

        if content is None:
            content = file_path.read_bytes().decode("utf-8", errors="ignore")

        soup = BeautifulSoup(content, "html.parser")

        # 移除脚本和样式
        for tag in soup.find_all(["script", "style", "nav", "footer", "header"]):
            tag.decompose()

        # 提取文本
        text = soup.get_text(separator="\n", strip=True)
        logger.debug("HTML 解析成功: %s", file_path.name)
        return text
    except Exception as exc:
        logger.error("HTML 解析失败: %s — %s", file_path.name, exc)
        return ""


def parse_txt(file_path: Path) -> str:
    """解析纯文本文件。"""
    for encoding in ["utf-8", "gbk", "gb2312", "latin-1"]:
        try:
            return file_path.read_text(encoding=encoding)
        except UnicodeDecodeError:
            continue
    return file_path.read_bytes().decode("utf-8", errors="ignore")


def parse_markdown(file_path: Path) -> str:
    """解析 Markdown 文件 (作为纯文本处理)。"""
    text = parse_txt(file_path)
    # 移除 Markdown 格式标记但保留结构
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)  # 标题
    text = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", text)  # 链接
    text = re.sub(r"[*_]{1,3}([^*_]+)[*_]{1,3}", r"\1", text)  # 加粗/斜体
    text = re.sub(r"```[\s\S]*?```", "", text)  # 代码块
    text = re.sub(r"`([^`]+)`", r"\1", text)  # 行内代码
    return text


PARSERS = {
    ".pdf": parse_pdf,
    ".txt": parse_txt,
    ".html": parse_html,
    ".htm": parse_html,
    ".md": parse_markdown,
}


# ---------------------------------------------------------------------------
# 文本清洗与规范化
# ---------------------------------------------------------------------------

def clean_text(text: str) -> str:
    """
    清洗和规范化文本。

    操作:
      - 统一换行符
      - 移除多余空白
      - 移除控制字符
      - 规范化 Unicode
      - 合并连续空行
    """
    if not text:
        return ""

    # 统一换行符
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    # 移除控制字符 (保留换行和制表符)
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)

    # 全角转半角 (数字和字母)
    result = []
    for char in text:
        code = ord(char)
        if 0xFF01 <= code <= 0xFF5E:
            result.append(chr(code - 0xFEE0))
        elif code == 0x3000:
            result.append(" ")
        else:
            result.append(char)
    text = "".join(result)

    # 移除每行首尾空白
    lines = [line.strip() for line in text.split("\n")]

    # 合并连续空行为一个
    cleaned_lines = []
    prev_empty = False
    for line in lines:
        if not line:
            if not prev_empty:
                cleaned_lines.append("")
            prev_empty = True
        else:
            cleaned_lines.append(line)
            prev_empty = False

    text = "\n".join(cleaned_lines).strip()

    # 最终: 移除连续多个空格
    text = re.sub(r" {3,}", "  ", text)

    return text


# ---------------------------------------------------------------------------
# 文本分块
# ---------------------------------------------------------------------------

def chunk_text(
    text: str,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    overlap: int = DEFAULT_CHUNK_OVERLAP,
) -> List[str]:
    """
    将长文本分割为重叠的块。

    优先在段落边界分割，其次在句子边界。
    """
    if len(text) <= chunk_size:
        return [text]

    chunks = []
    paragraphs = text.split("\n\n")

    current_chunk = ""

    for para in paragraphs:
        # 如果单个段落就超过 chunk_size，需要句子级别分割
        if len(para) > chunk_size:
            # 先保存当前 chunk
            if current_chunk:
                chunks.append(current_chunk.strip())
                # 计算 overlap 部分
                overlap_text = current_chunk[-overlap:] if len(current_chunk) > overlap else current_chunk
                current_chunk = overlap_text

            # 对长段落做句子级分割
            sentences = re.split(r"([。！？；\n])", para)
            for i in range(0, len(sentences), 2):
                sent = sentences[i]
                if i + 1 < len(sentences):
                    sent += sentences[i + 1]

                if len(current_chunk) + len(sent) > chunk_size:
                    if current_chunk:
                        chunks.append(current_chunk.strip())
                        overlap_text = current_chunk[-overlap:] if len(current_chunk) > overlap else current_chunk
                        current_chunk = overlap_text
                current_chunk += sent
        else:
            if len(current_chunk) + len(para) + 2 > chunk_size:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                    overlap_text = current_chunk[-overlap:] if len(current_chunk) > overlap else current_chunk
                    current_chunk = overlap_text

            if current_chunk:
                current_chunk += "\n\n"
            current_chunk += para

    if current_chunk.strip():
        chunks.append(current_chunk.strip())

    # 过滤过短的块
    chunks = [c for c in chunks if len(c) >= 50]

    return chunks


# ---------------------------------------------------------------------------
# API 调用
# ---------------------------------------------------------------------------

def ingest_batch(
    api_url: str,
    documents: List[Dict],
    timeout: int = REQUEST_TIMEOUT,
) -> Tuple[int, int, List[str]]:
    """
    批量调用 API 导入文档。

    Args:
        api_url: API endpoint
        documents: 文档列表，每个包含 text, source, category, metadata

    Returns:
        (success_count, fail_count, error_messages)
    """
    success = 0
    fail = 0
    errors = []

    for doc in documents:
        try:
            resp = requests.post(
                api_url,
                json=doc,
                headers={"Content-Type": "application/json"},
                timeout=timeout,
            )
            if resp.status_code in (200, 201):
                result = resp.json()
                if result.get("success", True):
                    success += 1
                else:
                    fail += 1
                    errors.append(f"{doc.get('source', '?')}: {result.get('message', '未知错误')}")
            else:
                fail += 1
                errors.append(f"{doc.get('source', '?')}: HTTP {resp.status_code}")
        except requests.RequestException as exc:
            fail += 1
            errors.append(f"{doc.get('source', '?')}: {exc}")

    return success, fail, errors


# ---------------------------------------------------------------------------
# 文档扫描与处理
# ---------------------------------------------------------------------------

def scan_documents(input_dir: Path) -> List[Path]:
    """递归扫描目录，找到所有支持的文档。"""
    files = []
    for ext in SUPPORTED_EXTENSIONS:
        files.extend(input_dir.rglob(f"*{ext}"))
    files.sort(key=lambda p: p.name)
    return files


def compute_hash(text: str) -> str:
    """计算文本的 MD5 哈希 (用于去重)。"""
    return hashlib.md5(text.encode("utf-8")).hexdigest()


def process_document(
    file_path: Path,
    category: str,
    source: str,
    chunk_size: int,
    chunk_overlap: int,
) -> List[Dict]:
    """
    处理单个文档: 解析 → 清洗 → 分块 → 构造 API 请求体。
    """
    ext = file_path.suffix.lower()
    parser = PARSERS.get(ext)
    if parser is None:
        logger.warning("不支持的文件格式: %s", file_path)
        return []

    # 解析
    raw_text = parser(file_path)
    if not raw_text or len(raw_text.strip()) < 50:
        logger.warning("文件内容为空或过短: %s (%d 字)", file_path.name, len(raw_text))
        return []

    # 清洗
    cleaned = clean_text(raw_text)
    if len(cleaned) < 50:
        logger.warning("清洗后内容过短: %s (%d 字)", file_path.name, len(cleaned))
        return []

    # 分块
    chunks = chunk_text(cleaned, chunk_size=chunk_size, overlap=chunk_overlap)

    # 构造请求体
    documents = []
    file_source = source if source != DEFAULT_SOURCE else file_path.stem

    for i, chunk in enumerate(chunks):
        doc = {
            "text": chunk,
            "source": file_source,
            "category": category,
            "metadata": {
                "filename": file_path.name,
                "chunk_index": i,
                "total_chunks": len(chunks),
                "char_count": len(chunk),
                "content_hash": compute_hash(chunk),
                "file_format": ext.lstrip("."),
            },
        }
        documents.append(doc)

    return documents


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="知识库文档批量导入脚本 (支持 PDF/TXT/HTML)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--input-dir", "-i", type=str, required=True,
        help="输入文档目录 (递归扫描)",
    )
    parser.add_argument(
        "--api-url", type=str, default=DEFAULT_API_URL,
        help=f"知识库导入 API URL (默认: {DEFAULT_API_URL})",
    )
    parser.add_argument(
        "--category", type=str, default=DEFAULT_CATEGORY,
        help=f"文档分类 (默认: {DEFAULT_CATEGORY})",
    )
    parser.add_argument(
        "--source", type=str, default=DEFAULT_SOURCE,
        help=f"文档来源 (默认: 使用文件名)",
    )
    parser.add_argument(
        "--batch-size", type=int, default=DEFAULT_BATCH_SIZE,
        help=f"每批导入数量 (默认: {DEFAULT_BATCH_SIZE})",
    )
    parser.add_argument(
        "--chunk-size", type=int, default=DEFAULT_CHUNK_SIZE,
        help=f"文本分块大小 (字符, 默认: {DEFAULT_CHUNK_SIZE})",
    )
    parser.add_argument(
        "--chunk-overlap", type=int, default=DEFAULT_CHUNK_OVERLAP,
        help=f"分块重叠字符数 (默认: {DEFAULT_CHUNK_OVERLAP})",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="试运行模式 (不实际调用 API)",
    )
    parser.add_argument(
        "--save-parsed", type=str, default=None,
        help="将解析结果保存为 JSONL 文件 (用于调试)",
    )
    parser.add_argument(
        "--extensions", nargs="+", default=None,
        help="只处理指定扩展名 (如: .pdf .txt)",
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true",
        help="启用详细日志",
    )
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    input_dir = Path(args.input_dir)
    if not input_dir.exists() or not input_dir.is_dir():
        logger.error("输入目录不存在: %s", input_dir)
        sys.exit(1)

    # 过滤扩展名
    if args.extensions:
        global SUPPORTED_EXTENSIONS
        SUPPORTED_EXTENSIONS = {
            ext if ext.startswith(".") else f".{ext}"
            for ext in args.extensions
        }

    logger.info("=" * 60)
    logger.info("知识库文档批量导入")
    logger.info("输入目录: %s", input_dir.resolve())
    logger.info("API URL: %s", args.api_url)
    logger.info("分类: %s", args.category)
    logger.info("分块大小: %d / 重叠: %d", args.chunk_size, args.chunk_overlap)
    logger.info("批次大小: %d", args.batch_size)
    logger.info("Dry run: %s", args.dry_run)
    logger.info("=" * 60)

    # 1. 扫描文件
    files = scan_documents(input_dir)
    logger.info("发现 %d 个文档文件", len(files))

    if not files:
        logger.warning("未找到支持的文档文件")
        return

    # 2. 解析所有文件
    all_documents: List[Dict] = []
    file_stats: Dict[str, Dict] = {}
    seen_hashes = set()

    for file_path in files:
        logger.info("解析: %s", file_path.relative_to(input_dir))
        docs = process_document(
            file_path=file_path,
            category=args.category,
            source=args.source,
            chunk_size=args.chunk_size,
            chunk_overlap=args.chunk_overlap,
        )

        # 去重
        unique_docs = []
        for doc in docs:
            content_hash = doc["metadata"]["content_hash"]
            if content_hash not in seen_hashes:
                seen_hashes.add(content_hash)
                unique_docs.append(doc)

        all_documents.extend(unique_docs)
        file_stats[file_path.name] = {
            "chunks": len(unique_docs),
            "total_chars": sum(len(d["text"]) for d in unique_docs),
            "duplicates_removed": len(docs) - len(unique_docs),
        }

    logger.info("总计 %d 个文档块 (去重后)", len(all_documents))

    # 3. 保存解析结果 (可选)
    if args.save_parsed:
        parsed_path = Path(args.save_parsed)
        parsed_path.parent.mkdir(parents=True, exist_ok=True)
        with open(parsed_path, "w", encoding="utf-8") as f:
            for doc in all_documents:
                f.write(json.dumps(doc, ensure_ascii=False) + "\n")
        logger.info("解析结果已保存: %s", parsed_path)

    # 4. 导入到 API
    total_success = 0
    total_fail = 0
    all_errors: List[str] = []

    if args.dry_run:
        logger.info("[DRY RUN] 将导入 %d 个文档块", len(all_documents))
        for i, doc in enumerate(all_documents[:5]):
            logger.info(
                "  [%d] source=%s, category=%s, chars=%d",
                i, doc["source"], doc["category"], len(doc["text"]),
            )
        if len(all_documents) > 5:
            logger.info("  ... (还有 %d 个)", len(all_documents) - 5)
    else:
        # 批量导入
        num_batches = (len(all_documents) + args.batch_size - 1) // args.batch_size

        for batch_idx in range(num_batches):
            start = batch_idx * args.batch_size
            end = min(start + args.batch_size, len(all_documents))
            batch = all_documents[start:end]

            logger.info(
                "导入批次 %d/%d (文档 %d-%d)",
                batch_idx + 1, num_batches, start + 1, end,
            )

            success, fail, errors = ingest_batch(args.api_url, batch)
            total_success += success
            total_fail += fail
            all_errors.extend(errors)

            if errors:
                for err in errors:
                    logger.warning("  导入错误: %s", err)

            # 批次间延时
            if batch_idx < num_batches - 1:
                time.sleep(0.5)

    # 5. 统计报告
    logger.info("=" * 60)
    logger.info("导入统计:")
    logger.info("-" * 40)

    # 文件级别统计
    total_chars = 0
    for name, stats in sorted(file_stats.items()):
        logger.info(
            "  %s: %d 块, %d 字, 去重 %d",
            name, stats["chunks"], stats["total_chars"], stats["duplicates_removed"],
        )
        total_chars += stats["total_chars"]

    logger.info("-" * 40)
    logger.info("  文件数: %d", len(file_stats))
    logger.info("  文档块数: %d", len(all_documents))
    logger.info("  总字符数: %d", total_chars)

    if not args.dry_run:
        logger.info("  导入成功: %d", total_success)
        logger.info("  导入失败: %d", total_fail)
        if all_errors:
            logger.info("  错误列表:")
            for err in all_errors[:10]:
                logger.info("    - %s", err)
            if len(all_errors) > 10:
                logger.info("    ... (还有 %d 条错误)", len(all_errors) - 10)

    logger.info("=" * 60)


if __name__ == "__main__":
    main()
