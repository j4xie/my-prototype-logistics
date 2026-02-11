"""
白垩纪食品溯源系统 - AI食品加工数据分析服务
基于阿里云通义千问 (DashScope) 的智能分析API
支持思考模式 (Thinking Mode) - 深度推理分析
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Dict, List, Any
import os
import json
from dotenv import load_dotenv

# 导入 OpenAI SDK (阿里云 DashScope 兼容 OpenAI 格式)
from openai import OpenAI

# 导入电子秤视觉解析器
from scale_vision_parser import parse_scale_image, is_vision_enabled

# 导入 Sentence-BERT Embedding 服务
try:
    from embedding_service import router as embedding_router, warmup_model as warmup_embedding
    EMBEDDING_ENABLED = True
except ImportError:
    EMBEDDING_ENABLED = False
    embedding_router = None
    print("[WARN] embedding_service not available - semantic cache disabled")

load_dotenv()

# ==================== 配置 ====================
# 阿里云 DashScope 配置
DASHSCOPE_API_KEY = os.environ.get('DASHSCOPE_API_KEY', '')
DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
# 可选模型: qwen-turbo (最快最便宜), qwen-plus (平衡), qwen-max (最强)
DASHSCOPE_MODEL = os.environ.get('DASHSCOPE_MODEL', 'qwen-plus')

# 初始化 OpenAI 客户端 (兼容 DashScope)
client = None
if DASHSCOPE_API_KEY:
    client = OpenAI(
        api_key=DASHSCOPE_API_KEY,
        base_url=DASHSCOPE_BASE_URL,
    )

# ==================== FastAPI 应用 ====================
app = FastAPI(title="食品加工数据分析 API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册 Embedding 路由
if EMBEDDING_ENABLED and embedding_router:
    app.include_router(embedding_router)

# ==================== 数据模型 ====================
class FoodProcessingRequest(BaseModel):
    section_data: Dict[str, str]  # 所有参数（实际值和平均值）

class FoodProcessingResponse(BaseModel):
    success: bool
    analysis: str
    message: Optional[str] = None

# 成本分析专用请求模型
class CostAnalysisRequest(BaseModel):
    message: str  # 成本数据的文本描述
    user_id: str  # 工厂ID_batch_批次ID
    session_id: Optional[str] = None
    enable_thinking: Optional[bool] = True  # 默认开启思考模式
    thinking_budget: Optional[int] = 50  # 思考预算 (10-100)

# ==================== 核心功能 ====================
def query_qwen(messages: list, enable_thinking: bool = False, thinking_budget: int = 50) -> dict:
    """
    调用阿里云通义千问模型

    Args:
        messages: 消息列表
        enable_thinking: 是否启用思考模式
        thinking_budget: 思考预算 (10-100)

    Returns:
        dict: {
            "content": str,  # 最终回答
            "reasoning_content": str,  # 思考过程 (仅思考模式)
            "thinking_enabled": bool
        }
    """
    if not client:
        raise HTTPException(status_code=500, detail="DASHSCOPE_API_KEY未配置")

    try:
        if enable_thinking:
            # 思考模式：使用流式响应收集思考过程和最终答案
            return query_qwen_with_thinking(messages, thinking_budget)
        else:
            # 普通模式
            completion = client.chat.completions.create(
                model=DASHSCOPE_MODEL,
                messages=messages,
                max_tokens=1500,
                temperature=0.7,
            )
            return {
                "content": completion.choices[0].message.content,
                "reasoning_content": "",
                "thinking_enabled": False
            }
    except Exception as e:
        # 参考文档: https://help.aliyun.com/zh/model-studio/developer-reference/error-code
        raise HTTPException(status_code=500, detail=f"通义千问调用失败: {str(e)}")


def query_qwen_with_thinking(messages: list, thinking_budget: int = 50) -> dict:
    """
    思考模式调用 - 使用流式响应收集思考过程

    思考模式会返回两部分内容:
    1. reasoning_content: AI的思考过程
    2. content: 最终回答
    """
    reasoning_content = ""
    answer_content = ""

    try:
        completion = client.chat.completions.create(
            model=DASHSCOPE_MODEL,
            messages=messages,
            extra_body={
                "enable_thinking": True,
                "thinking_budget": thinking_budget
            },
            stream=True,
            stream_options={
                "include_usage": True
            },
        )

        for chunk in completion:
            if chunk.choices and len(chunk.choices) > 0:
                choice = chunk.choices[0]
                delta = choice.delta

                # 检查是否有内容
                if hasattr(delta, 'reasoning_content') and delta.reasoning_content:
                    reasoning_content += delta.reasoning_content
                elif hasattr(delta, 'content') and delta.content:
                    answer_content += delta.content

        return {
            "content": answer_content,
            "reasoning_content": reasoning_content,
            "thinking_enabled": True
        }

    except Exception as e:
        # 如果思考模式失败，回退到普通模式
        print(f"[WARN] 思考模式失败，回退到普通模式: {e}")
        completion = client.chat.completions.create(
            model=DASHSCOPE_MODEL,
            messages=messages,
            max_tokens=1500,
            temperature=0.7,
        )
        return {
            "content": completion.choices[0].message.content,
            "reasoning_content": "",
            "thinking_enabled": False
        }

def build_prompt(section_data: Dict[str, str]) -> str:
    """
    构建分析提示词 - 将用户输入的参数转换为Prompt文本

    示例：
    输入: {"thawing_time": "4.5", "avg_thawing_time": "4.0", ...}
    输出:
    '''
    请分析以下食品加工数据（实际数据 vs 平均数据）：

    【接收&半解冻】
      解冻时间: 实际=4.5 | 平均=4.0
      ...
    '''
    """
    sections = {
        '接收&半解冻': ['thawing_time', 'drip_loss', 'temperature'],
        '去尾': ['tail_rate', 'trim_rate', 'rework_rate'],
        '机械切片': ['thickness_sd', 'jam_rate', 'oee'],
        '清洗(倍温)': ['water_usage', 'outlet_temp', 'micro_pass_rate'],
        '沥干': ['surface_loss', 'dwell_time'],
        '深辊上浆(半成品)': ['marinade_absorption', 'ph_salinity', 'marinade_variance'],
        '包装&IQF速冻': ['sec', 'pack_pass_rate', 'cooling_time'],
        '品控&食品安全': ['ccp_pass_rate', 'audit_issues'],
        '清洗&换线': ['clean_duration', 'atp_pass_rate'],
    }

    param_labels = {
        'thawing_time': '解冻时间', 'drip_loss': '滴水损失率(%)', 'temperature': '温度(°C)',
        'tail_rate': '尾段率(%)', 'trim_rate': '修整率(%)', 'rework_rate': '返工率(%)',
        'thickness_sd': '厚度偏差SD(mm)', 'jam_rate': '卡机率(%)', 'oee': 'OEE(%)',
        'water_usage': '单位用水(L/kg)', 'outlet_temp': '出口温度(°C)',
        'micro_pass_rate': '微生物检测合格率(%)',
        'surface_loss': '表面失水率(%)', 'dwell_time': '停留时间(min)',
        'marinade_absorption': '腌料吸收率(%)', 'ph_salinity': 'pH/盐度',
        'marinade_variance': '腌料消耗差异(%)',
        'sec': 'sEC(kWh/kg)', 'pack_pass_rate': '包装合格率(%)',
        'cooling_time': '核心降温时间(min)',
        'ccp_pass_rate': 'CCP合格率(%)', 'audit_issues': '审计问题数(个)',
        'clean_duration': '清洁时长(min)', 'atp_pass_rate': 'ATP检测合格率(%)',
    }

    prompt_parts = ["请分析以下食品加工数据（实际数据 vs 平均数据）：\n"]

    # 遍历每个环节
    for section_name, param_keys in sections.items():
        section_text = f"\n【{section_name}】\n"
        section_has_data = False

        # 遍历每个参数
        for param_key in param_keys:
            actual_val = section_data.get(param_key, "").strip()
            avg_val = section_data.get(f"avg_{param_key}", "").strip()

            if actual_val or avg_val:
                section_has_data = True
                label = param_labels.get(param_key, param_key)
                # 组装成: "解冻时间: 实际=4.5 | 平均=4.0"
                section_text += f"  {label}: 实际={actual_val or '未填'} | 平均={avg_val or '未填'}\n"

        if section_has_data:
            prompt_parts.append(section_text)

    if len(prompt_parts) == 1:
        prompt_parts.append("\n⚠️ 未提供任何数据")
    else:
        prompt_parts.append("\n请基于以上数据进行深度分析，给出专业建议。")

    return "".join(prompt_parts)

# ==================== API端点 ====================
@app.get("/")
async def root():
    return {
        "service": "食品加工数据分析 API",
        "status": "running",
        "model": f"阿里云通义千问 ({DASHSCOPE_MODEL})",
        "api_configured": bool(DASHSCOPE_API_KEY)
    }

@app.post("/api/ai/food-processing-analysis", response_model=FoodProcessingResponse)
async def analyze(request: FoodProcessingRequest):
    """
    食品加工数据分析 - 核心功能

    流程：
    1. 接收section_data (所有参数)
    2. 构建Prompt文本
    3. 发送给Llama 3.1
    4. 返回AI分析结果
    """
    try:
        # 步骤1: 构建Prompt
        prompt = build_prompt(request.section_data)

        # 步骤2: 调用AI模型
        messages = [
            {
                "role": "system",
                "content": """你是食品加工专家，专门分析加工数据。

任务：
1. 对比实际数据与平均数据，识别差异
2. 诊断问题和风险点
3. 提供具体优化建议
4. 分析成本优化空间

要求：
- 简洁专业的语言
- 具体数字和百分比对比
- 可量化的改进目标
- 中文回复

输出格式：
📊 **总体评估**
[整体评价]

🔍 **环节分析**
[逐环节分析实际vs平均差异]

⚠️ **主要问题**
1. [问题及影响]

💡 **优化建议**
1. [具体建议]

📈 **预期收益**
[预期改善]"""
            },
            {
                "role": "user",
                "content": prompt  # 这里是用户数据转换成的Prompt文本
            }
        ]

        # 步骤3: 获取AI分析 (普通模式，不使用思考)
        result = query_qwen(messages, enable_thinking=False)

        # 步骤4: 返回结果
        return FoodProcessingResponse(
            success=True,
            analysis=result["content"],
            message="分析完成"
        )

    except Exception as e:
        return FoodProcessingResponse(
            success=False,
            analysis="",
            message=f"分析失败: {str(e)}"
        )

@app.post("/api/ai/chat")
async def cost_analysis(request: CostAnalysisRequest):
    """
    成本分析专用接口 - 与Java后端集成

    接收格式化的成本数据文本，返回AI分析建议
    """
    try:
        import uuid
        import time

        # 构建专门的成本分析消息
        messages = [
            {
                "role": "system",
                "content": """你是食品加工企业的成本分析专家。

你的任务是分析生产批次的成本数据，提供专业的成本优化建议。

分析要点：
1. 成本结构合理性：评估原材料、人工、设备成本的占比是否合理
2. 异常识别：找出成本数据中的异常点和风险
3. 对比分析：将当前成本与行业标准或历史数据对比
4. 优化建议：提供具体可行的成本降低措施
5. 效率评估：分析生产效率、良品率、人均产能等指标

输出要求：
- 使用中文
- 简洁专业，条理清晰
- 提供具体数字和百分比
- 给出可量化的改进目标
- 分析要深入，建议要具体

输出格式：
📊 **成本结构分析**
[分析各项成本占比的合理性]

⚠️ **发现的问题**
1. [问题点及影响]

💡 **优化建议**
1. [具体的改进措施]

