"""
电子秤设备图片识别解析器
使用 Qwen VL 模型识别设备铭牌/规格书，提取配置信息

支持识别:
- 设备铭牌照片
- 规格说明书
- 接口连接图
"""

import os
import re
import json
from typing import Dict, Optional, Any
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

# ==================== 配置 ====================
DASHSCOPE_API_KEY = os.environ.get('DASHSCOPE_API_KEY', '')
DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
VISION_MODEL = os.environ.get('VISION_MODEL', 'qwen2.5-vl-3b-instruct')
VISION_ENABLED = os.environ.get('VISION_ENABLED', 'false').lower() == 'true'

# 初始化 OpenAI 客户端
vision_client = None
if DASHSCOPE_API_KEY and VISION_ENABLED:
    vision_client = OpenAI(
        api_key=DASHSCOPE_API_KEY,
        base_url=DASHSCOPE_BASE_URL,
    )


# ==================== 品牌别名映射 ====================
BRAND_ALIASES = {
    # 柯力
    'KELI': ['柯力', 'KELI', 'KL', '科力', 'Keli'],
    # 耀华
    'YAOHUA': ['耀华', 'YAOHUA', 'YH', '上海耀华'],
    # 矽策
    'XICE': ['矽策', 'XICE', 'XC', '矽测'],
    # 梅特勒-托利多
    'METTLER': ['梅特勒', 'METTLER', 'MT', 'Mettler Toledo', '托利多'],
    # 赛多利斯
    'SARTORIUS': ['赛多利斯', 'SARTORIUS', 'Sartorius'],
    # 德图
    'TESTO': ['德图', 'TESTO', 'Testo'],
    # 其他常见品牌
    'OHAUS': ['奥豪斯', 'OHAUS', 'Ohaus'],
    'AND': ['AND', 'A&D', 'AD', '艾安得'],
    'CAS': ['CAS', 'cas', '凯士'],
}

# ==================== 连接类型映射 ====================
CONNECTION_TYPES = {
    'RS232': ['RS232', 'RS-232', 'COM口', '串口', '232'],
    'RS485': ['RS485', 'RS-485', '485'],
    'TCP_IP': ['以太网', 'Ethernet', 'TCP/IP', 'RJ45', '网口', 'IP'],
    'MODBUS_RTU': ['Modbus RTU', 'MODBUS', 'ModbusRTU'],
    'MODBUS_TCP': ['Modbus TCP', 'ModbusTCP'],
    'WIFI': ['WiFi', 'WIFI', '无线', 'WLAN'],
    'BLUETOOTH': ['蓝牙', 'Bluetooth', 'BT'],
    'USB': ['USB'],
}


