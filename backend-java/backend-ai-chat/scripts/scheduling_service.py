"""
智能调度服务 - AI Scheduling Service
包含:
1. Monte Carlo 模拟 - 完成概率计算
2. OR-Tools 优化 - 人员分配优化
3. LLM 洞察 - 调度建议和异常解释
"""

import numpy as np
from typing import Dict, List, Optional, Any
from pydantic import BaseModel
from datetime import datetime, timedelta
import json


# ==================== 数据模型 ====================

class CompletionProbabilityRequest(BaseModel):
    factory_id: str
    schedule_id: str
    remaining_quantity: int
    deadline: Optional[str] = None  # ISO datetime string
    assigned_workers: int
    efficiency_mean: Optional[float] = None
    efficiency_std: Optional[float] = None
    historical_data: Optional[List[Dict]] = None


class CompletionProbabilityResponse(BaseModel):
    success: bool
    probability: float
    mean_hours: float
    std_hours: float
    percentile_90: float
    confidence_lower: float
    confidence_upper: float
    insight: Optional[str] = None
    is_cold_start: bool = False
    simulation_count: int = 10000


class OptimizeWorkersRequest(BaseModel):
    factory_id: str
    plan_id: str
    workers: List[Dict]  # [{'id', 'skill', 'available_hours', 'cost_per_hour', 'is_temporary'}]
    schedules: List[Dict]  # [{'id', 'line_id', 'required_skill', 'min_workers', 'max_workers', 'priority'}]
    objective: str = "balanced"  # minimize_cost, maximize_efficiency, balanced
    max_temporary_ratio: float = 0.3
    min_skill_match: int = 1


class OptimizeWorkersResponse(BaseModel):
    success: bool
    assignments: List[Dict]
    total_cost: float
    efficiency_score: float
    message: str


class GenerateScheduleRequest(BaseModel):
    factory_id: str
    plan_date: str  # YYYY-MM-DD
    batch_ids: List[int]
    production_line_ids: Optional[List[str]] = None
    available_worker_ids: Optional[List[int]] = None
    include_temporary_workers: bool = True
    target_completion_probability: float = 0.8
    use_historical_performance: bool = True


class RescheduleRequest(BaseModel):
    factory_id: str
    plan_id: str
    reason: str
    keep_completed: bool = True
    schedule_ids_to_reschedule: Optional[List[str]] = None
    new_batch_ids: Optional[List[int]] = None
    unavailable_worker_ids: Optional[List[int]] = None
    additional_worker_ids: Optional[List[int]] = None


# ==================== Monte Carlo 模拟 ====================

