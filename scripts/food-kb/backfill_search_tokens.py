#!/usr/bin/env python3
"""
Backfill search_tokens column with jieba-tokenized text for BM25 hybrid search.

This script:
1. Connects to PostgreSQL (cretas_db)
2. Fetches all documents where search_tokens IS NULL
3. Tokenizes title + content using jieba
4. Updates search_tokens column with space-separated tokens
5. Processes in configurable batches with progress reporting

Usage:
    python backfill_search_tokens.py --db-host 47.100.235.168 --db-password cretas123
    python backfill_search_tokens.py --dry-run  # Preview without DB write
    python backfill_search_tokens.py --test     # Test jieba tokenization only

Author: Claude Code
Date: 2026-02-13
"""

import argparse
import sys
import time
from typing import List, Tuple, Optional

try:
    import jieba
    import psycopg2
    from psycopg2.extras import execute_batch
except ImportError as e:
    print(f"Error: Missing required package: {e}")
    print("Install with: pip install jieba psycopg2-binary")
    sys.exit(1)


def tokenize_text(text: str) -> str:
    """
    Tokenize Chinese text using jieba word segmentation.

    Args:
        text: Input text (title + content)

    Returns:
        Space-separated tokens
    """
    if not text or not text.strip():
        return ""

    # jieba.cut returns generator of word tokens
    tokens = jieba.cut(text.strip())

    # Filter out empty tokens and join with spaces
    filtered_tokens = [t for t in tokens if t.strip()]

    return " ".join(filtered_tokens)


def test_tokenization():
    """Test jieba tokenization with sample texts."""
    print("=== Jieba Tokenization Test ===\n")

    test_cases = [
        "山梨酸钾在肉制品中的最大使用量为1.0g/kg",
        "GB 2760-2014 食品添加剂使用标准",
        "食品中农药最大残留限量",
        "婴幼儿配方食品中维生素A的营养强化剂使用规定",
        "冷冻饮品中大肠菌群限量为n=5, c=2, m=10, M=100 CFU/g",
    ]

    for i, text in enumerate(test_cases, 1):
        tokens = tokenize_text(text)
        print(f"Test {i}:")
        print(f"  Input:  {text}")
        print(f"  Tokens: {tokens}")
        print(f"  Count:  {len(tokens.split())} tokens\n")

    print("✓ Tokenization test complete")


def connect_db(host: str, port: int, dbname: str, user: str, password: str) -> psycopg2.extensions.connection:
    """
    Connect to PostgreSQL database.

    Args:
        host: Database host
        port: Database port
        dbname: Database name
        user: Database user
        password: Database password

    Returns:
        psycopg2 connection object
    """
    try:
        conn = psycopg2.connect(
            host=host,
            port=port,
            dbname=dbname,
            user=user,
            password=password,
            connect_timeout=10
        )
        return conn
    except psycopg2.OperationalError as e:
        print(f"❌ Database connection failed: {e}")
        sys.exit(1)


