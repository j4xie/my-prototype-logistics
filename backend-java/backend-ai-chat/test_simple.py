#!/usr/bin/env python3
"""简单的 API 测试脚本"""
import requests
import json

# 测试数据
test_data = {
    "section_data": {
        "thawing_time": "4.5",
        "avg_thawing_time": "4.0",
        "drip_loss": "3.2",
        "avg_drip_loss": "2.8",
        "temperature": "-2.0",
        "avg_temperature": "-1.5",
        "tail_rate": "8.5",
        "avg_tail_rate": "7.0",
        "trim_rate": "5.2",
        "avg_trim_rate": "4.5",
        "thickness_sd": "0.8",
        "avg_thickness_sd": "0.5",
        "oee": "72",
        "avg_oee": "80"
    }
}

print("🧪 测试食品加工数据分析 API")
print("=" * 60)
print(f"\n📤 发送数据: {len(test_data['section_data'])} 个参数")

try:
    response = requests.post(
        "http://localhost:8085/api/ai/food-processing-analysis",
        json=test_data,
        timeout=60
    )

    print(f"\n📊 响应状态: {response.status_code}")

    if response.status_code == 200:
        result = response.json()
        print("\n✅ API 调用成功！")
        print(f"\n📋 分析结果:")
        print("-" * 60)
        print(result.get("analysis", "无分析结果"))
        print("-" * 60)
    else:
        print(f"\n❌ API 调用失败: {response.text}")

except Exception as e:
    print(f"\n❌ 错误: {str(e)}")