📈 **预期效果**
[实施建议后的预期成本节省]"""
            },
            {
                "role": "user",
                "content": request.message
            }
        ]

        # 获取思考模式配置 (默认开启)
        enable_thinking = request.enable_thinking if request.enable_thinking is not None else True
        thinking_budget = request.thinking_budget if request.thinking_budget else 50

        # 尝试调用AI模型，如果失败则返回模拟分析（用于演示）
        try:
            result = query_qwen(messages, enable_thinking=enable_thinking, thinking_budget=thinking_budget)
            ai_analysis = result["content"]
            reasoning_content = result["reasoning_content"]
            thinking_enabled = result["thinking_enabled"]
        except Exception as ai_error:
            # 如果AI调用失败，返回基于规则的模拟分析（仅用于演示和测试）
            print(f"[WARN] AI调用失败，使用模拟分析: {ai_error}")
            ai_analysis = generate_mock_analysis(request.message)
            reasoning_content = ""
            thinking_enabled = False

        # 生成会话ID（如果没有提供）
        session_id = request.session_id if request.session_id else f"session_{uuid.uuid4().hex[:16]}"

        # 返回结果（匹配Java期望的格式，增加思考内容）
        return {
            "success": True,
            "aiAnalysis": ai_analysis,
            "reasoningContent": reasoning_content,  # 思考过程
            "thinkingEnabled": thinking_enabled,    # 是否使用了思考模式
            "sessionId": session_id,
            "messageCount": 1,
            "timestamp": int(time.time() * 1000)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI分析失败: {str(e)}")


@app.post("/api/ai/chat/stream")
async def cost_analysis_stream(request: CostAnalysisRequest):
    """
    成本分析专用接口 - 流式响应版本 (SSE)

    实时返回AI分析过程，包括思考过程和最终答案
    """
    import uuid
    import time

    async def event_generator():
        try:
            # 发送开始事件
            yield f"data: {json.dumps({'type': 'start', 'timestamp': int(time.time() * 1000)})}\n\n"

            # 构建专门的成本分析消息
            messages = [
                {
                    "role": "system",
                    "content": """你是食品加工企业的成本分析专家。

你的任务是分析生产批次的成本数据，提供专业的成本优化建议。

分析要点：
1. 成本结构合理性：评估原材料、人工、设备成本的占比是否合理
2. 异常识别：找出成本数据中的异常点和风险
3. 对比分析：将当前成本与行业标准或历史数据对比
4. 优化建议：提供具体可行的成本降低措施
5. 效率评估：分析生产效率、良品率、人均产能等指标

输出要求：
- 使用中文
- 简洁专业，条理清晰
- 提供具体数字和百分比
- 给出可量化的改进目标
- 分析要深入，建议要具体

输出格式：
📊 **成本结构分析**
[分析各项成本占比的合理性]

⚠️ **发现的问题**
1. [问题点及影响]

💡 **优化建议**
1. [具体的改进措施]

📈 **预期效果**
[实施建议后的预期成本节省]"""
                },
                {
                    "role": "user",
                    "content": request.message
                }
            ]

            # 获取思考模式配置
            enable_thinking = request.enable_thinking if request.enable_thinking is not None else True
            thinking_budget = request.thinking_budget if request.thinking_budget else 50

            if not client:
                yield f"data: {json.dumps({'type': 'error', 'message': 'DASHSCOPE_API_KEY未配置'})}\n\n"
                return

            reasoning_content = ""
            answer_content = ""

            try:
                # 开启流式模式
                completion = client.chat.completions.create(
                    model=DASHSCOPE_MODEL,
                    messages=messages,
                    extra_body={
                        "enable_thinking": enable_thinking,
                        "thinking_budget": thinking_budget
                    } if enable_thinking else {},
                    stream=True,
                    stream_options={"include_usage": True} if enable_thinking else None,
                )

                # 逐块发送响应
                for chunk in completion:
                    if chunk.choices and len(chunk.choices) > 0:
                        choice = chunk.choices[0]
                        delta = choice.delta

                        # 发送思考内容
                        if hasattr(delta, 'reasoning_content') and delta.reasoning_content:
                            reasoning_content += delta.reasoning_content
                            yield f"data: {json.dumps({'type': 'thinking', 'content': delta.reasoning_content})}\n\n"

                        # 发送回答内容
                        elif hasattr(delta, 'content') and delta.content:
                            answer_content += delta.content
                            yield f"data: {json.dumps({'type': 'answer', 'content': delta.content})}\n\n"

            except Exception as ai_error:
                print(f"[WARN] 流式AI调用失败: {ai_error}")
                # 回退到模拟分析
                answer_content = generate_mock_analysis(request.message)
                yield f"data: {json.dumps({'type': 'answer', 'content': answer_content})}\n\n"

            # 生成会话ID
            session_id = request.session_id if request.session_id else f"session_{uuid.uuid4().hex[:16]}"

            # 发送完成事件
            yield f"data: {json.dumps({'type': 'complete', 'sessionId': session_id, 'reasoningContent': reasoning_content, 'answerContent': answer_content, 'timestamp': int(time.time() * 1000)})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # 禁用nginx缓冲
        }
    )


def generate_mock_analysis(cost_data: str) -> str:
    """
    生成模拟的成本分析（用于演示，当AI API不可用时）
    """
    # 从成本数据中提取关键信息
    lines = cost_data.split('\n')
    batch_number = ""
    product_name = ""
    total_cost = 0
    material_cost_ratio = 0
    labor_cost_ratio = 0
    equipment_cost_ratio = 0
    yield_rate = 0

    for line in lines:
        if "批次编号:" in line:
            batch_number = line.split(':')[1].strip()
        elif "产品名称:" in line:
            product_name = line.split(':')[1].strip()
        elif "总成本:" in line:
            # 提取数字
            import re
            match = re.search(r'¥([\d,]+)', line)
            if match:
                total_cost = int(match.group(1).replace(',', ''))
        elif "原材料成本:" in line and "占比" in line:
            match = re.search(r'占比([\d.]+)%', line)
            if match:
                material_cost_ratio = float(match.group(1))
        elif "人工成本:" in line and "占比" in line:
            match = re.search(r'占比([\d.]+)%', line)
            if match:
                labor_cost_ratio = float(match.group(1))
        elif "设备成本:" in line and "占比" in line:
            match = re.search(r'占比([\d.]+)%', line)
            if match:
                equipment_cost_ratio = float(match.group(1))
        elif "良品率:" in line:
            match = re.search(r'([\d.]+)%', line)
            if match:
                yield_rate = float(match.group(1))

    # 基于数据生成分析
    analysis = f"""📊 **成本结构分析**

根据批次 {batch_number} ({product_name}) 的成本数据，总成本为 ¥{total_cost:,}，成本结构如下：

- 原材料成本占比 {material_cost_ratio:.1f}%
- 人工成本占比 {labor_cost_ratio:.1f}%
- 设备成本占比 {equipment_cost_ratio:.1f}%

**结构评估：**
"""

    # 原材料成本分析
    if material_cost_ratio > 60:
        analysis += f"• 原材料成本占比 {material_cost_ratio:.1f}% 偏高，建议优化采购策略\n"
    elif material_cost_ratio < 45:
        analysis += f"• 原材料成本占比 {material_cost_ratio:.1f}% 合理，采购控制良好\n"
    else:
        analysis += f"• 原材料成本占比 {material_cost_ratio:.1f}% 处于正常范围\n"

    # 人工成本分析
    if labor_cost_ratio > 35:
        analysis += f"• 人工成本占比 {labor_cost_ratio:.1f}% 较高，存在人员效率优化空间\n"
    else:
        analysis += f"• 人工成本占比 {labor_cost_ratio:.1f}% 合理\n"

    # 设备成本分析
    if equipment_cost_ratio < 15:
        analysis += f"• 设备成本占比 {equipment_cost_ratio:.1f}% 合理，设备利用率良好\n"

    analysis += f"\n⚠️ **发现的问题**\n\n"

    problems = []
    if yield_rate < 98:
        problems.append(f"1. 良品率 {yield_rate:.1f}% 低于行业标准98%，造成原材料浪费和成本增加")
    if labor_cost_ratio > 35:
        problems.append(f"2. 人工成本占比 {labor_cost_ratio:.1f}% 偏高，可能存在人员冗余或效率不足")
    if material_cost_ratio > 60:
        problems.append(f"3. 原材料成本占比 {material_cost_ratio:.1f}% 过高，需要审查供应商报价和采购流程")

    if problems:
        analysis += "\n".join(problems)
    else:
        analysis += "1. 未发现重大成本异常，整体控制良好\n"

    analysis += f"\n\n💡 **优化建议**\n\n"

    suggestions = []
    if yield_rate < 98:
        target_saving = total_cost * (98 - yield_rate) / 100 * 0.5
        suggestions.append(f"1. **提升良品率**：加强质量控制，目标提升至98%以上，预计节省成本约¥{target_saving:,.0f}")

    if labor_cost_ratio > 35:
        target_ratio = 30
        target_saving = total_cost * (labor_cost_ratio - target_ratio) / 100
        suggestions.append(f"2. **优化人员配置**：通过流程优化和培训提升人均产能，目标降低人工成本至30%，预计节省¥{target_saving:,.0f}")

    if material_cost_ratio > 60:
        target_saving = total_cost * 0.05
        suggestions.append(f"3. **采购优化**：对比多家供应商报价，批量采购谈判，预计可降低采购成本3-5%，约¥{target_saving:,.0f}")

    suggestions.append("4. **设备利用率**：保持现有设备利用水平，定期维护保养延长使用寿命")

    analysis += "\n".join(suggestions)

    # 预期收益
    total_potential_saving = sum([
        total_cost * (98 - yield_rate) / 100 * 0.5 if yield_rate < 98 else 0,
        total_cost * (labor_cost_ratio - 30) / 100 if labor_cost_ratio > 35 else 0,
        total_cost * 0.05 if material_cost_ratio > 60 else 0
    ])

    if total_potential_saving > 0:
        new_unit_cost_estimate = (total_cost - total_potential_saving) / (total_cost / 7.20)  # 假设单位成本7.20
        analysis += f"\n\n📈 **预期效果**\n\n"
        analysis += f"实施以上优化措施后：\n"
        analysis += f"• 预计总成本可从 ¥{total_cost:,} 降低至 ¥{total_cost - total_potential_saving:,.0f}\n"
        analysis += f"• 成本节省约 ¥{total_potential_saving:,.0f} ({total_potential_saving/total_cost*100:.1f}%)\n"
        analysis += f"• 单位成本预计从 ¥7.20/kg 降至 ¥{new_unit_cost_estimate:.2f}/kg\n"
        analysis += f"• 整体利润率可提升 {total_potential_saving/total_cost*100:.1f} 个百分点"
    else:
        analysis += f"\n\n📈 **预期效果**\n\n"
        analysis += f"当前成本控制已经较为优秀，建议：\n"
        analysis += f"• 保持现有成本管理水平\n"
        analysis += f"• 持续监控各项成本指标\n"
        analysis += f"• 探索自动化和技术升级机会"

    analysis += "\n\n---\n💡 *本分析基于提供的成本数据生成，具体实施请结合工厂实际情况调整*"

    return analysis


# ==================== AI表单助手服务 ====================

class FormParseRequest(BaseModel):
    """表单解析请求"""
    user_input: str  # 用户输入的文本（语音转文字后的内容）
    form_fields: List[Dict]  # 表单字段定义 [{"name": "materialType", "title": "原料类型", "type": "string"}]
    entity_type: str  # 实体类型，如 MATERIAL_BATCH, QUALITY_CHECK
    factory_id: Optional[str] = None
    context: Optional[Dict] = None  # 可选的上下文信息
    session_id: Optional[str] = None  # 会话ID，用于多轮对话
    validation_errors: Optional[List[str]] = None  # 校验错误列表（用于反馈修正）
    previous_values: Optional[Dict] = None  # 之前填写的值（用于反馈修正）

class FormParseResponse(BaseModel):
    """表单解析响应"""
    success: bool
    field_values: Dict  # 解析出的字段值 {"materialType": "带鱼", "quantity": 500}
    confidence: float  # 置信度 0-1
    unparsed_text: Optional[str] = None  # 未能解析的部分
    message: Optional[str] = None
    session_id: Optional[str] = None  # 会话ID
    validation_errors: Optional[List[str]] = None  # 校验错误列表
    correction_hints: Optional[Dict[str, str]] = None  # 字段修正建议 {"quantity": "请输入有效的数量，如：500公斤"}
    missing_required_fields: Optional[List[str]] = None  # 缺失的必填字段
    suggested_questions: Optional[List[str]] = None  # AI生成的追问


class ValidationFeedbackRequest(BaseModel):
    """校验反馈请求 - 用于表单校验失败时的AI修正"""
    session_id: Optional[str] = None  # 会话ID
    entity_type: str  # 实体类型
    form_fields: List[Dict]  # 表单字段定义
    submitted_values: Dict  # 用户提交的值
    validation_errors: List[Dict]  # 校验错误 [{"field": "quantity", "message": "必须大于0"}]
    user_instruction: Optional[str] = None  # 用户补充说明
    factory_id: Optional[str] = None


class ValidationFeedbackResponse(BaseModel):
    """校验反馈响应"""
    success: bool
    correction_hints: Dict[str, str]  # 字段修正建议
    corrected_values: Optional[Dict] = None  # AI建议的修正值
    explanation: Optional[str] = None  # AI解释
    confidence: float = 0.0
    session_id: Optional[str] = None

class OCRParseRequest(BaseModel):
    """OCR解析请求"""
    image_base64: str  # Base64编码的图片
    form_fields: List[Dict]  # 表单字段定义
    entity_type: str
    factory_id: Optional[str] = None

class OCRParseResponse(BaseModel):
    """OCR解析响应"""
    success: bool
    extracted_text: str  # OCR识别的原始文本


# ==================== AI 工厂批量初始化服务 ====================

class FactoryBatchInitRequest(BaseModel):
    """工厂批量初始化请求"""
    factory_description: str  # 用户对工厂的描述 (如: "这是一个水产加工厂，主要生产带鱼罐头，需要原料入库、生产、质检、出货全流程")
    industry_hint: Optional[str] = None  # 行业提示 (seafood_processing, prepared_food, etc.)
    factory_id: Optional[str] = None
    factory_name: Optional[str] = None
    include_business_data: Optional[bool] = True  # 是否包含建议的业务数据


class EntitySchemaDefinition(BaseModel):
    """单个实体类型的完整 Schema"""
    entity_type: str  # MATERIAL_BATCH, QUALITY_CHECK, etc.
    entity_name: str  # 原材料批次, 质检记录, etc.
    fields: List[Dict]  # Formily 格式的字段列表
    description: Optional[str] = None


class SuggestedBusinessData(BaseModel):
    """建议的业务数据"""
    product_types: List[Dict]  # [{"code": "PT001", "name": "带鱼罐头", "description": "..."}]
    material_types: List[Dict]  # [{"code": "MT001", "name": "带鱼", "unit": "kg", ...}]
    conversion_rates: Optional[List[Dict]] = None  # [{"materialType": "MT001", "productType": "PT001", "rate": 0.7}]


class FactoryBatchInitResponse(BaseModel):
    """工厂批量初始化响应"""
    success: bool
    schemas: List[EntitySchemaDefinition]  # 所有实体类型的 Schema
    suggested_data: Optional[SuggestedBusinessData] = None  # 建议的业务数据
    industry_code: str  # 识别的行业代码
    industry_name: str  # 行业名称
    ai_summary: Optional[str] = None  # AI 总结
    message: Optional[str] = None


def build_factory_init_prompt() -> str:
    """
    构建工厂初始化的系统提示词
    """
    return """你是白垩纪食品溯源系统的工厂初始化助手。

