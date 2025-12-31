"""
Intent Classifier 集成示例
展示如何在 main.py 中集成意图分类器

将此代码整合到 main.py 中
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, List, Any
from intent_classifier import classify_intent, IntentType, IntentResult

# ==================== 数据模型 ====================
class IntentChatRequest(BaseModel):
    """基于意图的聊天请求"""
    message: str                            # 用户消息
    factory_id: Optional[str] = None        # 工厂ID
    user_id: Optional[str] = None           # 用户ID
    session_id: Optional[str] = None        # 会话ID
    context: Optional[Dict] = None          # 上下文信息
    use_ai_intent: Optional[bool] = True    # 是否使用AI增强意图识别


class IntentChatResponse(BaseModel):
    """基于意图的聊天响应"""
    success: bool
    intent: str                             # 识别的意图
    confidence: float                       # 置信度
    response: str                           # 回复内容
    entities: Optional[Dict] = None         # 提取的实体
    suggestions: Optional[List[str]] = None # 建议的后续操作
    session_id: Optional[str] = None


# ==================== 意图处理器 ====================
class IntentHandlers:
    """意图处理器集合"""

    @staticmethod
    async def handle_query_batch_status(entities: Dict, factory_id: str) -> str:
        """处理批次状态查询"""
        batch_id = entities.get('batch_id', '未指定')

        # TODO: 调用后端API查询真实数据
        # 这里返回模拟数据
        return f"""📦 **批次 {batch_id} 状态报告**

✅ **当前状态**: 生产中
📍 **当前工序**: 机械切片 (第3/8步)
⏱️ **进度**: 65% (预计还需2小时)
👷 **负责人**: 张师傅

📊 **质量指标**:
- 良品率: 98.5% ✅
- 合格率: 99.2% ✅
- 返工率: 1.5%

💡 **建议**: 进度正常，预计今天18:00前完成
"""

    @staticmethod
    async def handle_query_production_progress(entities: Dict, factory_id: str) -> str:
        """处理生产进度查询"""
        date = entities.get('date_parsed', '今天')

        return f"""📊 **{date} 生产进度报告**

🏭 **总体进度**:
- 计划产量: 5000kg
- 已完成: 3200kg (64%)
- 剩余: 1800kg

📦 **批次状态**:
✅ 已完成: 3个批次
🔄 进行中: 2个批次
⏳ 待开始: 1个批次

👥 **人员在岗**:
- 在岗人数: 18/20人
- 平均效率: 95%

💡 **预测**: 按当前速度，今天能超额完成5%
"""

    @staticmethod
    async def handle_urgent_insert(entities: Dict, factory_id: str) -> str:
        """处理紧急插单"""
        quantity = entities.get('quantity', '未指定数量')
        product = entities.get('product_type', '产品')

        return f"""⚠️ **紧急插单评估**

📋 **插单信息**:
- 产品: {product}
- 数量: {quantity}

📊 **可行性分析**:
✅ 设备利用率: 75% (有空余)
✅ 物料库存: 充足
⚠️ 人员: 可能需要加班

⏱️ **预计排程**:
- 最早开始: 今天15:00
- 预计完成: 明天10:00
- 影响批次: 1个 (B006需延后4小时)

💰 **成本影响**:
- 加班费: +¥800
- 换线成本: +¥500
- 总增加成本: ¥1300

❓ **是否确认插单？**
请回复"确认"或"取消"
"""

    @staticmethod
    async def handle_form_fill(entities: Dict, factory_id: str, message: str) -> str:
        """处理表单填充"""
        return f"""📝 **智能表单填充**

我可以帮您填充以下表单：
1. 生产计划表
2. 质检记录表
3. 物料入库单
4. 成本统计表

请告诉我您要填充哪个表单，我会根据历史数据和规则自动填充。

💡 **提示**: 您可以说"帮我填生产计划表"
"""

    @staticmethod
    async def handle_analyze_trend(entities: Dict, factory_id: str) -> str:
        """处理趋势分析"""
        date = entities.get('date_parsed', '最近')

        return f"""📈 **{date}生产趋势分析**

