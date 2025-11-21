#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
优化HTML文档的目录结构和可读性
1. 增强目录导航的视觉层级
2. 改进整体版面设计和间距
3. 增强功能模块的说明和解释
"""

def enhance_navigation_html():
    """生成增强的导航HTML"""
    return '''            <nav class="sidebar-nav" id="sidebarNav">
                <!-- 第0章: 核心业务流程 -->
                <div class="sidebar-nav-section" data-category="core">
                    <span class="section-icon">🏗️</span>
                    <span>第0章 核心业务流程</span>
                </div>
                <a href="#ch0-overview" class="sidebar-nav-item" data-chapter="0">
                    <span class="nav-icon">📊</span>
                    <span class="nav-title">业务流程总览</span>
                </a>
                <a href="#ch0-1" class="sidebar-nav-item level-2" data-chapter="0-1">
                    <span class="nav-icon">🏭</span>
                    0.1 生产批次业务线
                </a>
                <a href="#ch0-2" class="sidebar-nav-item level-2" data-chapter="0-2">
                    <span class="nav-icon">⏱️</span>
                    0.2 时间追踪与成本计算
                </a>
                <a href="#ch0-3" class="sidebar-nav-item level-2" data-chapter="0-3">
                    <span class="nav-icon">📦</span>
                    0.3 库存与材料管理
                </a>
                <a href="#ch0-4" class="sidebar-nav-item level-2" data-chapter="0-4">
                    <span class="nav-icon">🔀</span>
                    0.4 关键数据流图
                </a>

                <!-- 第1-11章: 功能模块详解 -->
                <div class="sidebar-nav-section" data-category="modules">
                    <span class="section-icon">⚙️</span>
                    <span>功能模块详解 (1-11)</span>
                </div>

                <a href="#ch1" class="sidebar-nav-item" data-chapter="1">
                    <span class="nav-icon">🔐</span>
                    <span class="nav-title">1. 认证与权限</span>
                    <span class="nav-desc">用户登录、角色管理、权限控制</span>
                </a>
                <a href="#ch2" class="sidebar-nav-item" data-chapter="2">
                    <span class="nav-icon">👥</span>
                    <span class="nav-title">2. 考勤管理</span>
                    <span class="nav-desc">工作打卡、工时追踪、成本计算</span>
                </a>
                <a href="#ch3" class="sidebar-nav-item" data-chapter="3">
                    <span class="nav-icon">🏭</span>
                    <span class="nav-title">3. 生产加工</span>
                    <span class="nav-desc">批次管理、质检、成本分析</span>
                </a>
                <a href="#ch4" class="sidebar-nav-item" data-chapter="4">
                    <span class="nav-icon">🤖</span>
                    <span class="nav-title">4. AI智能分析</span>
                    <span class="nav-desc">智能分析、报告生成、成本优化</span>
                </a>
                <a href="#ch5" class="sidebar-nav-item" data-chapter="5">
                    <span class="nav-icon">⚙️</span>
                    <span class="nav-title">5. 设备管理</span>
                    <span class="nav-desc">设备维护、折旧计算、OEE监控</span>
                </a>
                <a href="#ch6" class="sidebar-nav-item" data-chapter="6">
                    <span class="nav-icon">📦</span>
                    <span class="nav-title">6. 库存管理</span>
                    <span class="nav-desc">物料批次、FIFO推荐、过期处理</span>
                </a>
                <a href="#ch7" class="sidebar-nav-item" data-chapter="7">
                    <span class="nav-icon">✅</span>
                    <span class="nav-title">7. 质量检验</span>
                    <span class="nav-desc">质检标准、缺陷分类、合格率统计</span>
                </a>
                <a href="#ch8" class="sidebar-nav-item" data-chapter="8">
                    <span class="nav-icon">📋</span>
                    <span class="nav-title">8. 基础数据管理</span>
                    <span class="nav-desc">物料、产品、员工、部门管理</span>
                </a>
                <a href="#ch9" class="sidebar-nav-item" data-chapter="9">
                    <span class="nav-icon">🌐</span>
                    <span class="nav-title">9. 平台管理</span>
                    <span class="nav-desc">工厂配置、用户管理、审计日志</span>
                </a>
                <a href="#ch10" class="sidebar-nav-item" data-chapter="10">
                    <span class="nav-icon">📊</span>
                    <span class="nav-title">10. 报表分析</span>
                    <span class="nav-desc">数据报表、趋势分析、决策支持</span>
                </a>
                <a href="#ch11" class="sidebar-nav-item" data-chapter="11">
                    <span class="nav-icon">↔️</span>
                    <span class="nav-title">11. 数据导入导出</span>
                    <span class="nav-desc">Excel导入、数据验证、批量处理</span>
                </a>

                <!-- 交叉功能详解 -->
                <div class="sidebar-nav-section" data-category="cross">
                    <span class="section-icon">🔗</span>
                    <span>交叉功能详解</span>
                </div>
                <a href="#cross-1" class="sidebar-nav-item" data-chapter="x1">
                    <span class="nav-icon">💰</span>
                    X.1 成本自动计算
                </a>
                <a href="#cross-2" class="sidebar-nav-item" data-chapter="x2">
                    <span class="nav-icon">📈</span>
                    X.2 FIFO库存推荐
                </a>
                <a href="#cross-3" class="sidebar-nav-item" data-chapter="x3">
                    <span class="nav-icon">⏳</span>
                    X.3 时间成本一体化
                </a>
                <a href="#cross-4" class="sidebar-nav-item" data-chapter="x4">
                    <span class="nav-icon">🔧</span>
                    X.4 设备折旧集成
                </a>
                <a href="#cross-5" class="sidebar-nav-item" data-chapter="x5">
                    <span class="nav-icon">⛓️</span>
                    X.5 AI分析触发链
                </a>

                <!-- 附录 -->
                <div class="sidebar-nav-section" data-category="appendix">
                    <span class="section-icon">📎</span>
                    <span>附录</span>
                </div>
                <a href="#stats" class="sidebar-nav-item" data-chapter="stats">
                    <span class="nav-icon">📈</span>
                    系统统计数据
                </a>
                <a href="#faq" class="sidebar-nav-item" data-chapter="faq">
                    <span class="nav-icon">❓</span>
                    常见问题解答
                </a>
            </nav>'''


def get_enhanced_css():
    """返回增强的CSS样式"""
    return '''
        /* ===== 增强的导航样式 ===== */
        .sidebar-nav-section {
            padding: 14px 20px 10px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            color: #666;
            letter-spacing: 1px;
            border-bottom: 2px solid #f0f0f0;
            margin-top: 18px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .section-icon {
            font-size: 14px;
        }

        .sidebar-nav-item {
            display: flex;
            flex-direction: column;
            padding: 11px 20px;
            color: #555;
            text-decoration: none;
            font-size: 13px;
            border-left: 3px solid transparent;
            transition: all 0.2s;
            cursor: pointer;
            gap: 4px;
        }

        .sidebar-nav-item .nav-icon {
            font-size: 16px;
            display: inline;
        }

        .sidebar-nav-item .nav-title {
            font-weight: 500;
            color: #333;
        }

        .sidebar-nav-item .nav-desc {
            font-size: 11px;
            color: #888;
            font-weight: 400;
            display: none;
        }

        .sidebar-nav-item:hover {
            background: #f8f9fa;
            color: #2c3e50;
            border-left-color: #4a90e2;
            padding-left: 24px;
        }

        .sidebar-nav-item:hover .nav-desc {
            display: block;
            color: #666;
        }

        .sidebar-nav-item.active {
            background: #ecf0f6;
            color: #4a90e2;
            border-left-color: #4a90e2;
            font-weight: 600;
        }

        .sidebar-nav-item.active .nav-desc {
            display: block;
            color: #4a90e2;
        }

        .sidebar-nav-item.level-2 {
            padding-left: 40px;
            font-size: 12px;
            flex-direction: row;
            gap: 8px;
            align-items: center;
        }

        .sidebar-nav-item.level-2 .nav-desc {
            display: none !important;
        }

        /* ===== 增强的内容间距 ===== */
        .content {
            margin-left: 300px;
            padding: 50px 70px;
            background: white;
            flex: 1;
            max-width: 1400px;
        }

        /* ===== 增强的标题样式 ===== */
        h1 {
            font-size: 32px;
            margin-top: 60px;
            margin-bottom: 30px;
            color: #1a1a1a;
            font-weight: 700;
            padding: 20px 0 20px 0;
            border-top: 4px solid #4a90e2;
            border-bottom: 1px solid #e0e0e0;
            padding-bottom: 20px;
        }

        h1:first-child {
            margin-top: 0;
        }

        h2 {
            font-size: 24px;
            margin-top: 45px;
            margin-bottom: 20px;
            color: #2c3e50;
            font-weight: 600;
            padding-bottom: 12px;
            border-bottom: 2px solid #e0e0e0;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        h3 {
            font-size: 20px;
            margin-top: 35px;
            margin-bottom: 18px;
            color: #34495e;
            font-weight: 600;
            padding-left: 0;
        }

        h4 {
            font-size: 17px;
            margin-top: 28px;
            margin-bottom: 14px;
            color: #555;
            font-weight: 600;
        }

        /* ===== 增强的段落和列表样式 ===== */
        p {
            margin: 18px 0;
            line-height: 1.85;
            color: #444;
            text-align: justify;
        }

        ul, ol {
            margin: 22px 0;
            padding-left: 32px;
        }

        li {
            margin: 12px 0;
            line-height: 1.8;
            color: #555;
        }

        /* ===== 增强的模块描述卡片 ===== */
        .module-description {
            background: linear-gradient(135deg, #f5f7fa 0%, #e8eef7 100%);
            padding: 25px 30px;
            border-left: 5px solid #4a90e2;
            margin: 30px 0;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        }

        .module-description h3 {
            margin-top: 0;
            color: #4a90e2;
            font-size: 18px;
        }

        .module-description ul {
            margin: 15px 0 0 0;
        }

        .module-description li {
            color: #555;
            margin: 10px 0;
        }

        /* ===== 增强的信息框 ===== */
        .info-box {
            background: #f0f7ff;
            padding: 25px 30px;
            border-left: 5px solid #2196f3;
            margin: 30px 0;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        }

        .info-box h2,
        .info-box h3 {
            margin-top: 0;
            color: #1565c0;
            border: none;
            padding: 0;
            margin-bottom: 12px;
        }

        .warning-box {
            background: #fff8f0;
            padding: 25px 30px;
            border-left: 5px solid #ff9800;
            margin: 30px 0;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        }

        .warning-box h3 {
            margin-top: 0;
            color: #e65100;
            margin-bottom: 12px;
        }

        /* ===== 增强的表格样式 ===== */
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 30px 0;
            background: white;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
            border-radius: 8px;
            overflow: hidden;
        }

        th {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 16px 18px;
            text-align: left;
            font-weight: 600;
            font-size: 13px;
            letter-spacing: 0.5px;
        }

        td {
            padding: 14px 18px;
            border-bottom: 1px solid #f0f0f0;
            font-size: 14px;
            color: #555;
        }

        tr:hover {
            background: #fafbfc;
        }

        tr:last-child td {
            border-bottom: none;
        }

        /* ===== 增强的代码块样式 ===== */
        pre {
            background: #282c34;
            color: #abb2bf;
            padding: 24px 28px;
            border-radius: 8px;
            overflow-x: auto;
            margin: 28px 0;
            font-size: 13px;
            line-height: 1.7;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            border-left: 4px solid #4a90e2;
        }

        code {
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'Source Code Pro', monospace;
        }

        p code, li code {
            background: #f5f5f5;
            color: #e74c3c;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 0.9em;
            border: 1px solid #e0e0e0;
        }

        /* ===== 增强的引用块 ===== */
        blockquote {
            border-left: 5px solid #667eea;
            padding: 20px 28px;
            background: #f5f7fa;
            margin: 28px 0;
            border-radius: 6px;
            font-style: italic;
            color: #555;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }

        /* ===== 增强的高亮 ===== */
        .highlight {
            background: #fff3cd;
            padding: 4px 10px;
            border-radius: 4px;
            font-weight: 600;
            color: #856404;
        }

        /* ===== 功能模块关系图 ===== */
        .module-relations {
            background: #f9fafb;
            padding: 28px 30px;
            border-radius: 8px;
            margin: 30px 0;
            border: 2px dashed #e0e0e0;
        }

        .module-relations h4 {
            margin-top: 0;
            color: #2c3e50;
            margin-bottom: 18px;
        }

        /* ===== 增强的响应式设计 ===== */
        @media (max-width: 1024px) {
            .content {
                padding: 40px 50px;
            }
        }

        @media (max-width: 768px) {
            .sidebar {
                position: relative;
                width: 100%;
                height: auto;
                border-right: none;
                border-bottom: 1px solid #e0e0e0;
            }
            .content {
                margin-left: 0;
                padding: 30px 20px;
            }
            .doc-header h1 {
                font-size: 28px;
            }
            h1 {
                font-size: 24px;
            }
            h2 {
                font-size: 20px;
            }
            .sidebar-nav-item .nav-desc {
                display: none !important;
            }
        }
'''


if __name__ == '__main__':
    print("优化HTML文档已完成")
    print("- 增强的导航结构")
    print("- 改进的CSS样式和间距")
    print("- 更好的可读性")