你的任务是根据用户对工厂的描述，生成完整的表单配置和业务数据建议。

支持的表单类型 (EntityType):
1. MATERIAL_BATCH - 原材料批次入库
2. PROCESSING_BATCH - 生产加工批次
3. QUALITY_CHECK - 质检记录
4. SHIPMENT - 出货记录
5. EQUIPMENT - 设备信息
6. DISPOSAL_RECORD - 报废/处置记录

每个表单类型需要生成的字段应该包含:
- 基本信息字段 (编号、名称、日期等)
- 行业特有字段 (如水产的温度、冻品类型；预制菜的辣度、口味等)
- 质量控制字段 (检测项目、合格标准等)

可用的 Formily 组件:
- Input: 单行文本
- Input.TextArea: 多行文本
- NumberPicker: 数字 (支持 min, max)
- Select: 下拉选择 (需要 enum)
- DatePicker: 日期选择
- Switch: 开关
- Upload: 文件上传
- Rate: 评分

输出格式 (严格JSON):
{
  "industry_code": "seafood_processing",
  "industry_name": "水产加工",
  "schemas": [
    {
      "entity_type": "MATERIAL_BATCH",
      "entity_name": "原材料批次",
      "description": "记录原材料入库信息",
      "fields": [
        {
          "name": "materialType",
          "title": "原料类型",
          "type": "string",
          "x_component": "Select",
          "enum": [{"label": "带鱼", "value": "daiyu"}, {"label": "酸菜", "value": "suancai"}],
          "required": true
        }
      ]
    }
  ],
  "suggested_data": {
    "product_types": [
      {"code": "PT001", "name": "带鱼罐头", "description": "经典带鱼罐头产品"}
    ],
    "material_types": [
      {"code": "MT001", "name": "带鱼", "unit": "kg", "description": "新鲜或冷冻带鱼"}
    ],
    "conversion_rates": [
      {"materialTypeCode": "MT001", "productTypeCode": "PT001", "rate": 0.7, "description": "1kg带鱼产出0.7kg罐头"}
    ]
  },
  "ai_summary": "根据您的描述，已为水产加工厂生成6个表单模板，包含带鱼罐头的全流程配置..."
}

注意:
- 字段名使用 camelCase
- 根据行业特点添加行业特有字段
- 质检表单要包含行业常见的检测项目
- 建议的业务数据要符合用户描述的产品
- 转换率根据行业经验给出合理估计"""


@app.post("/api/ai/factory/batch-initialize", response_model=FactoryBatchInitResponse)
async def batch_initialize_factory(request: FactoryBatchInitRequest):
    """
    AI 工厂批量初始化 - 根据自然语言描述一次性生成所有表单配置

    用途:
    - 新工厂快速上线 (5分钟)
    - 根据 SOP 文档描述生成完整配置
    - 包含产品类型、原料类型等业务数据建议

    示例输入:
    "这是一个水产品加工厂，主要生产带鱼罐头，需要原料入库、生产、质检、出货全流程"

    示例输出:
    - 6个 EntityType 的完整 Schema (MATERIAL_BATCH, PROCESSING_BATCH, QUALITY_CHECK, SHIPMENT, EQUIPMENT, DISPOSAL_RECORD)
    - 建议的产品类型: [带鱼罐头]
    - 建议的原料类型: [带鱼]
    - 建议的转换率配置
    """
    try:
        if not request.factory_description or not request.factory_description.strip():
            return FactoryBatchInitResponse(
                success=False,
                schemas=[],
                industry_code="",
                industry_name="",
                message="工厂描述不能为空"
            )

        # 构建提示词
        system_prompt = build_factory_init_prompt()

        # 添加行业提示
        user_content = f"工厂描述: {request.factory_description}"
        if request.industry_hint:
            user_content += f"\n行业提示: {request.industry_hint}"
        if request.factory_name:
            user_content += f"\n工厂名称: {request.factory_name}"

        user_content += "\n\n请生成完整的表单配置和业务数据建议。"

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ]

        # 调用AI (使用较高 token 限制，因为输出较长)
        try:
            if not client:
                raise Exception("DASHSCOPE_API_KEY未配置")

            completion = client.chat.completions.create(
                model=DASHSCOPE_MODEL,
                messages=messages,
                max_tokens=4000,  # 较长输出
                temperature=0.7,
            )
            response_text = completion.choices[0].message.content.strip()

        except Exception as ai_error:
            # AI 调用失败，返回默认模板
            print(f"[WARN] AI调用失败: {ai_error}")
            return generate_default_factory_config(request)

        # 解析JSON响应
        try:
            # 清理可能的markdown代码块
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            response_text = response_text.strip()

            parsed = json.loads(response_text)

            # 提取 schemas
            schemas = []
            for s in parsed.get("schemas", []):
                schema = EntitySchemaDefinition(
                    entity_type=s.get("entity_type", ""),
                    entity_name=s.get("entity_name", ""),
                    fields=s.get("fields", []),
                    description=s.get("description")
                )
                schemas.append(schema)

            # 提取建议的业务数据
            suggested_data = None
            if request.include_business_data and "suggested_data" in parsed:
                sd = parsed["suggested_data"]
                suggested_data = SuggestedBusinessData(
                    product_types=sd.get("product_types", []),
                    material_types=sd.get("material_types", []),
                    conversion_rates=sd.get("conversion_rates")
                )

            return FactoryBatchInitResponse(
                success=True,
                schemas=schemas,
                suggested_data=suggested_data,
                industry_code=parsed.get("industry_code", "general"),
                industry_name=parsed.get("industry_name", "通用加工"),
                ai_summary=parsed.get("ai_summary"),
                message=f"成功生成 {len(schemas)} 个表单模板"
            )

        except json.JSONDecodeError as e:
            return FactoryBatchInitResponse(
                success=False,
                schemas=[],
                industry_code="",
                industry_name="",
                message=f"AI返回格式错误: {str(e)}"
            )

    except HTTPException as e:
        raise e
    except Exception as e:
        return FactoryBatchInitResponse(
            success=False,
            schemas=[],
            industry_code="",
            industry_name="",
            message=f"工厂初始化失败: {str(e)}"
        )


def generate_default_factory_config(request: FactoryBatchInitRequest) -> FactoryBatchInitResponse:
    """
    生成默认的工厂配置 (当AI不可用时的回退)
    """
    # 默认水产加工模板
    default_schemas = [
        EntitySchemaDefinition(
            entity_type="MATERIAL_BATCH",
            entity_name="原材料批次",
            description="记录原材料入库信息",
            fields=[
                {"name": "batchNumber", "title": "批次编号", "type": "string", "x_component": "Input", "required": True},
                {"name": "materialType", "title": "原料类型", "type": "string", "x_component": "Select", "required": True},
                {"name": "quantity", "title": "数量", "type": "number", "x_component": "NumberPicker", "required": True},
                {"name": "unit", "title": "单位", "type": "string", "x_component": "Select", "enum": [{"label": "kg", "value": "kg"}, {"label": "个", "value": "pcs"}]},
                {"name": "temperature", "title": "温度(°C)", "type": "number", "x_component": "NumberPicker"},
                {"name": "supplierId", "title": "供应商", "type": "string", "x_component": "Select"},
                {"name": "receivedDate", "title": "入库日期", "type": "string", "x_component": "DatePicker", "required": True},
            ]
        ),
        EntitySchemaDefinition(
            entity_type="PROCESSING_BATCH",
            entity_name="生产批次",
            description="记录生产加工信息",
            fields=[
                {"name": "batchNumber", "title": "批次编号", "type": "string", "x_component": "Input", "required": True},
                {"name": "productType", "title": "产品类型", "type": "string", "x_component": "Select", "required": True},
                {"name": "plannedQuantity", "title": "计划数量", "type": "number", "x_component": "NumberPicker", "required": True},
                {"name": "actualQuantity", "title": "实际产出", "type": "number", "x_component": "NumberPicker"},
                {"name": "startTime", "title": "开始时间", "type": "string", "x_component": "DatePicker"},
                {"name": "endTime", "title": "结束时间", "type": "string", "x_component": "DatePicker"},
            ]
        ),
        EntitySchemaDefinition(
            entity_type="QUALITY_CHECK",
            entity_name="质检记录",
            description="记录质量检验信息",
            fields=[
                {"name": "checkNumber", "title": "检验编号", "type": "string", "x_component": "Input", "required": True},
                {"name": "batchId", "title": "关联批次", "type": "string", "x_component": "Select", "required": True},
                {"name": "temperature", "title": "温度检测(°C)", "type": "number", "x_component": "NumberPicker"},
                {"name": "appearance", "title": "外观检查", "type": "string", "x_component": "Select", "enum": [{"label": "合格", "value": "pass"}, {"label": "不合格", "value": "fail"}]},
                {"name": "result", "title": "检验结果", "type": "string", "x_component": "Select", "enum": [{"label": "合格", "value": "pass"}, {"label": "不合格", "value": "fail"}], "required": True},
                {"name": "remarks", "title": "备注", "type": "string", "x_component": "Input.TextArea"},
            ]
        ),
        EntitySchemaDefinition(
            entity_type="SHIPMENT",
            entity_name="出货记录",
            description="记录产品出货信息",
            fields=[
                {"name": "shipmentNumber", "title": "出货单号", "type": "string", "x_component": "Input", "required": True},
                {"name": "customerId", "title": "客户", "type": "string", "x_component": "Select", "required": True},
                {"name": "productBatchId", "title": "产品批次", "type": "string", "x_component": "Select", "required": True},
                {"name": "quantity", "title": "出货数量", "type": "number", "x_component": "NumberPicker", "required": True},
                {"name": "shipmentDate", "title": "出货日期", "type": "string", "x_component": "DatePicker", "required": True},
            ]
        ),
    ]

    return FactoryBatchInitResponse(
        success=True,
        schemas=default_schemas,
        suggested_data=SuggestedBusinessData(
            product_types=[
                {"code": "PT001", "name": "默认产品", "description": "默认产品类型"}
            ],
            material_types=[
                {"code": "MT001", "name": "默认原料", "unit": "kg", "description": "默认原料类型"}
            ],
            conversion_rates=None
        ),
        industry_code="general",
        industry_name="通用加工",
        ai_summary="由于AI服务不可用，已生成默认通用配置模板。您可以稍后手动调整。",
        message="已生成默认配置 (AI不可用)"
    )


# ==================== AI Schema 生成服务 ====================

class SchemaFieldDefinition(BaseModel):
    """生成的单个字段定义"""
    name: str  # 字段英文名 (camelCase)
    title: str  # 字段中文名
    type: str  # string, number, boolean, array
    description: Optional[str] = None  # 字段描述
    x_component: str  # Formily 组件名
    x_component_props: Optional[Dict] = None  # 组件属性
    x_decorator: str = "FormItem"  # 装饰器
    x_decorator_props: Optional[Dict] = None  # 装饰器属性
    x_validator: Optional[List[Dict]] = None  # 验证规则
    x_reactions: Optional[Dict] = None  # 联动规则
    enum: Optional[List[Dict]] = None  # 枚举值 (下拉选项)
    default: Optional[Any] = None  # 默认值

class SchemaGenerateRequest(BaseModel):
    """Schema生成请求"""
    user_input: str  # 用户自然语言描述 (例如: "加一个辣度评分字段，1-5分，3分以上合格")
    entity_type: str  # 表单类型: QUALITY_CHECK, MATERIAL_BATCH, etc.
    existing_fields: Optional[List[str]] = None  # 现有字段名列表，避免重复
    factory_id: Optional[str] = None
    context: Optional[Dict] = None  # 可选的上下文信息

class SchemaGenerateResponse(BaseModel):
    """Schema生成响应"""
    success: bool
    fields: List[SchemaFieldDefinition]  # 生成的字段列表
    validation_rules: Optional[List[Dict]] = None  # 额外的验证规则
    suggestions: Optional[List[str]] = None  # AI建议 (如: "建议添加不合格原因字段")
    message: Optional[str] = None


def build_form_parse_prompt(form_fields: List[Dict], entity_type: str) -> str:
    """
    构建表单解析的系统提示词
    """
    field_descriptions = []
    for field in form_fields:
        name = field.get('name', '')
        title = field.get('title', name)
        field_type = field.get('type', 'string')
        required = field.get('required', False)
        enum_values = field.get('enum', [])

        desc = f"- {name} ({title}): 类型={field_type}"
        if required:
            desc += ", 必填"
        if enum_values:
            enum_labels = [e.get('label', e) if isinstance(e, dict) else str(e) for e in enum_values]
            desc += f", 可选值=[{', '.join(enum_labels)}]"
        field_descriptions.append(desc)

    fields_text = "\n".join(field_descriptions)

    entity_type_chinese = {
        'MATERIAL_BATCH': '原材料批次',
        'QUALITY_CHECK': '质检记录',
        'PROCESSING_BATCH': '生产批次',
        'SHIPMENT': '出货记录',
        'EQUIPMENT': '设备信息',
        'DISPOSAL_RECORD': '处置记录'
    }.get(entity_type, entity_type)

    return f"""你是白垩纪食品溯源系统的智能表单助手。