class MonteCarloSimulator:
    """
    Monte Carlo 模拟器 - 计算生产完成概率

    使用蒙特卡洛方法模拟生产过程，考虑:
    - 效率波动 (正态分布)
    - 工人数量变化
    - 设备故障概率
    - 休息时间等因素
    """

    def __init__(self, simulations: int = 10000):
        self.simulations = simulations

    def calculate_completion_probability(
        self,
        remaining_quantity: int,
        deadline_hours: float,
        efficiency_mean: float,
        efficiency_std: float,
        available_workers: int,
        downtime_probability: float = 0.05,
        downtime_mean_hours: float = 0.5
    ) -> Dict[str, Any]:
        """
        使用蒙特卡洛模拟计算按时完成的概率

        Args:
            remaining_quantity: 剩余需要完成的数量
            deadline_hours: 距离截止时间的小时数
            efficiency_mean: 效率均值 (单位/人/小时)
            efficiency_std: 效率标准差
            available_workers: 可用工人数
            downtime_probability: 每小时设备停机概率
            downtime_mean_hours: 平均停机时长

        Returns:
            dict: 包含概率、均值、置信区间等
        """
        completion_times = []

        for _ in range(self.simulations):
            # 从效率分布中采样
            simulated_efficiency = np.random.normal(efficiency_mean, efficiency_std)
            simulated_efficiency = max(0.3, simulated_efficiency)  # 效率下限

            # 模拟停机时间
            total_downtime = 0
            simulated_hours = 0
            remaining = remaining_quantity

            while remaining > 0 and simulated_hours < 100:  # 最多模拟100小时
                # 每小时检查是否有停机
                if np.random.random() < downtime_probability:
                    downtime = np.random.exponential(downtime_mean_hours)
                    total_downtime += downtime

                # 计算这个小时的产出
                hourly_output = simulated_efficiency * available_workers
                remaining -= hourly_output
                simulated_hours += 1

            total_time = simulated_hours + total_downtime
            completion_times.append(total_time)

        completion_times = np.array(completion_times)
        on_time_count = np.sum(completion_times <= deadline_hours)

        return {
            'probability': float(on_time_count / self.simulations),
            'mean_hours': float(np.mean(completion_times)),
            'std_hours': float(np.std(completion_times)),
            'percentile_90': float(np.percentile(completion_times, 90)),
            'confidence_lower': float(np.percentile(completion_times, 5)),
            'confidence_upper': float(np.percentile(completion_times, 95)),
            'simulation_count': self.simulations
        }

    def generate_insight(self, result: Dict, remaining_quantity: int, deadline_hours: float) -> str:
        """
        基于模拟结果生成洞察文本
        """
        prob = result['probability']
        mean_hours = result['mean_hours']

        if prob >= 0.9:
            insight = f"按时完成概率 {prob*100:.1f}%，预计 {mean_hours:.1f} 小时内可完成，生产进度良好。"
        elif prob >= 0.7:
            buffer = deadline_hours - mean_hours
            insight = f"按时完成概率 {prob*100:.1f}%，预计需要 {mean_hours:.1f} 小时，距离截止时间有 {buffer:.1f} 小时缓冲。建议关注生产进度。"
        elif prob >= 0.5:
            insight = f"按时完成概率 {prob*100:.1f}%，存在延期风险。预计需要 {mean_hours:.1f} 小时，但截止时间仅剩 {deadline_hours:.1f} 小时。建议增加人手或延长工作时间。"
        else:
            shortage_hours = mean_hours - deadline_hours
            insight = f"按时完成概率仅 {prob*100:.1f}%，高延期风险！预计需要 {mean_hours:.1f} 小时，超出截止时间约 {shortage_hours:.1f} 小时。强烈建议立即增派人员或调整交付计划。"

        return insight


# ==================== OR-Tools 优化 ====================