📊 **产量趋势** (近7天):
- 平均日产: 4800kg (↑5% vs 上周)
- 最高: 5200kg (周三)
- 最低: 4200kg (周一)
- 趋势: 稳步上升 ✅

⚠️ **质量趋势**:
- 良品率: 98.2% (↓0.5% vs 上周)
- 主要问题: 切片厚度偏差增大
- 根因: 刀具磨损

💰 **成本趋势**:
- 单位成本: ¥12.5/kg (↑2%)
- 主要增长: 人工成本 (+8%)

💡 **建议**:
1. 立即更换切片机刀具
2. 优化排班，降低加班成本
3. 加强首件检验

📅 **预测**: 如采取措施，下周良品率可回升至98.8%
"""

    @staticmethod
    async def handle_predict_completion(entities: Dict, factory_id: str) -> str:
        """处理完成预测"""
        batch_id = entities.get('batch_id', '当前批次')

        return f"""⏱️ **{batch_id} 完成时间预测**

📊 **基于AI模型预测**:
- 预计完成时间: 今天 18:30 (±30分钟)
- 置信度: 85%

📈 **计算依据**:
- 当前进度: 65%
- 平均效率: 95kg/h
- 剩余工序: 5个
- 历史数据: 同类批次平均4.2小时

⚠️ **风险因素**:
- 设备状态: 良好 ✅
- 物料供应: 充足 ✅
- 人员稳定: 可能换班 ⚠️

💡 **加速建议**:
如需提前完成，可以：
1. 增加1名辅助工 (提前30分钟)
2. 优化换线流程 (提前15分钟)
"""

    @staticmethod
    async def handle_optimize_suggestion(entities: Dict, factory_id: str) -> str:
        """处理优化建议"""
        return f"""💡 **生产优化建议 (AI分析)**

🎯 **短期优化** (1-2周见效):
1. **降低切片厚度偏差**
   - 行动: 每班次前校准设备
   - 预期: 良品率 +1.5%
   - 成本节省: ¥2000/周

2. **优化排班**
   - 行动: 调整早晚班交接时间
   - 预期: 减少10%加班
   - 成本节省: ¥3000/周

🏆 **中期优化** (1-2月见效):
3. **引入预防性维护**
   - 行动: 每周设备点检
   - 预期: 故障率 -30%

4. **员工技能培训**
   - 行动: 标准化操作培训
   - 预期: 效率 +8%

📊 **总预期收益**:
- 成本降低: 15%
- 效率提升: 12%
- 质量改善: 良品率达99%+

❓ **需要详细实施方案吗？**
"""

    @staticmethod
    async def handle_greeting(entities: Dict, factory_id: str) -> str:
        """处理问候"""
        return f"""👋 您好！我是白垩纪食品溯源系统的AI助手。

我可以帮您：
📊 查询生产进度和批次状态
⚡ 处理紧急插单
📝 智能填充表单
📈 分析趋势和预测
💡 提供优化建议

请问有什么可以帮您的？
"""

    @staticmethod
    async def handle_help(entities: Dict, factory_id: str) -> str:
        """处理帮助"""
        return f"""❓ **系统功能帮助**

📌 **查询功能**:
- "查询批次B001的状态"
- "今天生产了多少"
- "质检报告怎么样"
- "成本分析"

📌 **操作功能**:
- "紧急插单500kg虾"
- "创建明天的生产计划"
- "调整排程"

📌 **表单功能**:
- "帮我填生产计划表"
- "验证这个表单"
- "建议填什么数据"

📌 **分析功能**:
- "最近的趋势分析"
- "预测什么时候完成"
- "给我优化建议"

💡 **提示**: 直接用自然语言描述您的需求即可！
"""

    @staticmethod
    async def handle_unknown(entities: Dict, factory_id: str, message: str) -> str:
        """处理未知意图"""
        return f"""🤔 抱歉，我还不太理解您的意思。

您是想要：
1. 📊 查询数据 (批次、进度、质量等)
2. ⚡ 执行操作 (插单、创建计划等)
3. 📝 处理表单
4. 📈 查看分析