你的任务是从用户的自然语言输入中提取表单字段值。

当前正在填写: {entity_type_chinese}

表单字段定义:
{fields_text}

提取规则:
1. 仅提取用户明确提到的字段值
2. 数值类型需要转换为数字
3. 日期时间使用 ISO 8601 格式 (YYYY-MM-DDTHH:mm:ss)
4. 枚举类型需要匹配可选值
5. 如果用户没有提到某个字段，不要猜测，直接不填

输出格式 (严格JSON):
{{
  "fieldName1": "value1",
  "fieldName2": 123,
  ...
}}

注意:
- 只输出JSON，不要有其他文字
- 没有提到的字段不要包含
- 温度单位默认摄氏度，重量单位根据上下文判断（克/公斤/吨）
- 如果用户说的是简称或别名，需要识别并转换为标准值"""


@app.post("/api/ai/form/parse", response_model=FormParseResponse)
async def parse_form_input(request: FormParseRequest):
    """
    AI表单解析 - 将用户自然语言输入解析为表单字段值

    用途:
    - 语音转文字后的内容解析
    - 用户文本输入的解析

    示例:
    输入: "帮我填一个带鱼批次，500公斤，温度零下18度"
    输出: {"materialType": "带鱼", "quantity": 500, "unit": "kg", "temperature": -18}
    """
    try:
        if not request.user_input or not request.user_input.strip():
            return FormParseResponse(
                success=False,
                field_values={},
                confidence=0,
                message="用户输入不能为空"
            )

        # 构建提示词
        system_prompt = build_form_parse_prompt(request.form_fields, request.entity_type)

        # 添加上下文信息
        context_text = ""
        if request.context:
            context_items = []
            if request.context.get('factoryName'):
                context_items.append(f"当前工厂: {request.context['factoryName']}")
            if request.context.get('userName'):
                context_items.append(f"操作人: {request.context['userName']}")
            if request.context.get('recentMaterials'):
                context_items.append(f"常用原料: {', '.join(request.context['recentMaterials'][:5])}")
            if context_items:
                context_text = "\n\n背景信息:\n" + "\n".join(context_items)

        messages = [
            {"role": "system", "content": system_prompt + context_text},
            {"role": "user", "content": request.user_input}
        ]

        # 调用AI
        result = query_qwen(messages, enable_thinking=False)
        response_text = result["content"].strip()

        # 解析JSON响应
        try:
            # 清理可能的markdown代码块
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            response_text = response_text.strip()

            field_values = json.loads(response_text)

            # 计算置信度（基于解析出的字段数量和用户输入长度的比例）
            parsed_count = len(field_values)
            total_fields = len(request.form_fields)
            input_length = len(request.user_input)

            # 简单的置信度计算
            if parsed_count == 0:
                confidence = 0.3
            elif parsed_count >= total_fields * 0.5:
                confidence = 0.9
            else:
                confidence = 0.6 + (parsed_count / max(total_fields, 1)) * 0.3

            # P1-1: 检测缺失的必填字段
            missing_required_fields = []
            suggested_questions = []
            for field in request.form_fields:
                field_name = field.get('name', '')
                is_required = field.get('required', False)
                if is_required and field_name not in field_values:
                    missing_required_fields.append(field_name)
                    field_title = field.get('title', field_name)
                    field_type = field.get('type', 'string')
                    # 根据字段类型生成追问
                    if field.get('enum'):
                        options = ', '.join(str(v) for v in field['enum'][:5])
                        suggested_questions.append(f"请选择{field_title}（可选: {options}）")
                    elif field_type == 'number':
                        suggested_questions.append(f"请告诉我{field_title}的数值")
                    elif field_type == 'date':
                        suggested_questions.append(f"请提供{field_title}（日期格式）")
                    else:
                        suggested_questions.append(f"请提供{field_title}")

            # 生成主要追问问题
            follow_up_question = None
            if missing_required_fields:
                if len(missing_required_fields) == 1:
                    follow_up_question = suggested_questions[0]
                else:
                    field_titles = []
                    for fn in missing_required_fields[:3]:  # 最多展示3个
                        for f in request.form_fields:
                            if f.get('name') == fn:
                                field_titles.append(f.get('title', fn))
                                break
                    follow_up_question = f"请补充以下信息: {', '.join(field_titles)}"

            return FormParseResponse(
                success=True,
                field_values=field_values,
                confidence=confidence,
                message=f"成功解析 {parsed_count} 个字段",
                missing_required_fields=missing_required_fields if missing_required_fields else None,
                suggested_questions=suggested_questions if suggested_questions else None
            )

        except json.JSONDecodeError as e:
            return FormParseResponse(
                success=False,
                field_values={},
                confidence=0,
                unparsed_text=response_text,
                message=f"AI返回格式错误: {str(e)}"
            )

    except HTTPException as e:
        raise e
    except Exception as e:
        return FormParseResponse(
            success=False,
            field_values={},
            confidence=0,
            message=f"解析失败: {str(e)}"
        )


def build_validation_feedback_prompt(
    form_fields: List[Dict],
    entity_type: str,
    submitted_values: Dict,
    validation_errors: List[Dict]
) -> str:
    """构建校验反馈的AI提示词"""
    # 格式化字段信息
    fields_info = []
    for field in form_fields:
        field_name = field.get('name', '')
        field_title = field.get('title', field_name)
        field_type = field.get('type', 'string')
        required = field.get('required', False)
        constraints = []
        if field.get('minimum') is not None:
            constraints.append(f"最小值: {field['minimum']}")
        if field.get('maximum') is not None:
            constraints.append(f"最大值: {field['maximum']}")
        if field.get('enum'):
            constraints.append(f"可选值: {', '.join(map(str, field['enum']))}")
        if field.get('pattern'):
            constraints.append(f"格式: {field['pattern']}")

        constraint_text = f" ({', '.join(constraints)})" if constraints else ""
        required_text = " [必填]" if required else ""
        fields_info.append(f"- {field_name} ({field_title}): {field_type}{constraint_text}{required_text}")

    fields_text = "\n".join(fields_info)

    # 格式化用户提交的值
    submitted_text = json.dumps(submitted_values, ensure_ascii=False, indent=2)

    # 格式化校验错误
    errors_text = "\n".join([
        f"- 字段 '{e.get('field', '未知')}': {e.get('message', '校验失败')}"
        for e in validation_errors
    ])

    entity_type_chinese = {
        "MATERIAL_BATCH": "原材料批次",
        "QUALITY_CHECK": "质检记录",
        "PROCESSING_BATCH": "加工批次",
        "SHIPMENT": "出货记录",
    }.get(entity_type, entity_type)

    return f"""你是白垩纪食品溯源系统的智能表单校验助手。

用户正在填写: {entity_type_chinese}

表单字段定义:
{fields_text}

用户提交的值:
{submitted_text}

校验失败的错误:
{errors_text}

你的任务是:
1. 分析每个校验错误的原因
2. 给出具体的修正建议，帮助用户正确填写
3. 如果可能，推测用户的意图并给出正确的值

输出格式 (严格JSON):
{{
  "correction_hints": {{
    "字段名1": "修正建议1",
    "字段名2": "修正建议2"
  }},
  "corrected_values": {{
    "字段名1": 修正后的值,
    "字段名2": 修正后的值
  }},
  "explanation": "整体解释"
}}

