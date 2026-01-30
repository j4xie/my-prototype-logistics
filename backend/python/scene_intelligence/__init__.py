"""
场景智能模块
基于 LLM 的动态场景理解和变化检测

功能:
- 自动理解工厂车间场景
- 检测场景变化
- 动态适应产线布局调整
"""

from .api import router as scene_router

__all__ = ["scene_router"]