请尝试更详细地描述您的需求，或者回复数字选择功能。
"""


# ==================== 意图路由器 ====================
async def route_intent(intent_result: IntentResult, factory_id: str, message: str) -> str:
    """根据意图路由到对应处理器"""

    handlers = {
        IntentType.QUERY_BATCH_STATUS: IntentHandlers.handle_query_batch_status,
        IntentType.QUERY_PRODUCTION_PROGRESS: IntentHandlers.handle_query_production_progress,
        IntentType.URGENT_INSERT: IntentHandlers.handle_urgent_insert,
        IntentType.FORM_FILL: IntentHandlers.handle_form_fill,
        IntentType.ANALYZE_TREND: IntentHandlers.handle_analyze_trend,
        IntentType.PREDICT_COMPLETION: IntentHandlers.handle_predict_completion,
        IntentType.OPTIMIZE_SUGGESTION: IntentHandlers.handle_optimize_suggestion,
        IntentType.GREETING: IntentHandlers.handle_greeting,
        IntentType.HELP: IntentHandlers.handle_help,
    }

    handler = handlers.get(intent_result.primary_intent)

    if handler:
        return await handler(intent_result.entities, factory_id)
    else:
        return await IntentHandlers.handle_unknown(intent_result.entities, factory_id, message)


# ==================== API 端点 ====================
# 将以下代码添加到 main.py 的 app 中

async def intent_chat_endpoint(request: IntentChatRequest):
    """
    基于意图的智能聊天接口

    流程：
    1. 意图识别
    2. 实体提取
    3. 意图路由
    4. 生成响应
    """
    try:
        import uuid

        # 1. 意图识别
        intent_result = classify_intent(
            text=request.message,
            context=request.context,
            use_ai=request.use_ai_intent
        )

        # 2. 意图路由
        response_text = await route_intent(
            intent_result=intent_result,
            factory_id=request.factory_id or "default",
            message=request.message
        )

        # 3. 生成建议操作
        suggestions = generate_suggestions(intent_result)

        # 4. 生成会话ID
        session_id = request.session_id or f"session_{uuid.uuid4().hex[:16]}"

        return IntentChatResponse(
            success=True,
            intent=intent_result.primary_intent.value,
            confidence=intent_result.confidence,
            response=response_text,
            entities=intent_result.entities,
            suggestions=suggestions,
            session_id=session_id
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Intent处理失败: {str(e)}")


def generate_suggestions(intent_result: IntentResult) -> List[str]:
    """根据意图生成后续建议"""
    suggestions_map = {
        IntentType.QUERY_BATCH_STATUS: [
            "查看质量报告",
            "查看成本分析",
            "预测完成时间"
        ],
        IntentType.QUERY_PRODUCTION_PROGRESS: [
            "查看详细批次列表",
            "分析趋势",
            "优化建议"
        ],
        IntentType.URGENT_INSERT: [
            "确认插单",
            "取消插单",
            "查看详细影响"
        ],
        IntentType.ANALYZE_TREND: [
            "查看根因分析",
            "获取优化建议",
            "生成报告"
        ],
    }

    return suggestions_map.get(intent_result.primary_intent, [
        "继续提问",
        "查看帮助"
    ])


# ==================== 使用示例 ====================
"""
在 main.py 中添加以下代码：

from intent_classifier import classify_intent, IntentType
from intent_integration_example import intent_chat_endpoint, IntentChatRequest, IntentChatResponse

@app.post("/api/ai/intent-chat", response_model=IntentChatResponse)
async def intent_chat(request: IntentChatRequest):
    return await intent_chat_endpoint(request)


测试请求示例：

POST /api/ai/intent-chat
{
    "message": "查询批次B001的状态",
    "factory_id": "F001",
    "user_id": "user123",
    "use_ai_intent": true
}

响应示例：
{
    "success": true,
    "intent": "query_batch_status",
    "confidence": 0.92,
    "response": "📦 **批次 B001 状态报告**...",
    "entities": {
        "batch_id": "B001"
    },
    "suggestions": [
        "查看质量报告",
        "查看成本分析",
        "预测完成时间"
    ],
    "session_id": "session_abc123def456"
}
"""
