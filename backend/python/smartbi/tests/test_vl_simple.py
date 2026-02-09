"""简单的 VL API 测试"""
import os
import json
import base64
import httpx
from pathlib import Path

# 加载 API Key
env_path = Path(__file__).parent.parent / ".env"
if env_path.exists():
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()

API_KEY = os.getenv("LLM_API_KEY", "")
BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
MODEL = "qwen-vl-max"

print(f"API Key: {API_KEY[:10]}..." if API_KEY else "API Key: NOT SET")
print(f"Model: {MODEL}")

# 读取测试图片
frame_path = Path(__file__).parent / "temp_frames" / "video2_frame_0001.jpg"
if not frame_path.exists():
    print(f"图片不存在: {frame_path}")
    exit(1)

with open(frame_path, "rb") as f:
    image_base64 = base64.b64encode(f.read()).decode()

print(f"图片大小: {len(image_base64) / 1024:.1f} KB (base64)")

# 构建请求
prompt = """请分析这张工厂车间图片，提取以下信息并以JSON格式返回：
{
    "worker_count": 工人数量,
    "active_workers": 正在工作的工人数,
    "process_stage": "工序类型(如包装、灌装等)",
    "efficiency_score": 效率评分(0-100),
    "scene_description": "场景描述(30字以内)"
}
仅返回JSON。"""

request_body = {
    "model": MODEL,
    "messages": [
        {
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{image_base64}"
                    }
                },
                {
                    "type": "text",
                    "text": prompt
                }
            ]
        }
    ],
    "max_tokens": 500,
    "temperature": 0.3
}

print("\n调用 VL API...")
try:
    client = httpx.Client(timeout=60.0)
    response = client.post(
        f"{BASE_URL}/chat/completions",
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json"
        },
        json=request_body
    )

    result = response.json()

    if "error" in result:
        print(f"API错误: {result['error']}")
    else:
        content = result["choices"][0]["message"]["content"]
        print(f"\nVL识别结果:")
        print(content)

        # 尝试解析JSON
        import re
        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            parsed = json.loads(json_match.group())
            print(f"\n解析后的数据:")
            print(json.dumps(parsed, ensure_ascii=False, indent=2))

except Exception as e:
    print(f"请求失败: {e}")
    import traceback
    traceback.print_exc()