注意:
- correction_hints 必须包含所有出错字段的建议
- corrected_values 只包含你有信心修正的值
- 如果无法确定正确值，不要猜测
- 建议要具体、友好、易于理解"""


@app.post("/api/ai/form/parse/feedback", response_model=ValidationFeedbackResponse)
async def parse_form_validation_feedback(request: ValidationFeedbackRequest):
    """
    校验反馈端点 - 表单校验失败时，AI生成修正建议

    用途:
    - 表单提交校验失败后，调用此端点获取AI修正建议
    - AI分析错误原因，给出具体的修正方案

    示例:
    输入: {"quantity": -10} + 错误 [{"field": "quantity", "message": "必须大于0"}]
    输出: {
        "correction_hints": {"quantity": "数量必须是正数，请输入正确的数量，如 500"},
        "corrected_values": {"quantity": 10},
        "explanation": "您输入的数量是负数，已自动修正为正数"
    }
    """
    try:
        if not request.validation_errors:
            return ValidationFeedbackResponse(
                success=True,
                correction_hints={},
                explanation="没有校验错误需要处理",
                confidence=1.0,
                session_id=request.session_id
            )

        # 构建提示词
        system_prompt = build_validation_feedback_prompt(
            request.form_fields,
            request.entity_type,
            request.submitted_values,
            request.validation_errors
        )

        # 添加用户补充说明
        user_message = "请分析以上校验错误并给出修正建议。"
        if request.user_instruction:
            user_message += f"\n\n用户补充说明: {request.user_instruction}"

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ]

        # 调用AI
        result = query_qwen(messages, enable_thinking=True)
        response_text = result["content"].strip()

        # 解析JSON响应
        try:
            # 清理可能的markdown代码块
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            response_text = response_text.strip()

            parsed_response = json.loads(response_text)

            correction_hints = parsed_response.get("correction_hints", {})
            corrected_values = parsed_response.get("corrected_values", {})
            explanation = parsed_response.get("explanation", "")

            # 计算置信度
            error_count = len(request.validation_errors)
            hint_count = len(correction_hints)
            corrected_count = len(corrected_values)

            if hint_count >= error_count:
                confidence = 0.8 + (corrected_count / max(error_count, 1)) * 0.2
            else:
                confidence = 0.5 + (hint_count / max(error_count, 1)) * 0.3

            return ValidationFeedbackResponse(
                success=True,
                correction_hints=correction_hints,
                corrected_values=corrected_values if corrected_values else None,
                explanation=explanation,
                confidence=min(confidence, 1.0),
                session_id=request.session_id or str(uuid.uuid4())
            )

        except json.JSONDecodeError as e:
            # AI返回格式错误，尝试生成通用建议
            generic_hints = {}
            for error in request.validation_errors:
                field = error.get("field", "unknown")
                message = error.get("message", "校验失败")
                generic_hints[field] = f"请检查此字段: {message}"

            return ValidationFeedbackResponse(
                success=True,
                correction_hints=generic_hints,
                explanation=f"AI格式解析失败，已生成通用建议: {str(e)}",
                confidence=0.3,
                session_id=request.session_id
            )

    except HTTPException as e:
        raise e
    except Exception as e:
        return ValidationFeedbackResponse(
            success=False,
            correction_hints={},
            explanation=f"生成修正建议失败: {str(e)}",
            confidence=0,
            session_id=request.session_id
        )


@app.post("/api/ai/form/ocr", response_model=OCRParseResponse)
async def parse_form_ocr(request: OCRParseRequest):
    """
    AI表单OCR解析 - 从图片中提取表单字段值

    用途:
    - 拍照识别送货单、质检报告等
    - 扫描文档自动填充表单
    - 电子秤设备铭牌/规格书识别

    流程:
    1. 检查 entity_type，如果是 SCALE_CONFIGURATION 则使用专用视觉解析器
    2. 其他类型使用阿里云OCR识别图片文字
    3. 将识别结果发送给LLM进行结构化提取
    4. 返回解析出的字段值
    """
    try:
        if not request.image_base64:
            return OCRParseResponse(
                success=False,
                extracted_text="",
                field_values={},
                confidence=0,
                message="图片数据不能为空"
            )

        # ==================== 电子秤设备识别 (Qwen VL) ====================
        if request.entity_type == "SCALE_CONFIGURATION":
            if not is_vision_enabled():
                return OCRParseResponse(
                    success=False,
                    extracted_text="",
                    field_values={},
                    confidence=0,
                    message="视觉识别功能未启用，请配置 VISION_MODEL 和 VISION_ENABLED 环境变量"
                )

            # 使用专用视觉解析器识别设备铭牌
            vision_result = parse_scale_image(request.image_base64, "铭牌")

            if vision_result.get("success"):
                # 映射到表单字段
                field_values = {
                    "equipmentName": f"{vision_result.get('brand', '')} {vision_result.get('model', '')}".strip(),
                    "brandModel": {
                        "brandName": vision_result.get('brand'),
                        "modelCode": vision_result.get('model'),
                    },
                    "serialNumber": vision_result.get('serial_number'),
                    "maxCapacity": vision_result.get('max_capacity'),
                    "precision": vision_result.get('precision'),
                    "connectionType": vision_result.get('connection_type'),
                    "notes": vision_result.get('notes'),
                }
                # 清理 None 值
                field_values = {k: v for k, v in field_values.items() if v is not None}

                return OCRParseResponse(
                    success=True,
                    extracted_text=vision_result.get('raw_text', ''),
                    field_values=field_values,
                    confidence=vision_result.get('confidence', 0.8),
                    message=vision_result.get('message', '设备识别成功')
                )
            else:
                return OCRParseResponse(
                    success=False,
                    extracted_text=vision_result.get('raw_text', ''),
                    field_values={},
                    confidence=0,
                    message=vision_result.get('message', '设备识别失败')
                )

        # ==================== 通用表单OCR识别 ====================
        # TODO: 集成阿里云OCR API
        # 当前使用模拟OCR结果（用于开发测试）
        # 实际生产环境需要替换为真实OCR调用:
        # https://help.aliyun.com/document_detail/442323.html

        # 模拟OCR结果（根据图片类型返回不同的模拟文本）
        mock_ocr_text = f"""送货单
日期: 2025-12-28
供应商: 东海渔业有限公司
产品: 带鱼 (精选)
数量: 500 kg
批次号: MB-2025-12-28-001
温度记录: -18°C
检验员: 张三
备注: 冷链运输，质量合格"""

        extracted_text = mock_ocr_text

        # 构建提示词
        system_prompt = build_form_parse_prompt(request.form_fields, request.entity_type)

        messages = [
            {"role": "system", "content": system_prompt + "\n\n以下是从单据图片中OCR识别的文字:"},
            {"role": "user", "content": extracted_text}
        ]

        # 调用AI进行结构化提取
        result = query_qwen(messages, enable_thinking=False)
        response_text = result["content"].strip()

        try:
            # 清理markdown代码块
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            response_text = response_text.strip()

            field_values = json.loads(response_text)

            return OCRParseResponse(
                success=True,
                extracted_text=extracted_text,
                field_values=field_values,
                confidence=0.85,  # OCR有额外的不确定性
                message=f"成功从图片解析 {len(field_values)} 个字段"
            )

        except json.JSONDecodeError as e:
            return OCRParseResponse(
                success=False,
                extracted_text=extracted_text,
                field_values={},
                confidence=0,
                message=f"结构化提取失败: {str(e)}"
            )

    except HTTPException as e:
        raise e
    except Exception as e:
        return OCRParseResponse(
            success=False,
            extracted_text="",
            field_values={},
            confidence=0,
            message=f"OCR解析失败: {str(e)}"
        )


@app.get("/api/ai/form/health")
async def form_assistant_health():
    """
    表单助手服务健康检查
    """
    return {
        "service": "form_assistant",
        "status": "running",
        "llm_available": bool(client),
        "vision_enabled": is_vision_enabled(),  # Qwen VL 视觉识别
        "ocr_enabled": False,  # 通用 OCR (待集成阿里云 OCR)
        "schema_generation_enabled": True,  # AI Schema 生成功能
        "supported_entity_types": [
            "MATERIAL_BATCH",
            "QUALITY_CHECK",
            "PROCESSING_BATCH",
            "SHIPMENT",
            "EQUIPMENT",
            "DISPOSAL_RECORD",
            "SCALE_CONFIGURATION"  # 电子秤设备配置
        ],
        "capabilities": [
            "form_parse",           # 语音/文本解析填充表单
            "ocr_parse",            # OCR图片解析 (通用表单)
            "scale_vision_parse",   # 电子秤设备铭牌识别 (Qwen VL)
            "schema_generate"       # AI生成Schema字段
        ]
    }


# ==================== AI Schema 生成端点 ====================

def build_schema_generate_prompt(entity_type: str, existing_fields: List[str] = None) -> str:
    """
    构建 Schema 生成的系统提示词
    """
    entity_type_chinese = {
        'MATERIAL_BATCH': '原材料批次',
        'QUALITY_CHECK': '质检记录',
        'PROCESSING_BATCH': '生产批次',
        'SHIPMENT': '出货记录',
        'EQUIPMENT': '设备信息',
        'DISPOSAL_RECORD': '处置记录'
    }.get(entity_type, entity_type)

    existing_fields_text = ""
    if existing_fields:
        existing_fields_text = f"\n\n现有字段 (避免重复): {', '.join(existing_fields)}"

    # 可用的 Formily 组件映射
    component_guide = """
可用的组件类型:
- Input: 单行文本输入
- Input.TextArea: 多行文本输入
- NumberPicker: 数字输入 (支持 min, max, step)
- Select: 下拉选择 (需要 enum)
- Radio.Group: 单选按钮组 (需要 enum)
- Checkbox.Group: 多选框组 (需要 enum)
- DatePicker: 日期选择
- DatePicker.RangePicker: 日期范围选择
- Switch: 开关 (布尔值)
- Upload: 文件/图片上传
- Rate: 评分 (1-5星)
"""

    return f"""你是白垩纪食品溯源系统的表单配置助手。

你的任务是根据用户的自然语言描述，生成 Formily JSON Schema 格式的字段定义。

当前正在配置: {entity_type_chinese} 表单
{existing_fields_text}

{component_guide}

生成规则:
1. 字段名 (name) 使用 camelCase 英文命名，简洁有意义
2. 中文名 (title) 直接使用用户描述的名称
3. 根据用户描述选择合适的组件类型
4. 如果用户提到数值范围，添加 x-validator 验证规则
5. 如果用户提到条件显示/隐藏，添加 x-reactions 联动规则
6. 如果用户提到"合格标准"，可以建议添加关联字段

输出格式 (严格JSON):
{{
  "fields": [
    {{
      "name": "字段英文名",
      "title": "字段中文名",
      "type": "string|number|boolean|array",
      "description": "字段描述(可选)",
      "x_component": "组件名",
      "x_component_props": {{}},
      "x_decorator": "FormItem",
      "x_decorator_props": {{"label": "字段中文名"}},
      "x_validator": [],
      "x_reactions": {{}},
      "enum": null,
      "default": null
    }}
  ],
  "validation_rules": [
    {{"field": "字段名", "passCondition": "条件描述"}}
  ],
  "suggestions": ["建议1", "建议2"]
}}

注意:
- 只输出JSON，不要有其他文字
- 字段名不要与现有字段重复
- x_reactions 用于条件显示逻辑，格式为 {{"when": "条件", "fulfill": {{"state": {{"visible": true}}}}}}
- 如果用户描述复杂，可以拆分成多个字段"""


@app.post("/api/ai/form/generate-schema", response_model=SchemaGenerateResponse)
async def generate_schema(request: SchemaGenerateRequest):
    """
    AI表单Schema生成 - 根据自然语言描述生成 Formily JSON Schema 字段

    用途:
    - 动态创建新的表单字段
    - 根据业务需求扩展表单结构
    - 工厂自定义配置

    示例:
    输入: "加一个辣度评分字段，1-5分，3分以上合格"
    输出: Formily 格式的字段定义 + 验证规则
    """
    try:
        if not request.user_input or not request.user_input.strip():
            return SchemaGenerateResponse(
                success=False,
                fields=[],
                message="用户输入不能为空"
            )

        # 构建提示词
        system_prompt = build_schema_generate_prompt(
            request.entity_type,
            request.existing_fields
        )

        # 添加上下文信息
        context_text = ""
        if request.context:
            context_items = []
            if request.context.get('factoryName'):
                context_items.append(f"工厂: {request.context['factoryName']}")
            if request.context.get('industry'):
                context_items.append(f"行业: {request.context['industry']}")
            if context_items:
                context_text = "\n\n背景信息:\n" + "\n".join(context_items)

        messages = [
            {"role": "system", "content": system_prompt + context_text},
            {"role": "user", "content": request.user_input}
        ]

        # 调用AI (不启用思考模式，提高速度)
        result = query_qwen(messages, enable_thinking=False)
        response_text = result["content"].strip()

        # 解析JSON响应
        try:
            # 清理可能的markdown代码块
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            response_text = response_text.strip()

            parsed = json.loads(response_text)

            # 提取字段列表
            raw_fields = parsed.get("fields", [])
            fields = []

            for f in raw_fields:
                # 将 x_component 等下划线命名转换
                field = SchemaFieldDefinition(
                    name=f.get("name", ""),
                    title=f.get("title", ""),
                    type=f.get("type", "string"),
                    description=f.get("description"),
                    x_component=f.get("x_component", "Input"),
                    x_component_props=f.get("x_component_props"),
                    x_decorator=f.get("x_decorator", "FormItem"),
                    x_decorator_props=f.get("x_decorator_props"),
                    x_validator=f.get("x_validator"),
                    x_reactions=f.get("x_reactions"),
                    enum=f.get("enum"),
                    default=f.get("default")
                )
                fields.append(field)

            return SchemaGenerateResponse(
                success=True,
                fields=fields,
                validation_rules=parsed.get("validation_rules"),
                suggestions=parsed.get("suggestions"),
                message=f"成功生成 {len(fields)} 个字段定义"
            )

        except json.JSONDecodeError as e:
            return SchemaGenerateResponse(
                success=False,
                fields=[],
                message=f"AI返回格式错误: {str(e)}. 原始响应: {response_text[:200]}"
            )

    except HTTPException as e:
        raise e
    except Exception as e:
        return SchemaGenerateResponse(
            success=False,
            fields=[],
            message=f"Schema生成失败: {str(e)}"
        )


# ==================== AI 规则解析服务 ====================

class RuleParseRequest(BaseModel):
    """规则解析请求"""
    user_input: str  # 用户自然语言描述 (例如: "库存低于500kg时通知采购")
    rule_group: Optional[str] = None  # 规则组 (validation, workflow, costing, quality)
    entity_type: Optional[str] = None  # 实体类型 (MaterialBatch, QualityCheck, etc.)
    factory_id: Optional[str] = None
    context: Optional[Dict] = None  # 可选的上下文信息


class RuleParseResponse(BaseModel):
    """规则解析响应"""
    success: bool
    rule_name: Optional[str] = None  # 生成的规则名称
    rule_description: Optional[str] = None  # 规则描述
    drl_content: Optional[str] = None  # 生成的 DRL 规则内容
    rule_group: Optional[str] = None  # 推荐的规则组
    priority: Optional[int] = None  # 推荐的优先级
    entity_types: Optional[List[str]] = None  # 涉及的实体类型
    ai_explanation: Optional[str] = None  # AI 解释
    suggestions: Optional[List[str]] = None  # 建议
    message: Optional[str] = None


def build_rule_parse_prompt() -> str:
    """
    构建规则解析的系统提示词
    """
    return """你是白垩纪食品溯源系统的规则引擎配置助手。