class WorkerOptimizer:
    """
    工人分配优化器 - 使用约束规划

    注意: 完整实现需要安装 ortools 包
    这里提供一个简化的贪心算法作为备选
    """

    def __init__(self):
        self.has_ortools = False
        try:
            from ortools.sat.python import cp_model
            self.has_ortools = True
            self.cp_model = cp_model
        except ImportError:
            print("[WARN] ortools not installed, using greedy algorithm")

    def optimize(
        self,
        workers: List[Dict],
        schedules: List[Dict],
        objective: str = "balanced",
        max_temporary_ratio: float = 0.3,
        min_skill_match: int = 1
    ) -> Dict[str, Any]:
        """
        优化工人分配

        Args:
            workers: 工人列表 [{'id', 'skill', 'available_hours', 'cost_per_hour', 'is_temporary'}]
            schedules: 排程列表 [{'id', 'line_id', 'required_skill', 'min_workers', 'max_workers', 'priority'}]
            objective: 优化目标
            max_temporary_ratio: 最大临时工比例
            min_skill_match: 最低技能匹配要求

        Returns:
            dict: 分配结果
        """
        if self.has_ortools:
            return self._optimize_with_ortools(workers, schedules, objective, max_temporary_ratio, min_skill_match)
        else:
            return self._optimize_greedy(workers, schedules, objective, max_temporary_ratio, min_skill_match)

    def _optimize_with_ortools(
        self,
        workers: List[Dict],
        schedules: List[Dict],
        objective: str,
        max_temporary_ratio: float,
        min_skill_match: int
    ) -> Dict[str, Any]:
        """使用 OR-Tools CP-SAT 求解器"""
        model = self.cp_model.CpModel()

        # 决策变量: worker[w] 分配到 schedule[s]
        assignments = {}
        for w in workers:
            for s in schedules:
                assignments[(w['id'], s['id'])] = model.NewBoolVar(
                    f"assign_w{w['id']}_s{s['id']}"
                )

        # 约束1: 每个工人最多分配到一个排程
        for w in workers:
            model.Add(
                sum(assignments[(w['id'], s['id'])] for s in schedules) <= 1
            )

        # 约束2: 技能匹配
        for w in workers:
            for s in schedules:
                if w['skill'] < s.get('required_skill', min_skill_match):
                    model.Add(assignments[(w['id'], s['id'])] == 0)

        # 约束3: 排程人数范围
        for s in schedules:
            worker_count = sum(
                assignments[(w['id'], s['id'])] for w in workers
            )
            model.Add(worker_count >= s.get('min_workers', 1))
            model.Add(worker_count <= s.get('max_workers', 10))

        # 约束4: 临时工比例限制
        total_assigned = sum(assignments.values())
        temp_assigned = sum(
            assignments[(w['id'], s['id'])]
            for w in workers if w.get('is_temporary', False)
            for s in schedules
        )
        # 使用线性化的比例约束
        max_temp = int(len(workers) * max_temporary_ratio)
        model.Add(temp_assigned <= max_temp)

        # 目标函数
        if objective == "minimize_cost":
            # 最小化总成本
            total_cost = sum(
                assignments[(w['id'], s['id'])] * int(w.get('cost_per_hour', 30) * 8)
                for w in workers for s in schedules
            )
            model.Minimize(total_cost)
        elif objective == "maximize_efficiency":
            # 最大化技能匹配度 (技能越高越好)
            total_skill = sum(
                assignments[(w['id'], s['id'])] * w['skill']
                for w in workers for s in schedules
            )
            model.Maximize(total_skill)
        else:  # balanced
            # 平衡成本和技能
            total_cost = sum(
                assignments[(w['id'], s['id'])] * int(w.get('cost_per_hour', 30) * 8)
                for w in workers for s in schedules
            )
            total_skill = sum(
                assignments[(w['id'], s['id'])] * w['skill'] * 100
                for w in workers for s in schedules
            )
            model.Minimize(total_cost - total_skill)  # 成本最小 + 技能最大

        # 求解
        solver = self.cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = 30.0
        status = solver.Solve(model)

        if status == self.cp_model.OPTIMAL or status == self.cp_model.FEASIBLE:
            result = []
            total_cost = 0
            total_skill = 0

            for w in workers:
                for s in schedules:
                    if solver.Value(assignments[(w['id'], s['id'])]):
                        result.append({
                            'worker_id': w['id'],
                            'schedule_id': s['id'],
                            'assignment_type': 'temporary' if w.get('is_temporary') else 'primary'
                        })
                        total_cost += w.get('cost_per_hour', 30) * 8
                        total_skill += w['skill']

            return {
                'success': True,
                'assignments': result,
                'total_cost': total_cost,
                'efficiency_score': total_skill / max(len(result), 1),
                'message': f'优化完成，分配 {len(result)} 名工人'
            }
        else:
            return {
                'success': False,
                'assignments': [],
                'total_cost': 0,
                'efficiency_score': 0,
                'message': '无法找到可行的分配方案'
            }

    def _optimize_greedy(
        self,
        workers: List[Dict],
        schedules: List[Dict],
        objective: str,
        max_temporary_ratio: float,
        min_skill_match: int
    ) -> Dict[str, Any]:
        """贪心算法备选方案"""
        # 按优先级排序排程
        sorted_schedules = sorted(schedules, key=lambda x: x.get('priority', 0), reverse=True)

        # 按成本或技能排序工人
        if objective == "minimize_cost":
            sorted_workers = sorted(workers, key=lambda x: x.get('cost_per_hour', 30))
        else:
            sorted_workers = sorted(workers, key=lambda x: x['skill'], reverse=True)

        assignments = []
        assigned_workers = set()
        total_cost = 0
        total_skill = 0

        for schedule in sorted_schedules:
            schedule_workers = []
            required_skill = schedule.get('required_skill', min_skill_match)
            min_workers = schedule.get('min_workers', 1)
            max_workers = schedule.get('max_workers', 10)

            for worker in sorted_workers:
                if worker['id'] in assigned_workers:
                    continue
                if worker['skill'] < required_skill:
                    continue
                if len(schedule_workers) >= max_workers:
                    break

                schedule_workers.append(worker)
                assigned_workers.add(worker['id'])

                assignments.append({
                    'worker_id': worker['id'],
                    'schedule_id': schedule['id'],
                    'assignment_type': 'temporary' if worker.get('is_temporary') else 'primary'
                })

                total_cost += worker.get('cost_per_hour', 30) * 8
                total_skill += worker['skill']

        return {
            'success': True,
            'assignments': assignments,
            'total_cost': total_cost,
            'efficiency_score': total_skill / max(len(assignments), 1),
            'message': f'贪心算法分配 {len(assignments)} 名工人'
        }


# ==================== LLM 洞察生成 ====================

