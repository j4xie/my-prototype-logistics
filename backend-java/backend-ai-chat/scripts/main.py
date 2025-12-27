"""
白垩纪食品溯源系统 - AI食品加工数据分析服务
基于阿里云通义千问 (DashScope) 的智能分析API
支持思考模式 (Thinking Mode) - 深度推理分析
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Dict, List
import os
import json
from dotenv import load_dotenv

# 导入 OpenAI SDK (阿里云 DashScope 兼容 OpenAI 格式)
from openai import OpenAI

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

    print("="*50 + "\n")

    uvicorn.run("main:app", host="0.0.0.0", port=8085, reload=True)
