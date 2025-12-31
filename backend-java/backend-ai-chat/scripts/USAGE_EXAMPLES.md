# Intent Classifier - 使用示例

## 目录
- [基础使用](#基础使用)
- [高级用法](#高级用法)
- [实际场景](#实际场景)
- [API 集成](#api-集成)
- [最佳实践](#最佳实践)

---

## 基础使用

### 1. 简单意图分类

```python
from intent_classifier import classify_intent

# 查询类意图
result = classify_intent("查询批次B001的状态")
print(f"意图: {result.primary_intent.value}")
print(f"置信度: {result.confidence:.2f}")
print(f"实体: {result.entities}")

# 输出:
# 意图: query_batch_status
# 置信度: 0.85
# 实体: {'batch_id': 'B001'}
```

### 2. 带实体提取

```python
# 用户输入包含多个实体
text = "查询批次B001今天的生产情况，已完成500kg"
result = classify_intent(text)

print(f"批次号: {result.entities.get('batch_id')}")      # B001
print(f"日期: {result.entities.get('date')}")            # 今天
print(f"数量: {result.entities.get('quantity')}")        # 500
print(f"单位: {result.entities.get('unit')}")            # kg
```

### 3. 禁用 AI 增强

```python
# 只使用规则引擎（速度快，成本低）
result = classify_intent("你好", use_ai=False)
print(result.primary_intent.value)  # greeting
```

---

## 高级用法

### 1. 上下文感知对话

```python
from intent_classifier import IntentClassifier

classifier = IntentClassifier()

# 第一轮对话
result1 = classifier.classify("有个紧急订单需要插单")
print(result1.primary_intent.value)  # urgent_insert

# 构建上下文
context = {
    "last_intent": result1.primary_intent.value,
    "last_entities": result1.entities,
    "conversation_history": ["有个紧急订单需要插单"]
}

# 第二轮对话（根据上下文推断）
result2 = classifier.classify("确定", context=context)
print(result2.primary_intent.value)  # confirm
print(result2.context_used)          # True
```

### 2. 自定义置信度阈值

```python
from intent_classifier import IntentClassifier

# 设置更严格的阈值，更多情况下使用 AI
classifier = IntentClassifier(
    use_ai=True,
    confidence_threshold=0.8  # 默认 0.6
)

result = classifier.classify("模糊的输入")
print(result.classification_method)  # hybrid (如果规则置信度 < 0.8)
```

### 3. 处理多意图

```python
result = classify_intent("查询批次B001的状态并分析趋势")

print(f"主要意图: {result.primary_intent.value}")
print(f"次要意图: {result.secondary_intents}")

# 可以根据次要意图提供更全面的回复
if result.secondary_intents:
    print("检测到多个意图，您可能还想:")
    for intent, confidence in result.secondary_intents:
        print(f"  - {intent.value} (置信度: {confidence:.2f})")
```

---

## 实际场景

### 场景1: 智能客服

```python
from intent_classifier import classify_intent, IntentType

def chatbot_handler(user_input: str, session_context: dict):
    """智能客服处理器"""

    # 分类意图
    result = classify_intent(user_input, context=session_context)

    # 根据意图路由
    if result.primary_intent == IntentType.QUERY_BATCH_STATUS:
        return query_batch_status(result.entities.get('batch_id'))

    elif result.primary_intent == IntentType.URGENT_INSERT:
        return handle_urgent_insert(result.entities)

    elif result.primary_intent == IntentType.GREETING:
        return "您好！我是白垩纪食品溯源系统的AI助手，有什么可以帮您的？"

    elif result.primary_intent == IntentType.HELP:
        return show_help_menu()

    elif result.primary_intent == IntentType.UNKNOWN:
        return "抱歉，我不太明白您的意思。您可以说'帮助'查看功能列表。"

    else:
        return f"收到您的{result.primary_intent.value}请求"

# 使用示例
response = chatbot_handler("查询批次B001的状态", {})
print(response)
```

### 场景2: 表单智能填充

```python
def smart_form_filler(user_request: str):
    """智能表单填充"""

    result = classify_intent(user_request)

    if result.primary_intent == IntentType.FORM_FILL:
        # 提取表单相关信息
        form_data = {
            'batch_id': result.entities.get('batch_id'),
            'date': result.entities.get('date_parsed'),
            'quantity': result.entities.get('quantity'),
            'product_type': result.entities.get('product_type')
        }

        # 调用AI自动填充
        filled_form = auto_fill_form(form_data)
        return filled_form

    return None

# 使用
request = "帮我填一下批次B001今天的生产记录表"
form = smart_form_filler(request)
```

### 场景3: 多轮对话管理

```python
class ConversationManager:
    """对话管理器"""

    def __init__(self):
        self.sessions = {}  # session_id -> context

    def handle_message(self, session_id: str, message: str):
        # 获取或创建上下文
        context = self.sessions.get(session_id, {
            "history": [],
            "last_intent": None,
            "last_entities": {}
        })

        # 分类意图
        result = classify_intent(message, context=context)

        # 更新上下文
        context["history"].append(message)
        context["last_intent"] = result.primary_intent.value
        context["last_entities"] = result.entities
        self.sessions[session_id] = context

        # 处理意图
        response = self.process_intent(result)

        return response

    def process_intent(self, result):
        # 业务逻辑处理
        if result.primary_intent == IntentType.URGENT_INSERT:
            return "收到紧急插单请求，正在评估影响..."
        elif result.primary_intent == IntentType.CONFIRM:
            return "已确认，正在处理您的请求..."
        # ... 其他处理
        return "已收到"

# 使用示例
manager = ConversationManager()

# 第一轮
response1 = manager.handle_message("user123", "有个紧急订单")
# 第二轮
response2 = manager.handle_message("user123", "确定")  # 基于上下文理解为确认
```

---

## API 集成

### 集成到 FastAPI

```python
# main.py

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, List
from intent_classifier import classify_intent, IntentType

app = FastAPI()

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    context: Optional[Dict] = None

class ChatResponse(BaseModel):
    success: bool
    intent: str
    confidence: float
    response: str
    entities: Dict
    suggestions: List[str]

@app.post("/api/intent-chat", response_model=ChatResponse)
async def intent_chat(request: ChatRequest):
    """基于意图的聊天接口"""

    # 1. 意图识别
    result = classify_intent(request.message, context=request.context)

    # 2. 意图处理
    response_text = await handle_intent(result)

    # 3. 生成建议
    suggestions = generate_suggestions(result.primary_intent)

    return ChatResponse(
        success=True,
        intent=result.primary_intent.value,
        confidence=result.confidence,
        response=response_text,
        entities=result.entities,
        suggestions=suggestions
    )

async def handle_intent(result):
    """处理具体意图"""
    if result.primary_intent == IntentType.QUERY_BATCH_STATUS:
        batch_id = result.entities.get('batch_id', '未知')
        return f"正在查询批次 {batch_id} 的状态..."

    elif result.primary_intent == IntentType.GREETING:
        return "您好！有什么可以帮您的？"

    return "已收到您的请求"

def generate_suggestions(intent):
    """生成后续建议"""
    mapping = {
        IntentType.QUERY_BATCH_STATUS: [
            "查看质量报告",
            "查看成本分析",
            "预测完成时间"
        ],
        IntentType.URGENT_INSERT: [
            "确认插单",
            "取消插单",
            "查看影响分析"
        ]
    }
    return mapping.get(intent, ["继续提问"])
```

### 测试 API

```bash
# 启动服务
uvicorn main:app --reload --port 8000

# 发送请求
curl -X POST "http://localhost:8000/api/intent-chat" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "查询批次B001的状态",
    "session_id": "user123"
  }'
```

---

## 最佳实践

### 1. 错误处理

```python
from intent_classifier import classify_intent, IntentType

def safe_classify(text: str, context: dict = None):
    """安全的意图分类（带错误处理）"""
    try:
        result = classify_intent(text, context=context)

        # 检查置信度
        if result.confidence < 0.3:
            return {
                "intent": "unknown",
                "suggestion": "请提供更详细的信息"
            }

        return {
            "intent": result.primary_intent.value,
            "entities": result.entities,
            "confidence": result.confidence
        }

    except Exception as e:
        print(f"Intent分类失败: {e}")
        return {
            "intent": "error",
            "error": str(e)
        }

# 使用
result = safe_classify("模糊的输入")
```

### 2. 性能优化

```python
from intent_classifier import get_classifier

# 使用单例，避免重复初始化
classifier = get_classifier(use_ai=False)  # 纯规则模式最快

# 批量处理
messages = ["查询批次", "今天生产", "质检报告"]
results = [classifier.classify(msg) for msg in messages]
```

### 3. 日志记录

```python
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def classify_with_logging(text: str):
    """带日志的意图分类"""
    result = classify_intent(text)

    logger.info(f"Intent分类 - 输入: {text}")
    logger.info(f"  意图: {result.primary_intent.value}")
    logger.info(f"  置信度: {result.confidence:.2f}")
    logger.info(f"  实体: {result.entities}")
    logger.info(f"  方法: {result.classification_method}")

    return result
```

### 4. A/B 测试

```python
def ab_test_classifier(text: str, user_id: str):
    """A/B测试：规则 vs AI增强"""

    # 根据用户ID分组
    use_ai = hash(user_id) % 2 == 0

    result = classify_intent(text, use_ai=use_ai)

    # 记录实验数据
    log_ab_test({
        "user_id": user_id,
        "text": text,
        "use_ai": use_ai,
        "intent": result.primary_intent.value,
        "confidence": result.confidence,
        "method": result.classification_method
    })

    return result
```

### 5. 置信度分级处理

```python
def handle_by_confidence(text: str):
    """根据置信度分级处理"""
    result = classify_intent(text)

    if result.confidence >= 0.8:
        # 高置信度：直接执行
        return execute_intent(result)

    elif result.confidence >= 0.5:
        # 中等置信度：请求确认
        return {
            "status": "confirm",
            "message": f"您是想{result.primary_intent.value}吗？",
            "options": ["是", "否", "换个说法"]
        }

    else:
        # 低置信度：提供选项
        return {
            "status": "clarify",
            "message": "我不太确定您的意思，请选择：",
            "options": [
                "1. 查询数据",
                "2. 执行操作",
                "3. 查看分析"
            ]
        }
```

---

## 调试技巧

### 查看分类详情

```python
result = classify_intent("查询批次B001的状态")

print("=" * 60)
print(f"输入: {result.original_text}")
print(f"主要意图: {result.primary_intent.value}")
print(f"置信度: {result.confidence:.2%}")
print(f"分类方法: {result.classification_method}")
print(f"使用上下文: {result.context_used}")

if result.entities:
    print("\n提取的实体:")
    for key, value in result.entities.items():
        print(f"  {key}: {value}")

if result.secondary_intents:
    print("\n次要意图:")
    for intent, conf in result.secondary_intents:
        print(f"  {intent.value}: {conf:.2%}")
```

### 测试所有意图

```python
from intent_classifier import IntentType

test_samples = {
    IntentType.QUERY_BATCH_STATUS: "查询批次B001的状态",
    IntentType.URGENT_INSERT: "有个紧急订单要插单",
    IntentType.FORM_FILL: "帮我填一下表单",
    IntentType.ANALYZE_TREND: "最近的趋势怎么样",
    # ... 添加更多测试样本
}

for expected_intent, text in test_samples.items():
    result = classify_intent(text, use_ai=False)
    status = "✅" if result.primary_intent == expected_intent else "❌"
    print(f"{status} {text} -> {result.primary_intent.value}")
```

---

## 常见问题

### Q: 如何提高分类准确率？

**A**:
1. 启用 AI 增强模式 (`use_ai=True`)
2. 提供对话上下文
3. 添加更多规则模式
4. 降低置信度阈值

### Q: 如何处理歧义输入？

**A**:
```python
result = classify_intent("B001")

if result.confidence < 0.5:
    # 请求用户明确
    return "您是想查询B001的状态，还是要对B001进行操作？"
```

### Q: 如何扩展新意图？

**A**: 参考 [INTENT_CLASSIFIER_README.md](INTENT_CLASSIFIER_README.md#扩展开发) 中的扩展开发章节

---

## 下一步

- 查看 [完整文档](INTENT_CLASSIFIER_README.md)
- 运行 [单元测试](test_intent_classifier.py)
- 查看 [集成示例](intent_integration_example.py)

---

**版本**: 1.0.0
**最后更新**: 2025-12-31
