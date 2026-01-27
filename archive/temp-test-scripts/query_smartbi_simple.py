#!/usr/bin/env python3
"""
Simple query to show SmartBI uploaded data via direct SQL
"""

import pymysql
import json
from datetime import datetime

# Database config
DB_CONFIG = {
    'host': '139.196.165.140',
    'user': 'cretas',
    'password': 'Zhujie1006@',
    'database': 'cretas_food_trace',
    'charset': 'utf8mb4'
}

def query_smartbi_uploads():
    """Query SmartBI upload records"""
    try:
        conn = pymysql.connect(**DB_CONFIG)
        cursor = conn.cursor(pymysql.cursors.DictCursor)

        # Query upload records
        query = """
        SELECT
            id,
            factory_id,
            file_name,
            sheet_name,
            data_type,
            row_count,
            recommended_chart_type,
            status,
            ai_analysis,
            created_at
        FROM smart_bi_upload
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 10
        """

        cursor.execute(query)
        uploads = cursor.fetchall()

        print("="*60)
        print(f"[SmartBI] Found {len(uploads)} upload records")
        print("="*60)

        for idx, upload in enumerate(uploads, 1):
            print(f"\n[{idx}] Upload ID: {upload['id']}")
            print(f"    Factory: {upload['factory_id']}")
            print(f"    File: {upload['file_name']}")
            print(f"    Sheet: {upload['sheet_name']}")
            print(f"    Type: {upload['data_type']}")
            print(f"    Rows: {upload['row_count']}")
            print(f"    Chart: {upload['recommended_chart_type']}")
            print(f"    Status: {upload['status']}")
            print(f"    Time: {upload['created_at']}")

            # AI Analysis preview
            ai = upload.get('ai_analysis', '')
            if ai:
                preview = ai[:200] + "..." if len(ai) > 200 else ai
                print(f"    AI Analysis: {preview}")

        cursor.close()
        conn.close()

        return uploads

    except Exception as e:
        print(f"[ERROR] Query failed: {e}")
        return []

def query_finance_data():
    """Query finance data counts"""
    try:
        conn = pymysql.connect(**DB_CONFIG)
        cursor = conn.cursor(pymysql.cursors.DictCursor)

        query = """
        SELECT
            upload_id,
            COUNT(*) as row_count
        FROM smart_bi_finance_data
        WHERE deleted_at IS NULL
        GROUP BY upload_id
        ORDER BY upload_id DESC
        """

        cursor.execute(query)
        results = cursor.fetchall()

        print("\n" + "="*60)
        print(f"[Finance Data] Rows per upload")
        print("="*60)

        for result in results:
            print(f"Upload ID {result['upload_id']}: {result['row_count']} rows")

        cursor.close()
        conn.close()

        return results

    except Exception as e:
        print(f"[ERROR] Query failed: {e}")
        return []

def query_sales_data():
    """Query sales data counts"""
    try:
        conn = pymysql.connect(**DB_CONFIG)
        cursor = conn.cursor(pymysql.cursors.DictCursor)

        query = """
        SELECT
            upload_id,
            COUNT(*) as row_count
        FROM smart_bi_sales_data
        WHERE deleted_at IS NULL
        GROUP BY upload_id
        ORDER BY upload_id DESC
        """

        cursor.execute(query)
        results = cursor.fetchall()

        print("\n" + "="*60)
        print(f"[Sales Data] Rows per upload")
        print("="*60)

        for result in results:
            print(f"Upload ID {result['upload_id']}: {result['row_count']} rows")

        cursor.close()
        conn.close()

        return results

    except Exception as e:
        print(f"[ERROR] Query failed: {e}")
        return []

def main():
    print("==> Querying SmartBI Data from Database...")

    # 1. Query upload records
    uploads = query_smartbi_uploads()

    # 2. Query finance data
    query_finance_data()

    # 3. Query sales data
    query_sales_data()

    print("\n==> Query complete\n")

if __name__ == "__main__":
    main()