你的任务是将用户的自然语言描述转换为 Drools DRL 规则。

支持的实体类型 (Fact Types):
1. MaterialBatch - 原材料批次
   - 属性: batchNumber, materialTypeId, quantity, currentQuantity, status, temperature, supplierId, expiryDate
2. ProcessingBatch - 生产批次
   - 属性: batchNumber, productTypeId, plannedQuantity, actualQuantity, status, yieldRate
3. QualityInspection - 质检记录
   - 属性: inspectionNumber, batchId, result, temperature, bacteriaCount, appearance
4. Equipment - 设备
   - 属性: equipmentCode, equipmentName, status, lastMaintenanceDate, operatingHours
5. Shipment - 出货记录
   - 属性: shipmentNumber, customerId, quantity, status, shipmentDate

规则组类型:
- validation: 数据验证规则
- workflow: 工作流规则 (状态转换触发)
- costing: 成本计算规则
- quality: 质量控制规则
- alert: 告警通知规则

可用的内置服务:
- alertService.send(level, title, message) - 发送告警 (level: INFO/WARNING/CRITICAL)
- notifyService.notify(department, message) - 通知部门
- logService.log(entityId, action, details) - 记录日志

DRL 规则格式示例:
```
package com.cretas.aims.rules.{rule_group}

import com.cretas.aims.entity.*;
import com.cretas.aims.service.AlertService;
import com.cretas.aims.service.NotifyService;

global AlertService alertService;
global NotifyService notifyService;

rule "规则中文名"
    salience 10  // 优先级，数字越大越先执行
    when
        $batch : MaterialBatch(currentQuantity < 500)
    then
        alertService.send("WARNING", "库存预警",
            "原材料 " + $batch.getMaterialTypeId() + " 库存不足500kg，当前: " + $batch.getCurrentQuantity() + "kg");
        notifyService.notify("采购部", "请及时补充库存");
end
```

输出格式 (严格JSON):
{
  "rule_name": "低库存预警",
  "rule_description": "当原材料库存低于500kg时发送预警通知",
  "drl_content": "完整的DRL规则内容",
  "rule_group": "alert",
  "priority": 10,
  "entity_types": ["MaterialBatch"],
  "ai_explanation": "这个规则会监控所有原材料批次的当前库存量...",
  "suggestions": ["建议同时添加临界值可配置功能", "可以为不同原料设置不同阈值"]
}

注意:
- 只输出JSON，不要有其他文字
- DRL内容中的引号需要正确转义
- 规则名使用中文
- 优先级(salience)范围: 0-100，数字越大越先执行
- 根据规则语义推断合适的rule_group"""


@app.post("/api/ai/rule/parse", response_model=RuleParseResponse)
async def parse_rule(request: RuleParseRequest):
    """
    AI规则解析 - 将自然语言描述转换为 Drools DRL 规则

    用途:
    - 快速创建业务规则
    - 非技术人员配置规则
    - 规则模板生成

    示例输入:
    "库存低于500kg时通知采购"
    "质检温度超过-15°C时标记不合格"
    "设备运行超过1000小时时提醒维护"

    示例输出:
    完整的 Drools DRL 规则代码
    """
    try:
        if not request.user_input or not request.user_input.strip():
            return RuleParseResponse(
                success=False,
                message="用户输入不能为空"
            )

        # 构建提示词
        system_prompt = build_rule_parse_prompt()

        # 添加上下文信息
        context_text = ""
        if request.rule_group:
            context_text += f"\n用户指定规则组: {request.rule_group}"
        if request.entity_type:
            context_text += f"\n用户指定实体类型: {request.entity_type}"
        if request.context:
            if request.context.get('factoryName'):
                context_text += f"\n工厂: {request.context['factoryName']}"
            if request.context.get('industry'):
                context_text += f"\n行业: {request.context['industry']}"

        messages = [
            {"role": "system", "content": system_prompt + context_text},
            {"role": "user", "content": request.user_input}
        ]

        # 调用AI
        result = query_qwen(messages, enable_thinking=False)
        response_text = result["content"].strip()

        # 解析JSON响应
        try:
            # 清理可能的markdown代码块
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            response_text = response_text.strip()

            parsed = json.loads(response_text)

            return RuleParseResponse(
                success=True,
                rule_name=parsed.get("rule_name"),
                rule_description=parsed.get("rule_description"),
                drl_content=parsed.get("drl_content"),
                rule_group=parsed.get("rule_group", request.rule_group or "validation"),
                priority=parsed.get("priority", 10),
                entity_types=parsed.get("entity_types", []),
                ai_explanation=parsed.get("ai_explanation"),
                suggestions=parsed.get("suggestions"),
                message="规则解析成功"
            )

        except json.JSONDecodeError as e:
            return RuleParseResponse(
                success=False,
                message=f"AI返回格式错误: {str(e)}. 原始响应: {response_text[:300]}"
            )

    except HTTPException as e:
        raise e
    except Exception as e:
        return RuleParseResponse(
            success=False,
            message=f"规则解析失败: {str(e)}"
        )


class StateMachineParseRequest(BaseModel):
    """状态机解析请求"""
    user_input: str  # 用户自然语言描述 (例如: "质检单有待检、合格、不合格、复检四个状态")
    entity_type: str  # 实体类型 (QualityInspection, ProcessingBatch, etc.)
    factory_id: Optional[str] = None
    context: Optional[Dict] = None


class StateDefinition(BaseModel):
    """状态定义"""
    code: str
    name: str
    description: Optional[str] = None
    color: Optional[str] = None
    is_final: bool = False


class TransitionDefinition(BaseModel):
    """转换定义"""
    from_state: str
    to_state: str
    event: str
    guard: Optional[str] = None
    action: Optional[str] = None
    description: Optional[str] = None


class StateMachineParseResponse(BaseModel):
    """状态机解析响应"""
    success: bool
    machine_name: Optional[str] = None
    machine_description: Optional[str] = None
    initial_state: Optional[str] = None
    states: Optional[List[StateDefinition]] = None
    transitions: Optional[List[TransitionDefinition]] = None
    ai_explanation: Optional[str] = None
    suggestions: Optional[List[str]] = None
    message: Optional[str] = None


def build_state_machine_parse_prompt() -> str:
    """
    构建状态机解析的系统提示词
    """
    return """你是白垩纪食品溯源系统的状态机配置助手。

你的任务是根据用户的自然语言描述，生成完整的状态机配置。

状态机用于管理实体的生命周期，例如：
- 质检单: 待检 → 检验中 → 合格/不合格 → (不合格可复检) → 最终结果
- 生产批次: 计划中 → 生产中 → 完成/暂停/取消
- 出货单: 待发货 → 发货中 → 已签收/异常

状态设计规则:
1. 每个状态有唯一的 code (英文小写下划线) 和 name (中文名)
2. 必须有一个初始状态 (initial_state)
3. 可以有多个最终状态 (is_final=true)
4. 转换需要定义触发事件 (event)

状态颜色建议:
- 待处理状态: #F5A623 (橙色)
- 进行中状态: #4A90E2 (蓝色)
- 成功状态: #7ED321 (绿色)
- 失败状态: #D0021B (红色)
- 暂停状态: #9B9B9B (灰色)

输出格式 (严格JSON):
{
  "machine_name": "质检状态机",
  "machine_description": "管理质检单的状态流转",
  "initial_state": "pending",
  "states": [
    {"code": "pending", "name": "待检", "color": "#F5A623", "is_final": false},
    {"code": "inspecting", "name": "检验中", "color": "#4A90E2", "is_final": false},
    {"code": "passed", "name": "合格", "color": "#7ED321", "is_final": true},
    {"code": "failed", "name": "不合格", "color": "#D0021B", "is_final": false},
    {"code": "reinspection", "name": "复检中", "color": "#4A90E2", "is_final": false}
  ],
  "transitions": [
    {"from_state": "pending", "to_state": "inspecting", "event": "START_INSPECTION", "description": "开始检验"},
    {"from_state": "inspecting", "to_state": "passed", "event": "MARK_PASSED", "guard": "result == 'pass'", "description": "标记合格"},
    {"from_state": "inspecting", "to_state": "failed", "event": "MARK_FAILED", "guard": "result == 'fail'", "description": "标记不合格"},
    {"from_state": "failed", "to_state": "reinspection", "event": "REQUEST_REINSPECTION", "description": "申请复检"}
  ],
  "ai_explanation": "根据描述生成了5个状态和4个转换...",
  "suggestions": ["建议添加不合格处置状态", "可以添加审批流程"]
}

