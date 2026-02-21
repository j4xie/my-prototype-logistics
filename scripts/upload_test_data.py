#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
upload_test_data.py
为3个测试商家上传对应的 Excel 文件到 SmartBI 系统。

使用方式:
    python scripts/upload_test_data.py

前提条件:
  1. 已运行 database/create_test_merchants.sql 创建账号
  2. 已运行 scripts/generate_test_excels.py 生成 Excel 文件
  3. 服务器 47.100.235.168:10010 正在运行
"""

import io
import json
import os
import sys
import time
from pathlib import Path

# Fix Windows GBK console encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

try:
    import requests
except ImportError:
    print("请先安装 requests: pip install requests")
    sys.exit(1)

try:
    import openpyxl
except ImportError:
    print("请先安装 openpyxl: pip install openpyxl")
    sys.exit(1)

# ──────────────────────────────────────────────
# 配置
# ──────────────────────────────────────────────
BASE_URL   = "http://47.100.235.168:10010"
LOGIN_URL  = f"{BASE_URL}/api/mobile/auth/unified-login"
# 使用 upload-and-analyze 端点（单Sheet，auto_confirm=true，一步到位）
UPLOAD_URL = f"{BASE_URL}/api/mobile/{{factory_id}}/smart-bi/upload-and-analyze"

EXCEL_DIR = Path(__file__).parent / "test-data"

# 每个工厂对应: (username, password, factory_id, excel_filename)
MERCHANTS = [
    {
        "username":   "restaurant_admin1",
        "password":   "123456",
        "factory_id": "F002",
        "excel":      "张记餐饮-2025经营报表.xlsx",
        "display":    "张记餐饮 (F002)",
    },
    {
        "username":   "food_admin1",
        "password":   "123456",
        "factory_id": "F003",
        "excel":      "绿源食品-2025生产报表.xlsx",
        "display":    "绿源食品加工 (F003)",
    },
    {
        "username":   "retail_admin1",
        "password":   "123456",
        "factory_id": "F004",
        "excel":      "鲜味零售-2025销售数据.xlsx",
        "display":    "鲜味零售 (F004)",
    },
]

# ──────────────────────────────────────────────
# 工具函数
# ──────────────────────────────────────────────

def login(username: str, password: str) -> str | None:
    """登录并返回 accessToken，失败返回 None。"""
    payload = {"username": username, "password": password}
    try:
        resp = requests.post(LOGIN_URL, json=payload, timeout=15)
        resp.raise_for_status()
        body = resp.json()
    except requests.exceptions.RequestException as e:
        print(f"  [ERROR] 登录请求失败: {e}")
        return None

    if not body.get("success"):
        print(f"  [ERROR] 登录失败: {body.get('message', '未知错误')}")
        return None

    # 支持两种响应结构
    data = body.get("data", {})
    token = (
        data.get("accessToken")
        or data.get("token")
        or data.get("access_token")
    )
    if not token:
        print(f"  [ERROR] 响应中未找到 token，完整响应: {body}")
        return None

    print(f"  [OK]  登录成功，token: {token[:20]}...")
    return token


def upload_excel_per_sheet(factory_id: str, token: str, excel_path: Path) -> bool:
    """
    使用 upload-and-analyze 端点逐 sheet 上传。
    auto_confirm=true 确保数据直接入库。
    返回 True 表示所有 sheet 成功。
    """
    url = UPLOAD_URL.format(factory_id=factory_id)
    headers = {"Authorization": f"Bearer {token}"}

    if not excel_path.exists():
        print(f"  [ERROR] 文件不存在: {excel_path}")
        return False

    file_size = excel_path.stat().st_size
    print(f"  上传文件: {excel_path.name} ({file_size / 1024:.1f} KB)")

    # 读取 Excel 获取 sheet 列表
    wb = openpyxl.load_workbook(excel_path, read_only=True)
    sheet_names = wb.sheetnames
    wb.close()
    print(f"  共 {len(sheet_names)} 个 Sheet: {', '.join(sheet_names)}")

    all_ok = True
    for idx, name in enumerate(sheet_names):
        print(f"  [Sheet {idx}] 正在上传: {name}...")
        try:
            with open(excel_path, "rb") as f:
                files = {"file": (excel_path.name, f,
                                  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
                form_data = {
                    "sheetIndex": str(idx),
                    "headerRow": "0",
                    "auto_confirm": "true",
                    "headerRowCount": "1",
                }
                resp = requests.post(
                    url,
                    headers=headers,
                    files=files,
                    data=form_data,
                    timeout=120,
                )

            if resp.status_code == 401:
                print(f"  [Sheet {idx}] ERROR: 401 未授权")
                all_ok = False
                continue

            body = resp.json()
            if body.get("success"):
                msg = body.get("message", "OK")
                print(f"  [Sheet {idx}] OK: {msg}")
            else:
                msg = body.get("message", "未知错误")
                print(f"  [Sheet {idx}] FAIL: {msg}")
                all_ok = False

        except requests.exceptions.Timeout:
            print(f"  [Sheet {idx}] ERROR: 请求超时")
            all_ok = False
        except requests.exceptions.RequestException as e:
            print(f"  [Sheet {idx}] ERROR: {e}")
            all_ok = False
        except json.JSONDecodeError:
            print(f"  [Sheet {idx}] ERROR: 响应非JSON: {resp.text[:200]}")
            all_ok = False

        # sheet 间短暂间隔
        time.sleep(1)

    return all_ok


# ──────────────────────────────────────────────
# 主流程
# ──────────────────────────────────────────────

def check_excel_files():
    """检查所有 Excel 文件是否存在"""
    missing = []
    for m in MERCHANTS:
        p = EXCEL_DIR / m["excel"]
        if not p.exists():
            missing.append(str(p))
    if missing:
        print("[ERROR] 以下 Excel 文件不存在，请先运行 generate_test_excels.py:")
        for f in missing:
            print(f"  - {f}")
        return False
    return True


def main():
    print("=" * 60)
    print("  SmartBI 测试数据上传脚本")
    print(f"  目标服务器: {BASE_URL}")
    print("=" * 60)

    # 1. 检查 Excel 文件
    if not check_excel_files():
        sys.exit(1)

    results = []

    for merchant in MERCHANTS:
        print(f"\n{'─' * 50}")
        print(f"商家: {merchant['display']}")
        print(f"账号: {merchant['username']}")

        # 2. 登录
        print("  步骤 1/2: 登录...")
        token = login(merchant["username"], merchant["password"])
        if not token:
            results.append((merchant["display"], False, "登录失败"))
            continue

        time.sleep(0.5)

        # 3. 逐 sheet 上传
        print("  步骤 2/2: 上传 Excel (逐Sheet)...")
        excel_path = EXCEL_DIR / merchant["excel"]
        ok = upload_excel_per_sheet(merchant["factory_id"], token, excel_path)

        results.append((merchant["display"], ok, "成功" if ok else "部分Sheet失败"))

        # 批次间间隔
        time.sleep(2)

    # 4. 汇总
    print(f"\n{'=' * 60}")
    print("  上传结果汇总")
    print(f"{'=' * 60}")
    all_ok = True
    for display, ok, msg in results:
        status = "[PASS]" if ok else "[FAIL]"
        print(f"  {status}  {display}: {msg}")
        if not ok:
            all_ok = False

    print()
    if all_ok:
        print("所有商家数据上传成功！")
    else:
        print("部分上传失败，请检查以上错误信息。")
        sys.exit(1)


if __name__ == "__main__":
    main()
