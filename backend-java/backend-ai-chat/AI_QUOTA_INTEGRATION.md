# AI配额规则集成说明

## 背景
AI配额原本是硬编码的（20次/周），现在改为从后端API动态读取配额规则。

## Python服务更新指南

### 1. 在 `main.py` 中添加获取配额规则的函数

```python
import requests
from typing import Optional, Dict

# 配置
BACKEND_API_BASE = "http://localhost:10010/api"

def get_quota_rule_for_factory(factory_id: str, role: str) -> int:
    """
    从后端API获取工厂的配额规则

    Args:
        factory_id: 工厂ID
        role: 用户角色

    Returns:
        该角色的实际配额（次/周）
    """
    try:
        # 调用后端API计算配额
        response = requests.get(
            f"{BACKEND_API_BASE}/platform/ai-quota-rules/calculate",
            params={"factoryId": factory_id, "role": role},
            timeout=5
        )

        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                return data.get("data", {}).get("calculatedQuota", 20)

        # 失败时返回默认值
        print(f"获取配额规则失败，使用默认值20: {response.status_code}")
        return 20

    except Exception as e:
        print(f"获取配额规则异常，使用默认值20: {e}")
        return 20
```

### 2. 更新配额检查逻辑

在检查配额的地方，将硬编码的20替换为动态获取：

```python
# 原来的硬编码方式
WEEKLY_QUOTA_LIMIT = 20

# 修改为动态获取
quota_limit = get_quota_rule_for_factory(factory_id, user_role)

# 或者缓存配额规则（推荐）
quota_cache = {}

def get_cached_quota(factory_id: str, role: str) -> int:
    """带缓存的配额获取（避免频繁调用API）"""
    cache_key = f"{factory_id}:{role}"

    # 检查缓存（有效期1小时）
    if cache_key in quota_cache:
        cached_data = quota_cache[cache_key]
        if time.time() - cached_data["timestamp"] < 3600:
            return cached_data["quota"]

    # 获取新配额
    quota = get_quota_rule_for_factory(factory_id, role)
    quota_cache[cache_key] = {
        "quota": quota,
        "timestamp": time.time()
    }

    return quota
```

### 3. 向后兼容

如果API调用失败，始终返回默认值20，确保系统可用性。

## API端点

- **计算用户配额**: `GET /api/platform/ai-quota-rules/calculate?factoryId={factoryId}&role={role}`
  - 返回: `{"success": true, "data": {"factoryId": "...", "role": "...", "calculatedQuota": 40}}`

- **获取工厂配额规则**: `GET /api/platform/ai-quota-rules/factory/{factoryId}`
  - 返回完整规则信息（包括角色系数）

## 配额计算逻辑

后端根据以下规则计算配额：
1. 查找工厂特定规则
2. 如果没有，使用全局默认规则
3. 根据角色系数计算最终配额：`实际配额 = 基础配额 × 角色系数`

示例：
- 基础配额: 20次/周
- 调度员系数: 2.0
- 调度员实际配额: 20 × 2.0 = 40次/周

## 注意事项

1. **错误处理**: 必须处理API调用失败的情况，返回合理的默认值
2. **缓存**: 建议缓存配额规则，避免频繁调用API
3. **超时**: API调用设置合理的超时时间（建议5秒）
4. **向后兼容**: 如果后端未部署新版本，应优雅降级
