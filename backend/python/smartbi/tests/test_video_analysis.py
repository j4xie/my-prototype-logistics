"""
测试视频分析脚本
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.video_efficiency_analyzer import VideoEfficiencyAnalyzer, analyze_videos
import json

# 视频文件路径
video_paths = [
    r"c:\Users\Steve\xwechat_files\wxid_a2m0bim6zcm212_82ca\msg\video\2026-01\358b318d3fcd447f5d5b0595b08fecd6.mp4",
    r"c:\Users\Steve\xwechat_files\wxid_a2m0bim6zcm212_82ca\msg\video\2026-01\7167806dad4f1eabec33944a650693f6.mp4",
    r"c:\Users\Steve\xwechat_files\wxid_a2m0bim6zcm212_82ca\msg\video\2026-01\109d0d6ba2f4f0aa62b65e4a420b7a82.mp4",
    r"c:\Users\Steve\xwechat_files\wxid_a2m0bim6zcm212_82ca\msg\video\2026-01\d77624be66882fff05d8453bdf119029.mp4",
]

# 使用抽帧模式分析（不用 use_direct）
results = analyze_videos(video_paths, use_direct=False)

# 保存结果
output_file = os.path.join(os.path.dirname(__file__), "video_analysis_results.json")
results_dict = {}
for path, result in results.items():
    results_dict[path] = {
        "success": result.success,
        "error": result.error,
        "frame_count": result.frame_count,
        "summary": result.summary,
        "snapshots": [
            {
                "timestamp": s.timestamp,
                "worker_count": s.worker_count,
                "active_workers": s.active_workers,
                "idle_workers": s.idle_workers,
                "completed_actions": s.completed_actions,
                "process_stage": s.process_stage,
                "scene_description": s.scene_description,
                "safety_issues": s.safety_issues,
                "efficiency_score": s.efficiency_score,
                "notes": s.notes
            } for s in result.snapshots
        ] if result.snapshots else []
    }

with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(results_dict, f, ensure_ascii=False, indent=2)

print(f"\n结果已保存到: {output_file}")
