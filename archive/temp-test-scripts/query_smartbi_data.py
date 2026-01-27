#!/usr/bin/env python3
"""
查询 SmartBI 上传数据和分析结果
"""

import requests
import json
from datetime import datetime

# 配置
BASE_URL = "http://139.196.165.140:10010"
FACTORY_ID = "F001"

# 测试账号登录获取 token
def login():
    """登录获取访问令牌"""
    login_url = f"{BASE_URL}/api/mobile/auth/login"
    payload = {
        "username": "factory_admin1",
        "password": "123456"
    }

    try:
        response = requests.post(login_url, json=payload)
        data = response.json()

        if data.get('success') and data.get('data'):
            token = data['data'].get('accessToken')
            print(f"[OK] 登录成功，获取 Token")
            return token
        else:
            print(f"[FAIL] 登录失败: {data.get('message')}")
            return None
    except Exception as e:
        print(f"[ERROR] 登录异常: {e}")
        return None

def query_dashboard(token):
    """查询仪表盘数据"""
    url = f"{BASE_URL}/api/mobile/{FACTORY_ID}/smart-bi/dashboard"
    headers = {"Authorization": f"Bearer {token}"}

    try:
        response = requests.get(url, headers=headers)
        data = response.json()

        if data.get('success'):
            dashboard = data.get('data', {})
            print("\n" + "="*60)
            print("[仪表盘] SmartBI 数据概览")
            print("="*60)
            print(f"总上传次数: {dashboard.get('totalUploads', 0)}")
            print(f"总数据行数: {dashboard.get('totalRows', 0)}")
            print(f"数据类型分布:")
            for dtype, count in dashboard.get('dataTypeDistribution', {}).items():
                print(f"  - {dtype}: {count} 次上传")
            print(f"最近上传时间: {dashboard.get('lastUploadTime', 'N/A')}")

            # KPI 数据
            kpis = dashboard.get('kpis', {})
            if kpis:
                print(f"\n[KPI] 关键指标:")
                for key, value in kpis.items():
                    print(f"  - {key}: {value}")

            return dashboard
        else:
            print(f"[FAIL] 查询失败: {data.get('message')}")
            return None
    except Exception as e:
        print(f"[ERROR] 查询异常: {e}")
        return None

def query_uploads(token):
    """查询上传历史"""
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
            print(f"[上传记录] 最近 {len(uploads)} 次上传")
            print("="*60)

            for idx, upload in enumerate(uploads, 1):
                print(f"\n[{idx}] 上传ID: {upload.get('id')}")
                print(f"    文件名: {upload.get('fileName')}")
                print(f"    Sheet名: {upload.get('sheetName')}")
                print(f"    数据类型: {upload.get('dataType')}")
                print(f"    行数: {upload.get('rowCount')}")
                print(f"    推荐图表: {upload.get('recommendedChartType')}")
                print(f"    状态: {upload.get('status')}")
                print(f"    上传时间: {upload.get('createdAt')}")

                # AI 分析预览
                ai_analysis = upload.get('aiAnalysis', '')
                if ai_analysis:
                    preview = ai_analysis[:150] + "..." if len(ai_analysis) > 150 else ai_analysis
                    print(f"    AI分析: {preview}")

            return uploads
        else:
            print(f"[FAIL] 查询失败: {data.get('message')}")
            return None
    except Exception as e:
        print(f"[ERROR] 查询异常: {e}")
        return None

def query_upload_detail(token, upload_id):
    """查询单个上传的详细数据"""
    url = f"{BASE_URL}/api/mobile/{FACTORY_ID}/smart-bi/uploads/{upload_id}"
    headers = {"Authorization": f"Bearer {token}"}

    try:
        response = requests.get(url, headers=headers)
        data = response.json()

        if data.get('success'):
            detail = data.get('data', {})
            print("\n" + "="*60)
            print(f"[详情] 上传ID: {upload_id}")
            print("="*60)
            print(json.dumps(detail, indent=2, ensure_ascii=False))
            return detail
        else:
            print(f"[FAIL] 查询失败: {data.get('message')}")
            return None
    except Exception as e:
        print(f"[ERROR] 查询异常: {e}")
        return None

def main():
    print("==> 开始查询 SmartBI 数据...")

    # 1. 登录
    token = login()
    if not token:
        print("无法获取 Token，退出")
        return

    # 2. 查询仪表盘
    dashboard = query_dashboard(token)

    # 3. 查询上传历史
    uploads = query_uploads(token)

    # 4. 如果有上传记录，查询最新一条的详情
    if uploads and len(uploads) > 0:
        latest_upload_id = uploads[0].get('id')
        if latest_upload_id:
            query_upload_detail(token, latest_upload_id)

    print("\n==> 查询完成")

if __name__ == "__main__":
    main()
