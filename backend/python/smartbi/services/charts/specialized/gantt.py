from __future__ import annotations
import math
from typing import List, Optional

import pandas as pd

from ..base import BaseChartStrategy
from ..common import empty_chart_config, get_palette, make_enhanced_tooltip
from ..registry import register_chart


@register_chart("gantt")
class GanttChartStrategy(BaseChartStrategy):
    def build(
        self,
        df: pd.DataFrame,
        x_field: Optional[str] = None,
        y_fields: Optional[List[str]] = None,
        series_field: Optional[str] = None,
        options: Optional[dict] = None,
    ) -> dict:
        palette = get_palette()  # noqa: F841
        col_lower = {c.lower().strip(): c for c in df.columns}

        task_col = x_field
        if not task_col:
            for alias in ('task', '任务', 'name', '名称', '项目', 'activity', '活动'):
                if alias in col_lower:
                    task_col = col_lower[alias]
                    break
        if not task_col:
            non_num = [c for c in df.columns if c not in df.select_dtypes(include=['number']).columns]
            task_col = non_num[0] if non_num else df.columns[0]

        start_col, end_col = None, None
        for alias in ('start', '开始', 'start_date', '开始日期', '起始'):
            if alias in col_lower:
                start_col = col_lower[alias]
                break
        for alias in ('end', '结束', 'end_date', '结束日期', '截止', 'finish', '完成日期'):
            if alias in col_lower:
                end_col = col_lower[alias]
                break

        if not start_col and y_fields and len(y_fields) >= 1:
            start_col = y_fields[0] if y_fields[0] in df.columns else None
        if not end_col and y_fields and len(y_fields) >= 2:
            end_col = y_fields[1] if y_fields[1] in df.columns else None

        if not start_col or not end_col:
            date_cols = []
            for c in df.columns:
                if c == task_col:
                    continue
                try:
                    parsed = pd.to_datetime(df[c], errors='coerce')
                    if parsed.notna().sum() > len(df) * 0.5:
                        date_cols.append(c)
                except Exception:
                    continue
            if len(date_cols) >= 2:
                start_col = start_col or date_cols[0]
                end_col = end_col or date_cols[1]

        if not start_col or not end_col:
            return empty_chart_config("甘特图需要开始日期和结束日期列")

        status_col, progress_col, category_col = None, None, None
        for alias in ('status', '状态'):
            if alias in col_lower:
                status_col = col_lower[alias]
                break
        for alias in ('progress', '进度', 'completion', '完成率', 'percent'):
            if alias in col_lower:
                progress_col = col_lower[alias]
                break
        for alias in ('category', '分类', 'group', '组', '阶段', 'phase'):
            if alias in col_lower and col_lower[alias] not in (task_col, start_col, end_col, status_col, progress_col):
                category_col = col_lower[alias]
                break

        status_colors = {
            'completed': '#36B37E', 'complete': '#36B37E', '已完成': '#36B37E',
            'in-progress': '#2D8B57', 'in_progress': '#2D8B57', '进行中': '#2D8B57',
            'delayed': '#FF5630', '延迟': '#FF5630', '超期': '#FF5630',
            'planned': '#6B778C', '计划中': '#6B778C', '未开始': '#6B778C',
        }
        status_colors_dark = {'#36B37E': '#2D9D6C', '#2D8B57': '#155290', '#FF5630': '#E04A2A', '#6B778C': '#596475'}

        tasks = []
        all_dates = []
        for _, row in df.iterrows():
            task_name = str(row.get(task_col, '')).strip()
            if not task_name:
                continue
            try:
                start_dt = pd.to_datetime(row.get(start_col), errors='coerce')
                end_dt = pd.to_datetime(row.get(end_col), errors='coerce')
            except Exception:
                continue
            if pd.isna(start_dt) or pd.isna(end_dt):
                continue
            if end_dt < start_dt:
                start_dt, end_dt = end_dt, start_dt

            all_dates.extend([start_dt, end_dt])
            duration = (end_dt - start_dt).days or 1

            status_raw = str(row.get(status_col, 'planned')).strip().lower() if status_col else 'planned'
            color = status_colors.get(status_raw, '#6B778C')

            progress = 0
            if progress_col:
                try:
                    pv = float(pd.to_numeric(row.get(progress_col), errors='coerce'))
                    if math.isfinite(pv):
                        progress = min(max(pv, 0), 100)
                        if 0 < progress <= 1:
                            progress = progress * 100
                except (ValueError, TypeError):
                    pass

            cat = str(row.get(category_col, '')).strip() if category_col else ''
            tasks.append({
                "name": task_name, "start": start_dt.strftime("%Y-%m-%d"), "end": end_dt.strftime("%Y-%m-%d"),
                "start_ts": int(start_dt.timestamp() * 1000), "end_ts": int(end_dt.timestamp() * 1000),
                "duration": duration, "color": color, "colorDark": status_colors_dark.get(color, color),
                "status": status_raw, "progress": round(progress, 1), "category": cat,
            })

        if not tasks:
            return empty_chart_config("甘特图无有效任务数据")

        if category_col:
            tasks.sort(key=lambda t: (t["category"], t["start"]))
        else:
            tasks.sort(key=lambda t: t["start"])
        tasks = list(reversed(tasks))
        task_names = [t["name"] for t in tasks]

        min_date = min(all_dates)
        max_date = max(all_dates)
        date_range = (max_date - min_date).days or 1
        pad_days = max(int(date_range * 0.05), 1)
        ref_date = min_date - pd.Timedelta(days=pad_days)

        base_data = []
        bar_data = []
        for t in tasks:
            start_offset = (pd.to_datetime(t["start"]) - ref_date).days
            duration = t["duration"]
            base_data.append(start_offset)
            bar_data.append({
                "value": duration,
                "itemStyle": {"color": t["color"], "borderRadius": [3, 3, 3, 3], "opacity": 0.85},
                "_task": t,
            })

        today = pd.Timestamp.now()
        today_offset = (today - ref_date).days
        total_days = (max_date - min_date).days + pad_days * 2

        separator_lines = []
        if category_col:
            prev_cat = None
            for i, t in enumerate(tasks):
                if prev_cat is not None and t["category"] != prev_cat:
                    separator_lines.append({"yAxis": i - 0.5, "lineStyle": {"type": "dashed", "color": "#ddd", "width": 1}, "label": {"show": False}, "symbol": ["none", "none"]})  # noqa: E501
                prev_cat = t["category"]

        config = {
            "grid": {"left": "3%", "right": "5%", "top": "5%", "bottom": "12%", "containLabel": True},
            "xAxis": {
                "type": "value", "name": "日期", "min": 0, "max": total_days,
                "axisLabel": {"formatter": "__FMT__gantt_date_label", "fontSize": 10},
                "splitLine": {"lineStyle": {"type": "dashed", "color": "#f0f0f0"}},
            },
            "yAxis": {
                "type": "category", "data": task_names, "inverse": False,
                "axisLabel": {"fontSize": 11, "width": 100, "overflow": "truncate"},
                "axisTick": {"show": False}, "splitLine": {"show": False},
            },
            "series": [
                {
                    "name": "基准", "type": "bar", "stack": "gantt", "data": base_data,
                    "itemStyle": {"color": "transparent", "borderColor": "transparent"},
                    "emphasis": {"itemStyle": {"color": "transparent"}},
                    "tooltip": {"show": False}, "barMaxWidth": 22, "barMinWidth": 12,
                },
                {
                    "name": "任务", "type": "bar", "stack": "gantt", "data": bar_data,
                    "barMaxWidth": 22, "barMinWidth": 12,
                    "label": {"show": True, "position": "inside", "fontSize": 10, "color": "#fff", "formatter": "__FMT__gantt_bar_label"},  # noqa: E501
                    "emphasis": {"itemStyle": {"shadowBlur": 8, "shadowColor": "rgba(0,0,0,0.2)"}},
                    "markLine": {
                        "silent": True, "symbol": ["none", "none"],
                        "lineStyle": {"type": "dashed", "color": "#FF5630", "width": 2},
                        "label": {"show": True, "position": "start", "formatter": "今天", "color": "#FF5630", "fontSize": 10},  # noqa: E501
                        "data": [{"xAxis": today_offset}],
                    },
                },
            ],
            "tooltip": {**make_enhanced_tooltip("item"), "formatter": "__FMT__gantt_tooltip"},
            "_ganttMeta": {
                "refDate": ref_date.strftime("%Y-%m-%d"), "totalDays": total_days,
                "taskCount": len(tasks), "todayOffset": today_offset,
                "tasks": [{"name": t["name"], "start": t["start"], "end": t["end"], "duration": t["duration"], "status": t["status"], "progress": t["progress"], "category": t["category"]} for t in tasks],  # noqa: E501
            },
        }

        if len(tasks) > 15:
            config["dataZoom"] = [
                {"type": "slider", "yAxisIndex": 0, "right": 5, "start": 0, "end": round(15 / len(tasks) * 100), "width": 15, "borderColor": "transparent", "backgroundColor": "#f3f4f6", "fillerColor": "rgba(45,139,87,0.12)", "handleStyle": {"color": "#2D8B57"}},  # noqa: E501
                {"type": "inside", "yAxisIndex": 0},
            ]

        if separator_lines:
            config["series"][0]["markLine"] = {"silent": True, "symbol": ["none", "none"], "data": separator_lines}

        return config