def fetch_documents_to_tokenize(conn: psycopg2.extensions.connection) -> List[Tuple[int, str, str]]:
    """
    Fetch all documents that need tokenization.

    Args:
        conn: Database connection

    Returns:
        List of (id, title, content) tuples
    """
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, title, content
            FROM food_knowledge_documents
            WHERE search_tokens IS NULL
            ORDER BY id
        """)
        return cur.fetchall()


def update_search_tokens_batch(
    conn: psycopg2.extensions.connection,
    updates: List[Tuple[str, int]],
    dry_run: bool = False
) -> int:
    """
    Update search_tokens for a batch of documents.

    Args:
        conn: Database connection
        updates: List of (tokens, doc_id) tuples
        dry_run: If True, skip actual DB write

    Returns:
        Number of rows updated
    """
    if dry_run:
        return len(updates)

    with conn.cursor() as cur:
        execute_batch(
            cur,
            "UPDATE food_knowledge_documents SET search_tokens = %s WHERE id = %s",
            updates,
            page_size=100
        )
        conn.commit()
        return cur.rowcount


def backfill_search_tokens(
    host: str,
    port: int,
    dbname: str,
    user: str,
    password: str,
    batch_size: int = 50,
    dry_run: bool = False
):
    """
    Main backfill process.

    Args:
        host: Database host
        port: Database port
        dbname: Database name
        user: Database user
        password: Database password
        batch_size: Number of documents to process per batch
        dry_run: If True, preview without writing to DB
    """
    print(f"{'[DRY RUN] ' if dry_run else ''}Connecting to {host}:{port}/{dbname}...")

    conn = connect_db(host, port, dbname, user, password)

    try:
        # Fetch documents that need tokenization
        print("Fetching documents where search_tokens IS NULL...")
        documents = fetch_documents_to_tokenize(conn)
        total = len(documents)

        if total == 0:
            print("✓ No documents need tokenization. All done!")
            return

        print(f"Found {total} documents to tokenize")
        print(f"Processing in batches of {batch_size}...\n")

        # Process in batches
        start_time = time.time()
        processed = 0
        batch = []

        for doc_id, title, content in documents:
            # Combine title and content for tokenization
            combined_text = f"{title or ''} {content or ''}".strip()

            # Tokenize
            tokens = tokenize_text(combined_text)

            # Add to batch
            batch.append((tokens, doc_id))

            # Update when batch is full
            if len(batch) >= batch_size:
                update_search_tokens_batch(conn, batch, dry_run)
                processed += len(batch)

                # Progress report
                progress = (processed / total) * 100
                elapsed = time.time() - start_time
                rate = processed / elapsed if elapsed > 0 else 0
                eta = (total - processed) / rate if rate > 0 else 0

                print(f"Progress: {processed}/{total} ({progress:.1f}%) | "
                      f"Rate: {rate:.1f} docs/s | ETA: {eta:.0f}s")

                batch = []

        # Process remaining documents
        if batch:
            update_search_tokens_batch(conn, batch, dry_run)
            processed += len(batch)

        elapsed = time.time() - start_time

        print(f"\n{'[DRY RUN] ' if dry_run else ''}✓ Backfill complete!")
        print(f"  Total documents: {total}")
        print(f"  Processed: {processed}")
        print(f"  Time elapsed: {elapsed:.2f}s")
        print(f"  Average rate: {processed/elapsed:.1f} docs/s")

        if not dry_run:
            # Verify final state
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM food_knowledge_documents WHERE search_tokens IS NULL")
                remaining = cur.fetchone()[0]

                if remaining > 0:
                    print(f"\n⚠️  Warning: {remaining} documents still have NULL search_tokens")
                else:
                    print("\n✓ All documents now have search_tokens!")

    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(
        description="Backfill search_tokens column with jieba-tokenized text",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Backfill on remote server
  python backfill_search_tokens.py --db-host 47.100.235.168 --db-password cretas123

  # Backfill on localhost
  python backfill_search_tokens.py

  # Dry run (preview without writing)
  python backfill_search_tokens.py --dry-run

  # Test jieba tokenization only
  python backfill_search_tokens.py --test
        """
    )

    parser.add_argument('--db-host', default='localhost', help='Database host (default: localhost)')
    parser.add_argument('--db-port', type=int, default=5432, help='Database port (default: 5432)')
    parser.add_argument('--db-name', default='cretas_db', help='Database name (default: cretas_db)')
    parser.add_argument('--db-user', default='cretas_user', help='Database user (default: cretas_user)')
    parser.add_argument('--db-password', default='cretas123', help='Database password (default: cretas123)')
    parser.add_argument('--batch-size', type=int, default=50, help='Batch size (default: 50)')
    parser.add_argument('--dry-run', action='store_true', help='Preview without writing to DB')
    parser.add_argument('--test', action='store_true', help='Test jieba tokenization only (no DB connection)')

    args = parser.parse_args()

    # Test mode: just run tokenization test
    if args.test:
        test_tokenization()
        return

    # Normal mode: backfill search_tokens
    backfill_search_tokens(
        host=args.db_host,
        port=args.db_port,
        dbname=args.db_name,
        user=args.db_user,
        password=args.db_password,
        batch_size=args.batch_size,
        dry_run=args.dry_run
    )


if __name__ == '__main__':
    main()