注意:
- 只输出JSON，不要有其他文字
- 状态code使用英文小写下划线命名
- 事件event使用英文大写下划线命名
- guard是可选的守卫条件表达式
- action是可选的动作名称"""


@app.post("/api/ai/state-machine/parse", response_model=StateMachineParseResponse)
async def parse_state_machine(request: StateMachineParseRequest):
    """
    AI状态机解析 - 将自然语言描述转换为状态机配置

    用途:
    - 快速创建实体状态机
    - 可视化状态流程设计
    - 业务流程配置

    示例输入:
    "质检单有待检、合格、不合格三个状态，不合格可以申请复检"

    示例输出:
    完整的状态机配置 (状态列表 + 转换规则)
    """
    try:
        if not request.user_input or not request.user_input.strip():
            return StateMachineParseResponse(
                success=False,
                message="用户输入不能为空"
            )

        # 构建提示词
        system_prompt = build_state_machine_parse_prompt()

        # 添加上下文信息
        context_text = f"\n正在配置的实体类型: {request.entity_type}"
        if request.context:
            if request.context.get('factoryName'):
                context_text += f"\n工厂: {request.context['factoryName']}"
            if request.context.get('industry'):
                context_text += f"\n行业: {request.context['industry']}"

        messages = [
            {"role": "system", "content": system_prompt + context_text},
            {"role": "user", "content": request.user_input}
        ]

        # 调用AI
        result = query_qwen(messages, enable_thinking=False)
        response_text = result["content"].strip()

        # 解析JSON响应
        try:
            # 清理可能的markdown代码块
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            response_text = response_text.strip()

            parsed = json.loads(response_text)

            # 解析状态列表
            states = []
            for s in parsed.get("states", []):
                states.append(StateDefinition(
                    code=s.get("code", ""),
                    name=s.get("name", ""),
                    description=s.get("description"),
                    color=s.get("color"),
                    is_final=s.get("is_final", False)
                ))

            # 解析转换列表
            transitions = []
            for t in parsed.get("transitions", []):
                transitions.append(TransitionDefinition(
                    from_state=t.get("from_state", ""),
                    to_state=t.get("to_state", ""),
                    event=t.get("event", ""),
                    guard=t.get("guard"),
                    action=t.get("action"),
                    description=t.get("description")
                ))

            return StateMachineParseResponse(
                success=True,
                machine_name=parsed.get("machine_name"),
                machine_description=parsed.get("machine_description"),
                initial_state=parsed.get("initial_state"),
                states=states,
                transitions=transitions,
                ai_explanation=parsed.get("ai_explanation"),
                suggestions=parsed.get("suggestions"),
                message=f"成功生成 {len(states)} 个状态和 {len(transitions)} 个转换"
            )

        except json.JSONDecodeError as e:
            return StateMachineParseResponse(
                success=False,
                message=f"AI返回格式错误: {str(e)}"
            )

    except HTTPException as e:
        raise e
    except Exception as e:
        return StateMachineParseResponse(
            success=False,
            message=f"状态机解析失败: {str(e)}"
        )


@app.get("/api/ai/rule/health")
async def rule_service_health():
    """
    规则解析服务健康检查
    """
    return {
        "service": "rule_parser",
        "status": "running",
        "llm_available": bool(client),
        "capabilities": [
            "drl_generation",       # DRL 规则生成
            "state_machine_design", # 状态机设计
            "rule_validation"       # 规则验证 (TODO)
        ],
        "supported_rule_groups": [
            "validation",
            "workflow",
            "costing",
            "quality",
            "alert"
        ],
        "supported_entity_types": [
            "MaterialBatch",
            "ProcessingBatch",
            "QualityInspection",
            "Equipment",
            "Shipment"
        ]
    }


# ==================== 调度服务端点 ====================

# 导入调度服务模块
try:
    from scheduling_service import (
        CompletionProbabilityRequest,
        CompletionProbabilityResponse,
        OptimizeWorkersRequest,
        OptimizeWorkersResponse,
        GenerateScheduleRequest,
        RescheduleRequest,
        calculate_completion_probability,
        optimize_workers,
        generate_schedule,
        reschedule,
        insight_generator
    )
    SCHEDULING_SERVICE_AVAILABLE = True
except ImportError as e:
    print(f"[WARN] Scheduling service not available: {e}")
    SCHEDULING_SERVICE_AVAILABLE = False


@app.post("/scheduling/completion-probability")
async def scheduling_completion_probability(request: dict):
    """
    Monte Carlo 模拟 - 计算生产完成概率

    输入:
    - factory_id: 工厂ID
    - schedule_id: 排程ID
    - remaining_quantity: 剩余数量
    - deadline: 截止时间 (ISO格式)
    - assigned_workers: 分配工人数
    - efficiency_mean: 效率均值 (可选)
    - efficiency_std: 效率标准差 (可选)

    输出:
    - probability: 按时完成概率
    - mean_hours: 预计完成时间均值
    - confidence_lower/upper: 置信区间
    - insight: AI 洞察文本
    """
    if not SCHEDULING_SERVICE_AVAILABLE:
        raise HTTPException(status_code=500, detail="调度服务不可用")

    try:
        from scheduling_service import CompletionProbabilityRequest as CPRequest
        req = CPRequest(**request)
        result = calculate_completion_probability(req)
        return result.dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"计算完成概率失败: {str(e)}")


@app.post("/scheduling/optimize-workers")
async def scheduling_optimize_workers(request: dict):
    """
    OR-Tools 优化 - 工人分配优化

    输入:
    - factory_id: 工厂ID
    - plan_id: 计划ID
    - workers: 工人列表 [{'id', 'skill', 'cost_per_hour', 'is_temporary'}]
    - schedules: 排程列表 [{'id', 'required_skill', 'min_workers', 'max_workers'}]
    - objective: 优化目标 (minimize_cost/maximize_efficiency/balanced)
    - max_temporary_ratio: 最大临时工比例

    输出:
    - assignments: 分配结果 [{'worker_id', 'schedule_id', 'assignment_type'}]
    - total_cost: 总成本
    - efficiency_score: 效率评分
    """
    if not SCHEDULING_SERVICE_AVAILABLE:
        raise HTTPException(status_code=500, detail="调度服务不可用")

    try:
        from scheduling_service import OptimizeWorkersRequest as OWRequest
        req = OWRequest(**request)
        result = optimize_workers(req)
        return result.dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"人员优化失败: {str(e)}")


@app.post("/scheduling/generate")
async def scheduling_generate(request: dict):
    """
    AI 生成调度建议

    输入:
    - factory_id: 工厂ID
    - plan_date: 计划日期 (YYYY-MM-DD)
    - batch_ids: 批次ID列表
    - production_line_ids: 产线ID列表 (可选)
    - available_worker_ids: 可用工人ID列表 (可选)
    - target_completion_probability: 目标完成概率

    输出:
    - schedules: 生成的排程列表
    - confidence: AI 置信度
    """
    if not SCHEDULING_SERVICE_AVAILABLE:
        raise HTTPException(status_code=500, detail="调度服务不可用")

    try:
        from scheduling_service import GenerateScheduleRequest as GSRequest
        req = GSRequest(**request)
        result = generate_schedule(req)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成调度失败: {str(e)}")


@app.post("/scheduling/reschedule")
async def scheduling_reschedule(request: dict):
    """
    重新调度

    输入:
    - factory_id: 工厂ID
    - plan_id: 计划ID
    - reason: 重新调度原因
    - keep_completed: 是否保留已完成的排程
    - schedule_ids_to_reschedule: 需要重新调度的排程ID
    - unavailable_worker_ids: 不可用工人ID

    输出:
    - updated_schedules: 更新后的排程列表
    """
    if not SCHEDULING_SERVICE_AVAILABLE:
        raise HTTPException(status_code=500, detail="调度服务不可用")

    try:
        from scheduling_service import RescheduleRequest as RSRequest
        req = RSRequest(**request)
        result = reschedule(req)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"重新调度失败: {str(e)}")


@app.post("/scheduling/explain-alert")
async def scheduling_explain_alert(request: dict):
    """
    LLM 解释告警原因

    输入:
    - alert_type: 告警类型
    - schedule_data: 排程数据
    - probability: 完成概率

    输出:
    - explanation: 告警解释文本
    - recommendations: 建议措施
    """
    if not SCHEDULING_SERVICE_AVAILABLE:
        raise HTTPException(status_code=500, detail="调度服务不可用")

    try:
        alert_type = request.get('alert_type', 'low_probability')
        schedule_data = request.get('schedule_data', {})
        probability = request.get('probability', 0.5)

        explanation = insight_generator.explain_alert(alert_type, schedule_data, probability)

        return {
            'success': True,
            'explanation': explanation,
            'alert_type': alert_type,
            'probability': probability
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"解释告警失败: {str(e)}")


@app.get("/scheduling/health")
async def scheduling_health():
    """
    调度服务健康检查
    """
    return {
        'service': 'scheduling',
        'status': 'running' if SCHEDULING_SERVICE_AVAILABLE else 'unavailable',
        'monte_carlo': True,
        'ortools': SCHEDULING_SERVICE_AVAILABLE,
        'llm_available': bool(client)
    }


# ==================== ML训练和混合预测 ====================

# 导入ML模块
ML_SERVICE_AVAILABLE = False
try:
    from ml_trainer import train_models, model_loader
    from hybrid_predictor import (
        hybrid_predictor, predict_with_hybrid,
        predict_completion, get_model_status
    )
    ML_SERVICE_AVAILABLE = True
except ImportError as e:
    print(f"[WARN] ML服务未加载: {e}")


@app.post("/ml/train")
async def ml_train_models(request: dict):
    """
    触发模型训练

    输入:
    - factory_id: 工厂ID
    - model_types: 模型类型列表 ["efficiency", "duration", "quality"]

    输出:
    - success: 是否成功
    - results: 各模型训练结果
    """
    if not ML_SERVICE_AVAILABLE:
        raise HTTPException(status_code=500, detail="ML服务不可用")

    try:
        factory_id = request.get('factory_id')
        model_types = request.get('model_types', ['efficiency', 'duration', 'quality'])

        if not factory_id:
            raise HTTPException(status_code=400, detail="factory_id 不能为空")

        result = train_models(factory_id, model_types)
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"训练失败: {str(e)}")


@app.post("/ml/predict")
async def ml_predict(request: dict):
    """
    使用ML模型进行预测

    输入:
    - factory_id: 工厂ID
    - prediction_type: 预测类型 (efficiency/duration/quality)
    - features: 特征数据

    输出:
    - prediction: 预测值
    - confidence: 置信度
    - model_version: 模型版本
    """
    if not ML_SERVICE_AVAILABLE:
        raise HTTPException(status_code=500, detail="ML服务不可用")

    try:
        factory_id = request.get('factory_id')
        prediction_type = request.get('prediction_type', 'efficiency')
        features = request.get('features', {})

        result = predict_with_hybrid(factory_id, features, prediction_type)
        return {
            'success': True,
            **result
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"预测失败: {str(e)}")


@app.post("/scheduling/hybrid-predict")
async def scheduling_hybrid_predict(request: dict):
    """
    混合预测完成概率 (ML + Monte Carlo + LLM)

    输入:
    - factory_id: 工厂ID
    - remaining_quantity: 剩余数量
    - deadline_hours: 截止时间(小时)
    - available_workers: 可用工人数
    - 其他特征...

    输出:
    - probability: 完成概率
    - mean_hours: 预计平均时长
    - mode: 预测模式 (hybrid/llm_only)
    - explanation: 解释
    """
    if not ML_SERVICE_AVAILABLE:
        # 回退到基础Monte Carlo
        raise HTTPException(status_code=500, detail="ML服务不可用，请使用 /scheduling/completion-probability")

    try:
        factory_id = request.get('factory_id')
        if not factory_id:
            raise HTTPException(status_code=400, detail="factory_id 不能为空")

        result = predict_completion(factory_id, request)
        return {
            'success': True,
            **result
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"混合预测失败: {str(e)}")


@app.get("/ml/status/{factory_id}")
async def ml_model_status(factory_id: str):
    """
    获取工厂的ML模型状态

    输出:
    - models: 各类型模型的可用状态
    """
    if not ML_SERVICE_AVAILABLE:
        return {
            'factory_id': factory_id,
            'ml_service_available': False,
            'models': {}
        }

    try:
        status = get_model_status(factory_id)
        status['ml_service_available'] = True
        return status

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取状态失败: {str(e)}")


@app.get("/ml/health")
async def ml_health():
    """
    ML服务健康检查
    """
    return {
        'service': 'ml',
        'status': 'running' if ML_SERVICE_AVAILABLE else 'unavailable',
        'lightgbm_available': ML_SERVICE_AVAILABLE,
        'hybrid_predictor_available': ML_SERVICE_AVAILABLE
    }


# ==================== 意图识别 Fallback 服务 ====================

class IntentClassifyRequest(BaseModel):
    """意图分类请求"""
    user_input: str                          # 用户原始输入
    factory_id: str                          # 工厂ID
    available_intents: List[Dict[str, Any]]  # 可用意图列表 [{code, name, description, category}]
    context: Optional[Dict] = None           # 上下文信息
    user_id: Optional[int] = None            # 用户ID
    session_id: Optional[str] = None         # 会话ID

class IntentCandidate(BaseModel):
    """候选意图"""
    intent_code: str
    intent_name: str
    confidence: float  # 0.0-1.0
    reasoning: Optional[str] = None

class IntentClassifyResponse(BaseModel):
    """意图分类响应"""
    success: bool
    matched_intent_code: Optional[str] = None
    matched_intent_name: Optional[str] = None
    confidence: float
    candidates: List[IntentCandidate]
    is_ambiguous: bool               # 是否有歧义
    needs_clarification: bool        # 是否需要澄清
    clarification_question: Optional[str] = None
    reasoning: Optional[str] = None  # AI推理过程
    message: Optional[str] = None

class IntentClarifyRequest(BaseModel):
    """澄清问题生成请求"""
    user_input: str
    candidates: List[Dict[str, Any]]  # 候选意图列表
    factory_id: str
    context: Optional[Dict] = None

class IntentClarifyResponse(BaseModel):
    """澄清问题响应"""
    success: bool
    clarification_question: str      # 生成的澄清问题
    options: List[Dict[str, str]]    # 选项列表 [{value, label}]
    message: Optional[str] = None


def build_intent_classify_prompt(user_input: str, available_intents: List[Dict]) -> str:
    """构建意图分类提示词"""
    intent_list = "\n".join([
        f"- {intent.get('intent_code', intent.get('code', ''))}: {intent.get('intent_name', intent.get('name', ''))} ({intent.get('description', '')})"
        for intent in available_intents
    ])

    return f"""你是一个专业的意图识别助手，负责分析用户输入并匹配最合适的意图。

