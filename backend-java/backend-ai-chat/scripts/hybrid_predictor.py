"""
混合预测器
结合 ML模型预测 + LLM推理 的智能预测系统

工作模式：
1. 冷启动模式 (LLM-only): 没有ML模型时，纯靠LLM推理
2. 混合模式 (Hybrid): 有ML模型时，ML预测 + LLM解释

融合策略：
- ML模型提供数值预测（效率、时长、质量）
- LLM提供预测解释、风险分析、改进建议
"""

import os
import json
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime

# 导入ML训练器
from ml_trainer import model_loader, predict_efficiency, predict_duration, predict_quality

# 导入LLM客户端
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==================== 配置 ====================

DASHSCOPE_API_KEY = os.environ.get('DASHSCOPE_API_KEY', '')
DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
DASHSCOPE_MODEL = os.environ.get('DASHSCOPE_MODEL', 'qwen-plus')

# 初始化LLM客户端
llm_client = None
if DASHSCOPE_API_KEY and OPENAI_AVAILABLE:
    llm_client = OpenAI(
        api_key=DASHSCOPE_API_KEY,
        base_url=DASHSCOPE_BASE_URL,
    )


class HybridPredictor:
    """混合预测器 - ML模型 + LLM推理"""

    def __init__(self):
        self.model_loader = model_loader

    def predict_efficiency(self, factory_id: str,
                           features: Dict[str, Any]) -> Dict[str, Any]:
        """
        预测效率
        - 如果有ML模型：使用ML预测 + LLM解释
        - 如果没有ML模型：使用LLM推理
        """
        # 尝试使用ML模型
        ml_result = predict_efficiency(factory_id, features)

        if ml_result is not None:
            # 混合模式：ML预测 + LLM解释
            explanation = self._get_llm_explanation(
                features, ml_result['prediction'], "efficiency"
            )

            return {
                "mode": "hybrid",
                "prediction": ml_result['prediction'],
                "confidence": ml_result['confidence'],
                "model_version": ml_result['model_version'],
                "r2_score": ml_result['r2_score'],
                "explanation": explanation,
                "features_used": features
            }
        else:
            # 冷启动模式：纯LLM推理
            llm_result = self._llm_predict_efficiency(features)

            return {
                "mode": "llm_only",
                "prediction": llm_result['prediction'],
                "confidence": llm_result['confidence'],
                "model_version": None,
                "r2_score": None,
                "explanation": llm_result['reasoning'],
                "features_used": features
            }

    def predict_duration(self, factory_id: str,
                         features: Dict[str, Any]) -> Dict[str, Any]:
        """预测时长"""
        ml_result = predict_duration(factory_id, features)

        if ml_result is not None:
            explanation = self._get_llm_explanation(
                features, ml_result['prediction'], "duration"
            )

            return {
                "mode": "hybrid",
                "prediction": ml_result['prediction'],
                "confidence": ml_result['confidence'],
                "model_version": ml_result['model_version'],
                "explanation": explanation
            }
        else:
            llm_result = self._llm_predict_duration(features)

            return {
                "mode": "llm_only",
                "prediction": llm_result['prediction'],
                "confidence": llm_result['confidence'],
                "model_version": None,
                "explanation": llm_result['reasoning']
            }

    def predict_completion_probability(self, factory_id: str,
                                         schedule_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        预测完成概率
        综合使用 ML效率预测 + Monte Carlo模拟 + LLM分析
        """
        # 提取特征
        features = self._extract_features(schedule_data)

        # 获取效率预测
        efficiency_result = self.predict_efficiency(factory_id, features)
        predicted_efficiency = efficiency_result['prediction']

        # 运行蒙特卡洛模拟
        remaining_quantity = schedule_data.get('remaining_quantity', 100)
        deadline_hours = schedule_data.get('deadline_hours', 8)
        available_workers = schedule_data.get('available_workers', 5)

        mc_result = self._monte_carlo_simulation(
            remaining_quantity=remaining_quantity,
            deadline_hours=deadline_hours,
            efficiency_mean=predicted_efficiency,
            efficiency_std=predicted_efficiency * 0.2,  # 假设20%标准差
            available_workers=available_workers
        )

        # 获取LLM风险分析
        risk_analysis = self._llm_analyze_risk(
            schedule_data, mc_result['probability'], efficiency_result
        )

        return {
            "probability": mc_result['probability'],
            "mean_hours": mc_result['mean_hours'],
            "std_hours": mc_result['std_hours'],
            "percentile_90": mc_result['percentile_90'],
            "confidence_interval": mc_result['confidence_interval'],
            "efficiency_prediction": efficiency_result,
            "risk_analysis": risk_analysis,
            "mode": efficiency_result['mode']
        }

    def _monte_carlo_simulation(self, remaining_quantity: int,
                                  deadline_hours: float,
                                  efficiency_mean: float,
                                  efficiency_std: float,
                                  available_workers: int,
                                  simulations: int = 10000) -> Dict[str, Any]:
        """蒙特卡洛模拟计算完成概率"""
        import numpy as np

        completion_times = []

        for _ in range(simulations):
            # 从效率分布中采样
            simulated_efficiency = np.random.normal(
                efficiency_mean,
                efficiency_std
            )
            simulated_efficiency = max(0.5, simulated_efficiency)  # 下限

            # 计算预计完成时间
            hourly_output = simulated_efficiency * available_workers
            hours_needed = remaining_quantity / hourly_output
            completion_times.append(hours_needed)

        completion_times = np.array(completion_times)
        on_time_count = np.sum(completion_times <= deadline_hours)

        return {
            'probability': float(on_time_count / simulations),
            'mean_hours': float(np.mean(completion_times)),
            'std_hours': float(np.std(completion_times)),
            'percentile_90': float(np.percentile(completion_times, 90)),
            'confidence_interval': (
                float(np.percentile(completion_times, 5)),
                float(np.percentile(completion_times, 95))
            )
        }

    def _extract_features(self, schedule_data: Dict[str, Any]) -> Dict[str, Any]:
        """从调度数据中提取特征"""
        now = datetime.now()

        return {
            'hour_of_day': schedule_data.get('hour_of_day', now.hour),
            'day_of_week': schedule_data.get('day_of_week', now.isoweekday()),
            'is_overtime': schedule_data.get('is_overtime', now.hour >= 18),
            'worker_count': schedule_data.get('worker_count', 5),
            'avg_worker_experience_days': schedule_data.get('avg_experience', 90),
            'avg_skill_level': schedule_data.get('avg_skill_level', 3.0),
            'temporary_worker_ratio': schedule_data.get('temp_worker_ratio', 0.1),
            'product_complexity': schedule_data.get('product_complexity', 5),
            'equipment_age_days': schedule_data.get('equipment_age', 365),
            'equipment_utilization': schedule_data.get('equipment_utilization', 0.7)
        }

    def _get_llm_explanation(self, features: Dict[str, Any],
                              prediction: float,
                              prediction_type: str) -> str:
        """使用LLM生成预测解释"""
        if not llm_client:
            return "LLM服务不可用，无法生成解释"

        type_labels = {
            'efficiency': '效率（件/人/小时）',
            'duration': '预计时长（小时）',
            'quality': '质量合格率'
        }

        prompt = f"""你是生产调度专家。请简要解释以下预测结果：

预测类型：{type_labels.get(prediction_type, prediction_type)}
预测值：{prediction:.2f}

输入特征：
- 当前时间：{features.get('hour_of_day')}点
- 星期：{features.get('day_of_week')}
- 是否加班：{'是' if features.get('is_overtime') else '否'}
- 工人数量：{features.get('worker_count')}人
- 平均工作经验：{features.get('avg_worker_experience_days')}天
- 平均技能等级：{features.get('avg_skill_level')}/5
- 临时工比例：{features.get('temporary_worker_ratio', 0) * 100:.1f}%
- 产品复杂度：{features.get('product_complexity')}/10
- 设备使用天数：{features.get('equipment_age_days')}天

请用2-3句话解释这个预测值是否合理，并指出影响最大的因素。"""

        try:
            completion = llm_client.chat.completions.create(
                model=DASHSCOPE_MODEL,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=300,
                temperature=0.7
            )
            return completion.choices[0].message.content
        except Exception as e:
            logger.error(f"LLM解释生成失败: {e}")
            return f"无法生成解释: {str(e)}"

    def _llm_predict_efficiency(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """使用LLM进行冷启动效率预测"""
        if not llm_client:
            return {
                'prediction': 15.0,  # 默认效率
                'confidence': 0.3,
                'reasoning': 'LLM服务不可用，使用默认值'
            }

        prompt = f"""你是生产效率预测专家。请根据以下生产条件预测效率。

生产条件：
- 当前时间：{features.get('hour_of_day')}点
- 星期：{features.get('day_of_week')}
- 是否加班：{'是' if features.get('is_overtime') else '否'}
- 工人数量：{features.get('worker_count')}人
- 平均工作经验：{features.get('avg_worker_experience_days')}天
- 平均技能等级：{features.get('avg_skill_level')}/5
- 临时工比例：{features.get('temporary_worker_ratio', 0) * 100:.1f}%
- 产品复杂度：{features.get('product_complexity')}/10
- 设备使用天数：{features.get('equipment_age_days')}天

请给出：
1. 预测的效率值（件/人/小时，通常在5-30之间）
2. 你的置信度（0-1之间）
3. 推理过程

请按JSON格式回答：
{{"prediction": 数值, "confidence": 数值, "reasoning": "解释"}}"""

        try:
            completion = llm_client.chat.completions.create(
                model=DASHSCOPE_MODEL,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=500,
                temperature=0.5
            )

            response_text = completion.choices[0].message.content

            # 尝试解析JSON
            try:
                # 处理可能的markdown代码块
                if '```json' in response_text:
                    json_start = response_text.index('```json') + 7
                    json_end = response_text.index('```', json_start)
                    response_text = response_text[json_start:json_end]
                elif '```' in response_text:
                    json_start = response_text.index('```') + 3
                    json_end = response_text.index('```', json_start)
                    response_text = response_text[json_start:json_end]

                result = json.loads(response_text.strip())
                return {
                    'prediction': float(result.get('prediction', 15)),
                    'confidence': float(result.get('confidence', 0.5)),
                    'reasoning': result.get('reasoning', '基于LLM推理')
                }
            except json.JSONDecodeError:
                # 解析失败，尝试提取数值
                import re
                numbers = re.findall(r'\d+\.?\d*', response_text)
                if numbers:
                    return {
                        'prediction': float(numbers[0]),
                        'confidence': 0.4,
                        'reasoning': response_text
                    }

        except Exception as e:
            logger.error(f"LLM预测失败: {e}")

        return {
            'prediction': 15.0,
            'confidence': 0.3,
            'reasoning': 'LLM预测失败，使用默认值'
        }

    def _llm_predict_duration(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """使用LLM进行冷启动时长预测"""
        # 类似效率预测的逻辑
        efficiency_result = self._llm_predict_efficiency(features)

        # 基于效率估算时长
        estimated_quantity = features.get('planned_quantity', 100)
        workers = features.get('worker_count', 5)
        efficiency = efficiency_result['prediction']

        duration = estimated_quantity / (efficiency * workers)

        return {
            'prediction': duration,
            'confidence': efficiency_result['confidence'] * 0.8,
            'reasoning': f"基于预测效率 {efficiency:.1f} 件/人/小时推算"
        }

    def _llm_analyze_risk(self, schedule_data: Dict[str, Any],
                          probability: float,
                          efficiency_result: Dict[str, Any]) -> str:
        """使用LLM分析风险"""
        if not llm_client:
            if probability < 0.5:
                return "风险较高：完成概率低于50%，建议增加人手或调整计划"
            elif probability < 0.7:
                return "风险中等：完成概率在50-70%之间，建议密切关注进度"
            else:
                return "风险较低：完成概率高于70%"

        prompt = f"""请简要分析生产计划的风险：

完成概率：{probability * 100:.1f}%
预测效率：{efficiency_result.get('prediction', 'N/A')}
预测模式：{efficiency_result.get('mode', 'unknown')}

如果完成概率低于70%，请给出1-2条具体的改进建议。
请用2-3句话回答。"""

        try:
            completion = llm_client.chat.completions.create(
                model=DASHSCOPE_MODEL,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=200,
                temperature=0.7
            )
            return completion.choices[0].message.content
        except Exception as e:
            logger.error(f"LLM风险分析失败: {e}")
            return "无法生成风险分析"

    def get_model_status(self, factory_id: str) -> Dict[str, Any]:
        """获取工厂的模型状态"""
        status = {
            'factory_id': factory_id,
            'models': {}
        }

        for model_type in ['efficiency', 'duration', 'quality']:
            model_info = self.model_loader.get_model(factory_id, model_type)
            if model_info:
                status['models'][model_type] = {
                    'available': True,
                    'version': model_info.get('version'),
                    'r2_score': model_info.get('r2_score'),
                    'confidence': self.model_loader._calculate_confidence(
                        model_info.get('r2_score')
                    )
                }
            else:
                status['models'][model_type] = {
                    'available': False,
                    'mode': 'llm_only'
                }

        return status


# ==================== 单例实例 ====================

hybrid_predictor = HybridPredictor()


def predict_with_hybrid(factory_id: str, features: Dict[str, Any],
                        prediction_type: str = 'efficiency') -> Dict[str, Any]:
    """混合预测的便捷函数"""
    if prediction_type == 'efficiency':
        return hybrid_predictor.predict_efficiency(factory_id, features)
    elif prediction_type == 'duration':
        return hybrid_predictor.predict_duration(factory_id, features)
    else:
        raise ValueError(f"不支持的预测类型: {prediction_type}")


def predict_completion(factory_id: str,
                        schedule_data: Dict[str, Any]) -> Dict[str, Any]:
    """预测完成概率的便捷函数"""
    return hybrid_predictor.predict_completion_probability(factory_id, schedule_data)


def get_model_status(factory_id: str) -> Dict[str, Any]:
    """获取模型状态的便捷函数"""
    return hybrid_predictor.get_model_status(factory_id)