class ScaleVisionParser:
    """电子秤设备图片识别解析器"""

    def __init__(self):
        self.client = vision_client
        self.model = VISION_MODEL

    def parse_scale_image(self, image_base64: str, image_type: str = "铭牌") -> Dict[str, Any]:
        """
        识别设备铭牌/规格书，提取配置信息

        Args:
            image_base64: Base64 编码的图片数据
            image_type: 图片类型 ("铭牌", "规格书", "接口图")

        Returns:
            dict: {
                "success": bool,
                "brand": str,           # 品牌名称
                "model": str,           # 型号
                "max_capacity": str,    # 最大量程
                "precision": str,       # 精度/分度值
                "connection_type": str, # 连接类型
                "serial_number": str,   # 序列号
                "raw_text": str,        # OCR 原始识别文字
                "confidence": float,    # 置信度
                "message": str          # 提示信息
            }
        """
        if not self.client:
            return {
                "success": False,
                "message": "视觉模型未配置，请检查 VISION_MODEL 和 VISION_ENABLED 环境变量",
                "brand": None,
                "model": None,
                "max_capacity": None,
                "precision": None,
                "connection_type": None,
                "serial_number": None,
                "raw_text": None,
                "confidence": 0.0
            }

        try:
            # 构建识别提示词
            prompt = self._build_recognition_prompt(image_type)

            # 调用视觉模型
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
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
                max_tokens=1000,
                temperature=0.3,  # 低温度提高准确性
            )

            # 解析响应
            result_text = response.choices[0].message.content
            return self._parse_recognition_result(result_text)

        except Exception as e:
            return {
                "success": False,
                "message": f"图片识别失败: {str(e)}",
                "brand": None,
                "model": None,
                "max_capacity": None,
                "precision": None,
                "connection_type": None,
                "serial_number": None,
                "raw_text": None,
                "confidence": 0.0
            }

    def _build_recognition_prompt(self, image_type: str) -> str:
        """构建识别提示词"""
        return f"""你是一个工业电子秤设备识别专家。请仔细分析这张{image_type}图片，提取以下设备信息：

请以 JSON 格式返回识别结果，包含以下字段：
{{
    "brand": "品牌名称（如柯力、耀华、矽策、梅特勒等）",
    "model": "型号（如 XK3190-A9、ICS689、PT600A 等）",
    "max_capacity": "最大量程（如 150kg、30t、500g）",
    "precision": "精度/分度值（如 0.1g、10g、0.05kg）",
    "connection_type": "连接类型（RS232/RS485/以太网/WiFi/Modbus等）",
    "serial_number": "序列号（如有）",
    "raw_text": "图片中识别到的所有相关文字",
    "notes": "其他相关信息（如电压、功率等）"
}}

识别要点：
1. 优先识别铭牌上的品牌 Logo 或文字
2. 型号通常在品牌下方，格式如 "Model: XXX" 或直接显示型号
3. 量程和精度通常标注为 "Max: XXX kg" 和 "d=0.1g" 或 "e=10g"
4. 注意区分相似品牌（如柯力 KELI 和科力）
5. 如果无法识别某个字段，返回 null

仅返回 JSON，不要包含其他文字。"""

    def _parse_recognition_result(self, result_text: str) -> Dict[str, Any]:
        """解析识别结果"""
        try:
            # 提取 JSON 部分
            json_match = re.search(r'\{[\s\S]*\}', result_text)
            if not json_match:
                return {
                    "success": False,
                    "message": "无法解析识别结果",
                    "raw_text": result_text,
                    "confidence": 0.0
                }

            data = json.loads(json_match.group())

            # 标准化品牌名称
            brand = data.get('brand')
            if brand:
                brand = self._normalize_brand(brand)

            # 标准化连接类型
            connection_type = data.get('connection_type')
            if connection_type:
                connection_type = self._normalize_connection_type(connection_type)

            # 计算置信度
            confidence = self._calculate_confidence(data)

            return {
                "success": True,
                "brand": brand,
                "model": data.get('model'),
                "max_capacity": data.get('max_capacity'),
                "precision": data.get('precision'),
                "connection_type": connection_type,
                "serial_number": data.get('serial_number'),
                "raw_text": data.get('raw_text'),
                "notes": data.get('notes'),
                "confidence": confidence,
                "message": f"成功识别设备信息，置信度 {confidence:.0%}"
            }

        except json.JSONDecodeError as e:
            return {
                "success": False,
                "message": f"JSON 解析失败: {str(e)}",
                "raw_text": result_text,
                "confidence": 0.0
            }

    def _normalize_brand(self, brand: str) -> str:
        """标准化品牌名称"""
        brand_upper = brand.upper()
        for standard_name, aliases in BRAND_ALIASES.items():
            for alias in aliases:
                if alias.upper() in brand_upper or brand_upper in alias.upper():
                    return standard_name
        return brand  # 返回原始值

    def _normalize_connection_type(self, conn_type: str) -> str:
        """标准化连接类型"""
        conn_upper = conn_type.upper()
        for standard_type, aliases in CONNECTION_TYPES.items():
            for alias in aliases:
                if alias.upper() in conn_upper:
                    return standard_type
        return conn_type

    def _calculate_confidence(self, data: Dict) -> float:
        """计算识别置信度"""
        required_fields = ['brand', 'model', 'max_capacity']
        optional_fields = ['precision', 'connection_type', 'serial_number']

        # 必填字段权重
        required_score = sum(1 for f in required_fields if data.get(f)) / len(required_fields) * 0.7

        # 可选字段权重
        optional_score = sum(1 for f in optional_fields if data.get(f)) / len(optional_fields) * 0.3

        return required_score + optional_score


# ==================== 快捷方法 ====================
_parser = ScaleVisionParser()


def parse_scale_image(image_base64: str, image_type: str = "铭牌") -> Dict[str, Any]:
    """解析电子秤设备图片"""
    return _parser.parse_scale_image(image_base64, image_type)


def is_vision_enabled() -> bool:
    """检查视觉识别是否可用"""
    return VISION_ENABLED and vision_client is not None