## 可用意图列表:
{intent_list}

## 用户输入:
"{user_input}"

## 任务要求:
1. 分析用户输入的含义
2. 从可用意图列表中选择最匹配的意图
3. 给出置信度评分 (0.0-1.0)
4. 如果有多个可能的意图，列出Top-3候选
5. 如果置信度低于0.7，标记为需要澄清

## 输出格式 (JSON):
{{
    "matched_intent_code": "意图代码或null",
    "matched_intent_name": "意图名称",
    "confidence": 0.85,
    "candidates": [
        {{"intent_code": "代码", "intent_name": "名称", "confidence": 0.85}},
        {{"intent_code": "代码2", "intent_name": "名称2", "confidence": 0.65}}
    ],
    "is_ambiguous": false,
    "needs_clarification": false,
    "reasoning": "分析过程说明"
}}

请只返回JSON格式，不要有其他内容。"""


def build_clarify_question_prompt(user_input: str, candidates: List[Dict]) -> str:
    """构建澄清问题生成提示词"""
    candidate_list = "\n".join([
        f"- {c.get('intent_code', c.get('code', ''))}: {c.get('intent_name', c.get('name', ''))}"
        for c in candidates
    ])

    return f"""你是一个友好的对话助手，需要生成一个澄清问题来帮助用户明确他们的意图。

## 用户原始输入:
"{user_input}"

## 可能的意图:
{candidate_list}

## 任务要求:
1. 生成一个简短、友好的澄清问题
2. 问题应该帮助区分这些候选意图
3. 提供清晰的选项让用户选择
4. 使用自然的中文表达

## 输出格式 (JSON):
{{
    "clarification_question": "请问您是想要...还是...?",
    "options": [
        {{"value": "intent_code1", "label": "选项1描述"}},
        {{"value": "intent_code2", "label": "选项2描述"}}
    ]
}}

请只返回JSON格式，不要有其他内容。"""


@app.post("/api/ai/intent/classify", response_model=IntentClassifyResponse)
async def classify_intent(request: IntentClassifyRequest):
    """
    意图分类 - LLM Fallback

    当规则匹配失败或置信度低时，使用LLM进行意图分类

    输入:
    - user_input: 用户原始输入
    - available_intents: 可用意图列表

    输出:
    - matched_intent_code: 匹配的意图代码
    - confidence: 置信度 (0-1)
    - candidates: 候选意图列表
    - needs_clarification: 是否需要澄清
    """
    if not client:
        raise HTTPException(status_code=500, detail="DASHSCOPE_API_KEY未配置")

    try:
        # 构建提示词
        prompt = build_intent_classify_prompt(
            request.user_input,
            request.available_intents
        )

        messages = [
            {"role": "system", "content": "你是食品加工溯源系统的智能意图识别助手。"},
            {"role": "user", "content": prompt}
        ]

        # 调用Qwen
        result = query_qwen(messages, enable_thinking=False)
        content = result.get("content", "")

        # 解析JSON响应
        try:
            # 尝试提取JSON部分
            json_start = content.find("{")
            json_end = content.rfind("}") + 1
            if json_start >= 0 and json_end > json_start:
                json_str = content[json_start:json_end]
                parsed = json.loads(json_str)
            else:
                raise ValueError("No JSON found in response")

            # 构建候选列表
            candidates = []
            for c in parsed.get("candidates", []):
                candidates.append(IntentCandidate(
                    intent_code=c.get("intent_code", ""),
                    intent_name=c.get("intent_name", ""),
                    confidence=float(c.get("confidence", 0)),
                    reasoning=c.get("reasoning")
                ))

            confidence = float(parsed.get("confidence", 0))
            is_ambiguous = parsed.get("is_ambiguous", False)
            needs_clarification = parsed.get("needs_clarification", confidence < 0.7)

            # 如果需要澄清且有多候选，生成澄清问题
            clarification_question = None
            if needs_clarification and len(candidates) > 1:
                clarify_prompt = build_clarify_question_prompt(
                    request.user_input,
                    [{"intent_code": c.intent_code, "intent_name": c.intent_name} for c in candidates]
                )
                clarify_messages = [
                    {"role": "system", "content": "你是一个友好的对话助手。"},
                    {"role": "user", "content": clarify_prompt}
                ]
                clarify_result = query_qwen(clarify_messages, enable_thinking=False)
                try:
                    clarify_json = json.loads(clarify_result.get("content", "{}"))
                    clarification_question = clarify_json.get("clarification_question")
                except:
                    clarification_question = f"请问您是想要 {candidates[0].intent_name} 还是 {candidates[1].intent_name}？"

            return IntentClassifyResponse(
                success=True,
                matched_intent_code=parsed.get("matched_intent_code"),
                matched_intent_name=parsed.get("matched_intent_name"),
                confidence=confidence,
                candidates=candidates,
                is_ambiguous=is_ambiguous,
                needs_clarification=needs_clarification,
                clarification_question=clarification_question,
                reasoning=parsed.get("reasoning")
            )

        except json.JSONDecodeError as je:
            return IntentClassifyResponse(
                success=False,
                matched_intent_code=None,
                matched_intent_name=None,
                confidence=0,
                candidates=[],
                is_ambiguous=True,
                needs_clarification=True,
                message=f"LLM响应解析失败: {str(je)}"
            )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"意图分类失败: {str(e)}")


@app.post("/api/ai/intent/clarify", response_model=IntentClarifyResponse)
async def generate_clarification(request: IntentClarifyRequest):
    """
    生成澄清问题

    当意图识别有歧义时，生成友好的澄清问题帮助用户选择

    输入:
    - user_input: 用户原始输入
    - candidates: 候选意图列表

    输出:
    - clarification_question: 澄清问题
    - options: 选项列表
    """
    if not client:
        raise HTTPException(status_code=500, detail="DASHSCOPE_API_KEY未配置")

    try:
        prompt = build_clarify_question_prompt(request.user_input, request.candidates)

        messages = [
            {"role": "system", "content": "你是一个友好的对话助手，擅长生成自然的澄清问题。"},
            {"role": "user", "content": prompt}
        ]

        result = query_qwen(messages, enable_thinking=False)
        content = result.get("content", "")

        try:
            json_start = content.find("{")
            json_end = content.rfind("}") + 1
            if json_start >= 0 and json_end > json_start:
                parsed = json.loads(content[json_start:json_end])
            else:
                raise ValueError("No JSON found")

            return IntentClarifyResponse(
                success=True,
                clarification_question=parsed.get("clarification_question", "请问您具体想要做什么？"),
                options=parsed.get("options", [])
            )

        except:
            # 降级：生成简单的澄清问题
            options = [
                {"value": c.get("intent_code", c.get("code", "")),
                 "label": c.get("intent_name", c.get("name", ""))}
                for c in request.candidates[:3]
            ]
            return IntentClarifyResponse(
                success=True,
                clarification_question="请问您是想要进行以下哪项操作？",
                options=options
            )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成澄清问题失败: {str(e)}")


# ==================== 数据操作解析服务 (BUG-003 修复) ====================

class DataOperationParseRequest(BaseModel):
    """数据操作解析请求"""
    user_input: str                          # 用户原始输入
    factory_id: str                          # 工厂ID
    supported_entities: List[str]            # 支持的实体类型列表
    context: Optional[Dict] = None           # 上下文信息

class DataOperationParseResponse(BaseModel):
    """数据操作解析响应"""
    success: bool
    entity_type: Optional[str] = None        # 实体类型
    entity_identifier: Optional[str] = None  # 实体标识符
    updates: Optional[Dict[str, Any]] = None # 更新字段
    operation: Optional[str] = None          # 操作类型: UPDATE, DELETE, CREATE
    message: Optional[str] = None            # 消息

@app.post("/api/ai/intent/parse-data-operation", response_model=DataOperationParseResponse)
async def parse_data_operation(request: DataOperationParseRequest):
    """
    解析数据操作意图，提取实体类型、标识符和更新字段

    BUG-003 修复: 添加此端点支持 DataOperationIntentHandler 的 AI 解析
    """
    try:
        user_input = request.user_input.strip()

        if not user_input:
            return DataOperationParseResponse(
                success=False,
                message="用户输入为空"
            )

        if not client:
            return DataOperationParseResponse(
                success=False,
                message="AI服务未配置"
            )

        # 构建解析提示词
        entities_desc = ", ".join(request.supported_entities)
        prompt = f"""你是一个数据操作解析助手。请分析用户输入，提取以下信息:
1. 实体类型 (entity_type): 用户想操作哪种实体？选择: {entities_desc}
2. 实体标识 (entity_identifier): 实体的ID或名称（如果用户提到）
3. 操作类型 (operation): UPDATE（修改）、CREATE（创建）、DELETE（删除）
4. 更新字段 (updates): 如果是UPDATE操作，提取要更新的字段和新值

用户输入: "{user_input}"

请以JSON格式返回:
{{
    "entity_type": "实体类型（英文）",
    "entity_identifier": "实体标识（可以为null）",
    "operation": "UPDATE|CREATE|DELETE",
    "updates": {{"字段名": "新值"}}
}}

注意:
- entity_type 必须是: {entities_desc} 之一
- 常见字段映射: 单价/价格→unitPrice, 名称→name, 数量→quantity, 状态→status
- 如果用户提到"产品"但没有指定ID，entity_identifier可以为null"""

        # 调用 LLM
        response = client.chat.completions.create(
            model=DASHSCOPE_MODEL,
            messages=[
                {"role": "system", "content": "你是一个精确的数据操作解析器，只返回JSON格式的结果。"},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,  # 低温度确保一致性
            response_format={"type": "json_object"}
        )

        result_text = response.choices[0].message.content.strip()

        try:
            result = json.loads(result_text)

            entity_type = result.get("entity_type")
            entity_identifier = result.get("entity_identifier")
            operation = result.get("operation", "UPDATE")
            updates = result.get("updates", {})

            # 验证实体类型
            if entity_type and entity_type not in request.supported_entities:
                # 尝试映射
                entity_map = {
                    "产品": "ProductType",
                    "产品类型": "ProductType",
                    "生产计划": "ProductionPlan",
                    "生产批次": "ProcessingBatch",
                    "原料批次": "MaterialBatch",
                    "原料": "MaterialBatch"
                }
                entity_type = entity_map.get(entity_type, entity_type)

            return DataOperationParseResponse(
                success=True,
                entity_type=entity_type,
                entity_identifier=entity_identifier,
                operation=operation,
                updates=updates
            )

        except json.JSONDecodeError:
            return DataOperationParseResponse(
                success=False,
                message=f"AI响应解析失败: {result_text[:100]}"
            )

    except Exception as e:
        return DataOperationParseResponse(
            success=False,
            message=f"解析失败: {str(e)}"
        )


@app.get("/api/ai/intent/health")
async def intent_health():
    """意图识别服务健康检查"""
    return {
        'service': 'intent-classifier',
        'status': 'running' if client else 'unavailable',
        'model': DASHSCOPE_MODEL,
        'api_configured': bool(DASHSCOPE_API_KEY)
    }


# ==================== 启动 ====================
if __name__ == "__main__":
    import uvicorn
    import sys

    # 修复Windows终端编码问题
    if sys.platform == 'win32':
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

    print("\n" + "="*50)
    print("[START] AI Cost Analysis Service")
    print("="*50)
    print(f"Model: Alibaba Qwen ({DASHSCOPE_MODEL})")
    print(f"Port: 8085")

    if not DASHSCOPE_API_KEY:
        print("[WARN] DASHSCOPE_API_KEY not configured")
        print("Please set in .env: DASHSCOPE_API_KEY=sk-xxx")
    else:
        print("[OK] API Key configured")

    # 预热 Embedding 模型 (可选)
    if EMBEDDING_ENABLED:
        print("[INFO] Embedding service enabled (Sentence-BERT)")
        # 启动时不自动预热，首次请求时懒加载
        # warmup_embedding()
    else:
        print("[WARN] Embedding service disabled")

    print("="*50 + "\n")

    uvicorn.run("main:app", host="0.0.0.0", port=8085, reload=True)
