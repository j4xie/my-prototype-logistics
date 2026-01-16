const fs = require('fs');
const path = require('path');

// 页面配置
const pages = [
    // 认证模块
    {
        path: 'pages/auth/register-phase1.html',
        title: '注册 - 手机验证',
        description: '两阶段注册的第一步：手机号验证和白名单检查'
    },
    {
        path: 'pages/auth/register-phase2.html',
        title: '注册 - 完善信息',
        description: '两阶段注册的第二步：填写用户信息完成注册'
    },
    {
        path: 'pages/auth/activation.html',
        title: '设备激活',
        description: '使用激活码激活设备,绑定设备ID'
    },

    // 批次管理模块
    {
        path: 'pages/batch/detail.html',
        title: '批次详情',
        description: '查看批次完整信息、成本分析、时间线、质检记录等'
    },
    {
        path: 'pages/batch/create.html',
        title: '创建批次',
        description: '创建新的生产批次,填写产品类型、原材料、目标产量等信息'
    },
    {
        path: 'pages/batch/edit.html',
        title: '编辑批次',
        description: '编辑批次信息（仅planning状态可编辑）'
    },
    {
        path: 'pages/batch/timeline.html',
        title: '批次时间线',
        description: '查看批次从创建到完成的所有操作记录时间线'
    },

    // 质检管理模块
    {
        path: 'pages/quality/list.html',
        title: '质检记录列表',
        description: '查看所有质检记录,支持按类型、结果筛选'
    },
    {
        path: 'pages/quality/create.html',
        title: '创建质检记录',
        description: '创建质检记录,支持三阶段质检（原料/过程/成品）'
    },
    {
        path: 'pages/quality/detail.html',
        title: '质检详情',
        description: '查看质检详细信息、检测项结果、照片等'
    },
    {
        path: 'pages/quality/statistics.html',
        title: '质检统计分析',
        description: '质检合格率趋势、不合格项TOP10、质检员绩效等'
    },

    // 员工管理模块
    {
        path: 'pages/employee/clock.html',
        title: '员工打卡',
        description: '上班/下班打卡、GPS位置记录、工作类型选择'
    },
    {
        path: 'pages/employee/history.html',
        title: '打卡历史',
        description: '查看历史打卡记录、工作时段统计'
    },
    {
        path: 'pages/employee/statistics.html',
        title: '工时统计',
        description: '日/周/月工时统计、加班统计、工资预估'
    },
    {
        path: 'pages/employee/work-record.html',
        title: '工作记录',
        description: '查看个人工作记录、关联批次、工作效率'
    },

    // 设备监控模块
    {
        path: 'pages/equipment/list.html',
        title: '设备列表',
        description: '查看所有设备、状态筛选、设备类型筛选'
    },
    {
        path: 'pages/equipment/monitoring.html',
        title: '设备实时监控',
        description: '实时监控设备参数（温度/湿度/压力等）、异常告警'
    },
    {
        path: 'pages/equipment/detail.html',
        title: '设备详情',
        description: '设备基本信息、运行历史、维护记录、使用记录'
    },
    {
        path: 'pages/equipment/alerts.html',
        title: '设备告警',
        description: '设备告警列表、告警确认、告警处理记录'
    },

    // 成本分析模块
    {
        path: 'pages/cost/dashboard.html',
        title: '成本仪表板',
        description: '成本概览、成本构成饼图、成本趋势'
    },
    {
        path: 'pages/cost/batch-detail.html',
        title: '批次成本详情',
        description: '批次成本明细、成本构成分析、AI优化建议'
    },
    {
        path: 'pages/cost/trend.html',
        title: '成本趋势分析',
        description: '成本趋势图、成本对比、成本预警'
    },
    {
        path: 'pages/cost/ai-analysis.html',
        title: 'AI成本分析',
        description: 'AI智能分析成本异常、提供优化建议'
    },

    // 生产仪表板
    {
        path: 'pages/dashboard/overview.html',
        title: '生产概览',
        description: '生产概览仪表板、关键指标、告警摘要'
    },
    {
        path: 'pages/dashboard/production.html',
        title: '生产统计',
        description: '生产数据统计、产量趋势、效率分析'
    },
    {
        path: 'pages/dashboard/quality.html',
        title: '质量统计',
        description: '质量数据统计、合格率趋势、不合格分析'
    },
    {
        path: 'pages/dashboard/alerts.html',
        title: '告警中心',
        description: '所有告警汇总、告警级别分类、处理状态'
    },

    // 溯源查询
    {
        path: 'pages/trace/consumer.html',
        title: '消费者溯源查询',
        description: '消费者扫码查询产品溯源信息'
    },
    {
        path: 'pages/trace/enterprise.html',
        title: '企业端追溯',
        description: '企业端详细追溯查询、完整档案查看'
    },
    {
        path: 'pages/trace/regulator.html',
        title: '监管端追溯',
        description: '监管部门追溯查询、数据导出、审计日志'
    },
    {
        path: 'pages/trace/qr-generate.html',
        title: '溯源码生成',
        description: '生成产品溯源二维码、批次绑定、打印标签'
    }
];