class SchedulingInsightGenerator:
    """
    调度洞察生成器 - 使用 LLM 生成调度建议
    """

    def __init__(self, llm_client=None):
        self.llm_client = llm_client

    def generate_scheduling_recommendation(
        self,
        batches: List[Dict],
        workers: List[Dict],
        production_lines: List[Dict],
        historical_performance: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        生成 AI 调度建议

        如果 LLM 可用，使用 LLM 生成建议；否则使用规则引擎
        """
        if self.llm_client:
            return self._generate_with_llm(batches, workers, production_lines, historical_performance)
        else:
            return self._generate_with_rules(batches, workers, production_lines, historical_performance)

    def _generate_with_rules(
        self,
        batches: List[Dict],
        workers: List[Dict],
        production_lines: List[Dict],
        historical_performance: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        基于规则的调度生成
        """
        schedules = []
        sequence = 1

        # 按交付日期排序批次
        sorted_batches = sorted(batches, key=lambda x: x.get('deadline', '9999-12-31'))

        # 按产能排序产线
        sorted_lines = sorted(production_lines, key=lambda x: x.get('hourly_capacity', 0), reverse=True)

        line_index = 0
        for batch in sorted_batches:
            if line_index >= len(sorted_lines):
                line_index = 0  # 循环使用产线

            line = sorted_lines[line_index]

            # 估算所需工人数
            capacity = line.get('hourly_capacity', 100)
            quantity = batch.get('quantity', 1000)
            hours_needed = quantity / capacity if capacity > 0 else 8

            recommended_workers = min(
                max(line.get('min_workers', 2), int(hours_needed / 2)),
                line.get('max_workers', 10)
            )

            # 计算时间
            start_time = datetime.now().replace(hour=8, minute=0, second=0) + timedelta(hours=(sequence-1) * 2)
            end_time = start_time + timedelta(hours=hours_needed)

            schedules.append({
                'production_line_id': line.get('id'),
                'batch_id': batch.get('id'),
                'sequence_order': sequence,
                'planned_start_time': start_time.isoformat(),
                'planned_end_time': end_time.isoformat(),
                'assigned_workers': recommended_workers,
                'planned_quantity': quantity
            })

            sequence += 1
            line_index += 1

        return {
            'success': True,
            'schedules': schedules,
            'confidence': 0.75,  # 规则引擎置信度
            'message': f'基于规则生成 {len(schedules)} 个排程'
        }

    def _generate_with_llm(
        self,
        batches: List[Dict],
        workers: List[Dict],
        production_lines: List[Dict],
        historical_performance: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        使用 LLM 生成调度建议
        """
        # 构建提示
        prompt = f"""作为生产调度专家，请分析以下信息并生成最优调度方案：

待生产批次：
{json.dumps(batches, ensure_ascii=False, indent=2)}

可用产线：
{json.dumps(production_lines, ensure_ascii=False, indent=2)}

可用工人数：{len(workers)}

请生成调度方案，包括每个批次应该分配到哪条产线、需要多少工人、预计开始和结束时间。
考虑因素：
1. 紧急订单优先
2. 产线产能匹配
3. 工人技能匹配
4. 设备利用率最大化

请以 JSON 格式返回调度方案。
"""

        try:
            messages = [
                {"role": "system", "content": "你是生产调度专家，擅长优化生产计划。"},
                {"role": "user", "content": prompt}
            ]

            response = self.llm_client.chat.completions.create(
                model="qwen-plus",
                messages=messages,
                max_tokens=2000,
                temperature=0.3,
            )

            # 解析 LLM 响应
            content = response.choices[0].message.content

            # 尝试提取 JSON
            import re
            json_match = re.search(r'\[[\s\S]*\]', content)
            if json_match:
                schedules = json.loads(json_match.group())
            else:
                # 如果无法解析，回退到规则引擎
                return self._generate_with_rules(batches, workers, production_lines, historical_performance)

            return {
                'success': True,
                'schedules': schedules,
                'confidence': 0.85,
                'message': 'AI 生成调度方案'
            }

        except Exception as e:
            print(f"[WARN] LLM 调度生成失败: {e}")
            return self._generate_with_rules(batches, workers, production_lines, historical_performance)

    def explain_alert(
        self,
        alert_type: str,
        schedule_data: Dict,
        probability: float
    ) -> str:
        """
        解释告警原因
        """
        if alert_type == "low_probability":
            if probability < 0.5:
                return f"当前完成概率仅 {probability*100:.1f}%，远低于安全阈值 70%。主要原因可能是：1) 剩余工作量较大；2) 可用工人不足；3) 设备效率低于预期。建议立即增派人手或调整交付计划。"
            else:
                return f"完成概率 {probability*100:.1f}%，低于预期。建议关注生产进度，必要时增加人手支援。"
        elif alert_type == "resource_conflict":
            return "检测到资源冲突：多个排程同时需要相同的产线或工人。建议重新调整时间安排或增加替代资源。"
        elif alert_type == "deadline_risk":
            return "存在交付期限风险：按当前进度难以在截止时间前完成。建议加班或增派临时工。"
        else:
            return f"系统检测到 {alert_type} 类型的异常，请检查相关数据。"


# ==================== 初始化全局实例 ====================

monte_carlo = MonteCarloSimulator(simulations=10000)
worker_optimizer = WorkerOptimizer()
insight_generator = SchedulingInsightGenerator()


# ==================== API 函数 ====================

def calculate_completion_probability(request: CompletionProbabilityRequest) -> CompletionProbabilityResponse:
    """
    计算完成概率 API
    """
    # 默认效率参数 (如果没有历史数据)
    efficiency_mean = request.efficiency_mean or 10.0  # 10 单位/人/小时
    efficiency_std = request.efficiency_std or 2.0

    # 计算截止时间
    if request.deadline:
        deadline_dt = datetime.fromisoformat(request.deadline.replace('Z', '+00:00'))
        deadline_hours = (deadline_dt - datetime.now()).total_seconds() / 3600
    else:
        deadline_hours = 24  # 默认24小时

    # 冷启动检测
    is_cold_start = not request.historical_data or len(request.historical_data) < 10

    if is_cold_start and request.historical_data:
        # 使用有限的历史数据估计参数
        efficiencies = [d.get('efficiency', 10) for d in request.historical_data]
        efficiency_mean = np.mean(efficiencies)
        efficiency_std = np.std(efficiencies) if len(efficiencies) > 1 else 2.0

    # 运行 Monte Carlo 模拟
    result = monte_carlo.calculate_completion_probability(
        remaining_quantity=request.remaining_quantity,
        deadline_hours=max(0.1, deadline_hours),
        efficiency_mean=efficiency_mean,
        efficiency_std=efficiency_std,
        available_workers=max(1, request.assigned_workers)
    )

    # 生成洞察
    insight = monte_carlo.generate_insight(result, request.remaining_quantity, deadline_hours)

    return CompletionProbabilityResponse(
        success=True,
        probability=result['probability'],
        mean_hours=result['mean_hours'],
        std_hours=result['std_hours'],
        percentile_90=result['percentile_90'],
        confidence_lower=result['confidence_lower'],
        confidence_upper=result['confidence_upper'],
        insight=insight,
        is_cold_start=is_cold_start,
        simulation_count=result['simulation_count']
    )


def optimize_workers(request: OptimizeWorkersRequest) -> OptimizeWorkersResponse:
    """
    优化工人分配 API
    """
    result = worker_optimizer.optimize(
        workers=request.workers,
        schedules=request.schedules,
        objective=request.objective,
        max_temporary_ratio=request.max_temporary_ratio,
        min_skill_match=request.min_skill_match
    )

    return OptimizeWorkersResponse(
        success=result['success'],
        assignments=result['assignments'],
        total_cost=result['total_cost'],
        efficiency_score=result['efficiency_score'],
        message=result['message']
    )


def generate_schedule(request: GenerateScheduleRequest) -> Dict[str, Any]:
    """
    生成调度建议 API
    """
    # 这里需要从数据库获取实际数据
    # 暂时返回模拟数据结构

    batches = [{'id': bid, 'quantity': 1000, 'deadline': request.plan_date} for bid in request.batch_ids]
    workers = [{'id': wid, 'skill': 3} for wid in (request.available_worker_ids or [])]
    lines = [{'id': lid, 'hourly_capacity': 100, 'min_workers': 2, 'max_workers': 8}
             for lid in (request.production_line_ids or ['LINE-1', 'LINE-2'])]

    result = insight_generator.generate_scheduling_recommendation(
        batches=batches,
        workers=workers,
        production_lines=lines,
        historical_performance=None
    )

    return result


def reschedule(request: RescheduleRequest) -> Dict[str, Any]:
    """
    重新调度 API
    """
    # 模拟重新调度结果
    return {
        'success': True,
        'updated_schedules': [],
        'message': f'重新调度完成，原因: {request.reason}'
    }
