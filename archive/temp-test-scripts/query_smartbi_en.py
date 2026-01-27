#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Query SmartBI Upload Data and Analysis
"""

import requests
import json
import sys

# Set UTF-8 encoding for Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Config
BASE_URL = "http://139.196.165.140:10010"
FACTORY_ID = "F001"

def login():
    """Login and get access token"""
    login_url = f"{BASE_URL}/api/mobile/auth/unified-login"
    payload = {
        "username": "factory_admin1",
        "password": "123456"
    }

    try:
        response = requests.post(login_url, json=payload)
        data = response.json()

        if data.get('success') and data.get('data'):
            token = data['data'].get('accessToken')
            print("[OK] Login successful, token acquired")
            return token
        else:
            print(f"[FAIL] Login failed: {data}")
            return None
    except Exception as e:
        print(f"[ERROR] Login exception: {e}")
        return None

def query_dashboard(token):
    """Query dashboard data"""
    url = f"{BASE_URL}/api/mobile/{FACTORY_ID}/smart-bi/dashboard"
    headers = {"Authorization": f"Bearer {token}"}

    try:
        response = requests.get(url, headers=headers)
        data = response.json()

        if data.get('success'):
            dashboard = data.get('data', {})
            print("\n" + "="*60)
            print("[Dashboard] SmartBI Data Overview")
            print("="*60)
            print(f"Total Uploads: {dashboard.get('totalUploads', 0)}")
            print(f"Total Rows: {dashboard.get('totalRows', 0)}")
            print(f"Data Type Distribution:")
            for dtype, count in dashboard.get('dataTypeDistribution', {}).items():
                print(f"  - {dtype}: {count} uploads")
            print(f"Last Upload: {dashboard.get('lastUploadTime', 'N/A')}")

            # KPI data
            kpis = dashboard.get('kpis', {})
            if kpis:
                print(f"\n[KPI] Key Metrics:")
                for key, value in kpis.items():
                    print(f"  - {key}: {value}")

            return dashboard
        else:
            print(f"[FAIL] Query failed: {data.get('message')}")
            return None
    except Exception as e:
        print(f"[ERROR] Query exception: {e}")
        return None

def query_uploads(token):
    """Query upload history"""
    url = f"{BASE_URL}/api/mobile/{FACTORY_ID}/smart-bi/uploads"
    headers = {"Authorization": f"Bearer {token}"}
    params = {"page": 0, "size": 10}

    try:
        response = requests.get(url, headers=headers, params=params)
        data = response.json()

        if data.get('success'):
            uploads_data = data.get('data', {})
            uploads = uploads_data.get('content', [])

            print("\n" + "="*60)
            print(f"[Upload History] Recent {len(uploads)} uploads")
            print("="*60)

            for idx, upload in enumerate(uploads, 1):
                print(f"\n[{idx}] Upload ID: {upload.get('id')}")
                print(f"    File: {upload.get('fileName')}")
                print(f"    Sheet: {upload.get('sheetName')}")
                print(f"    Type: {upload.get('dataType')}")
                print(f"    Rows: {upload.get('rowCount')}")
                print(f"    Chart: {upload.get('recommendedChartType')}")
                print(f"    Status: {upload.get('status')}")
                print(f"    Time: {upload.get('createdAt')}")

                # AI analysis preview
                ai_analysis = upload.get('aiAnalysis', '')
                if ai_analysis:
                    preview = ai_analysis[:150] + "..." if len(ai_analysis) > 150 else ai_analysis
                    print(f"    AI: {preview}")

            return uploads
        else:
            print(f"[FAIL] Query failed: {data.get('message')}")
            return None
    except Exception as e:
        print(f"[ERROR] Query exception: {e}")
        return None

def query_chart_config(token, upload_id):
    """Query chart configuration for an upload"""
    url = f"{BASE_URL}/api/mobile/{FACTORY_ID}/smart-bi/uploads/{upload_id}/chart"
    headers = {"Authorization": f"Bearer {token}"}

    try:
        response = requests.get(url, headers=headers)
        data = response.json()

        if data.get('success'):
            chart = data.get('data', {})
            print("\n" + "="*60)
            print(f"[Chart Config] Upload ID: {upload_id}")
            print("="*60)
            print(json.dumps(chart, indent=2, ensure_ascii=False))
            return chart
        else:
            print(f"[FAIL] Query failed: {data.get('message')}")
            return None
    except Exception as e:
        print(f"[INFO] No chart config endpoint or error: {e}")
        return None

def main():
    print("==> Starting SmartBI Data Query...")

    # 1. Login
    token = login()
    if not token:
        print("Cannot get token, exiting")
        return

    # 2. Query dashboard
    dashboard = query_dashboard(token)

    # 3. Query upload history
    uploads = query_uploads(token)

    # 4. Query chart config for latest upload
    if uploads and len(uploads) > 0:
        latest_upload_id = uploads[0].get('id')
        if latest_upload_id:
            query_chart_config(token, latest_upload_id)

    print("\n==> Query complete")

if __name__ == "__main__":
    main()