// HTML模板
function generatePageHTML(pageConfig) {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${pageConfig.title} - 白垩纪食品溯源系统</title>
    <link rel="stylesheet" href="../../assets/css/common.css">
    <style>
        /* 页面特定样式 */
        .page-banner {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            border-radius: 12px;
            margin-bottom: 24px;
            text-align: center;
        }

        .page-banner h1 {
            font-size: 32px;
            margin-bottom: 12px;
        }

        .page-banner p {
            opacity: 0.9;
            font-size: 16px;
        }

        .placeholder-content {
            background: white;
            border-radius: 12px;
            padding: 60px 40px;
            text-align: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }

        .placeholder-icon {
            font-size: 80px;
            margin-bottom: 24px;
            opacity: 0.3;
        }

        .placeholder-text {
            font-size: 18px;
            color: #8c8c8c;
            margin-bottom: 16px;
        }

        .feature-list {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-top: 40px;
        }

        .feature-card {
            background: white;
            padding: 24px;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            border-left: 4px solid #1890ff;
        }

        .feature-card h3 {
            color: #1890ff;
            margin-bottom: 12px;
            font-size: 18px;
        }

        .feature-card p {
            color: #595959;
            font-size: 14px;
            line-height: 1.6;
        }
    </style>
</head>
<body>
    <div class="page-container">
        <!-- 页面头部 -->
        <div class="page-header">
            <div class="navbar">
                <a href="../../index.html" class="logo">
                    <span>🦕</span>
                    <span>白垩纪溯源系统</span>
                </a>
                <ul class="nav-menu">
                    <li class="nav-item"><a href="../dashboard/overview.html">仪表板</a></li>
                    <li class="nav-item"><a href="../batch/list.html">批次管理</a></li>
                    <li class="nav-item"><a href="../quality/list.html">质检管理</a></li>
                    <li class="nav-item"><a href="../equipment/monitoring.html">设备监控</a></li>
                </ul>
            </div>
            <div class="user-info">
                <span class="text-muted">工厂超管</span>
                <div class="avatar">张</div>
            </div>
        </div>

        <!-- 主内容区 -->
        <div class="page-content">
            <div class="page-banner">
                <h1>${pageConfig.title}</h1>
                <p>${pageConfig.description}</p>
            </div>

            <div class="placeholder-content">
                <div class="placeholder-icon">📄</div>
                <div class="placeholder-text">此页面的详细原型正在开发中...</div>
                <p class="text-muted">基于PRD文档的功能需求，将包含以下核心功能：</p>
            </div>

            <div class="feature-list">
                <div class="feature-card">
                    <h3>📋 完整功能</h3>
                    <p>根据PRD需求文档设计的完整业务流程和交互逻辑</p>
                </div>
                <div class="feature-card">
                    <h3>🎨 高保真UI</h3>
                    <p>遵循Material Design规范的现代化界面设计</p>
                </div>
                <div class="feature-card">
                    <h3>📱 响应式设计</h3>
                    <p>适配PC、平板、移动端的多设备响应式布局</p>
                </div>
                <div class="feature-card">
                    <h3>🔐 权限控制</h3>
                    <p>基于7级角色权限体系的精细化访问控制</p>
                </div>
            </div>

            <div class="card mt-lg">
                <div class="card-header">
                    <h3 class="card-title">页面说明</h3>
                </div>
                <p style="line-height: 1.8; color: #595959;">
                    此页面是根据《白垩纪食品溯源系统PRD》文档自动生成的高保真原型。
                    实际开发中将包含完整的表单、表格、图表、交互逻辑等功能组件。
                    <br><br>
                    <strong>参考文档：</strong>
                    <ul style="margin-top: 12px; padding-left: 20px;">
                        <li>PRD-系统产品需求文档.md</li>
                        <li>PRD-生产模块规划.md</li>
                        <li>PRD-认证规划.md</li>
                    </ul>
                </p>
            </div>

            <div class="flex-between mt-lg">
                <a href="../../index.html" class="btn btn-default">← 返回导航</a>
                <a href="../batch/list.html" class="btn btn-primary">查看批次列表示例 →</a>
            </div>
        </div>
    </div>
</body>
</html>
`;
}

// 生成所有页面
function generateAllPages() {
    const baseDir = path.join(__dirname);

    pages.forEach(pageConfig => {
        const filePath = path.join(baseDir, pageConfig.path);
        const dir = path.dirname(filePath);

        // 创建目录
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // 生成HTML
        const html = generatePageHTML(pageConfig);

        // 写入文件
        fs.writeFileSync(filePath, html, 'utf-8');
        console.log(`✓ Generated: ${pageConfig.path}`);
    });

    console.log(`\n✅ Successfully generated ${pages.length} pages!`);
}

// 执行生成
generateAllPages();
