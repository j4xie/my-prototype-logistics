'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Badge from '@/components/ui/badge';
import {
  Grid,
  Navigation,
  PlayCircle,
  TreePine,
  Map,
  Search,
  ExternalLink
} from 'lucide-react';

// 添加滚动条隐藏样式
const scrollbarHideStyles = `
  .scrollbar-hide {
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none;  /* Firefox */
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;  /* Chrome, Safari and Opera */
  }
`;

// 注入样式到页面
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = scrollbarHideStyles;
  if (!document.head.querySelector('style[data-scrollbar-hide]')) {
    style.setAttribute('data-scrollbar-hide', 'true');
    document.head.appendChild(style);
  }
}

type PreviewMode = 'grid' | 'navigation' | 'flow' | 'hierarchy' | 'sitemap';
type CategoryFilter = 'all' | 'P0' | 'P1-1' | 'P1-2' | 'P1-3' | 'P1-4' | 'P2-1' | 'P2-2';

// 页面数据结构
interface PageItem {
  id: string;
  title: string;
  route: string;
  category: 'P0' | 'P1-1' | 'P1-2' | 'P1-3' | 'P1-4' | 'P2-1' | 'P2-2';
  module: string;
  description: string;
  status: 'active' | 'draft' | 'disabled';
  complexity: 'simple' | 'complex' | 'advanced';
  deviceOptimized: 'mobile' | 'desktop' | 'both';
  tags?: string[]; // 可选的标签属性
}

// 基于103个真实页面的完整数据 - 动态统计版本
// P0核心(12) + P1-1养殖(20) + P1-2加工(29) + P1-3物流(9) + P1-4销售(11) + P2-1用户(9) + P2-2系统(13) = 103页面
const actualPages: PageItem[] = [
  // P0 - 核心系统 (11个页面)
  { id: '1', title: '系统首页', route: '/', category: 'P0', module: '核心系统', description: '系统主入口', status: 'active', complexity: 'simple', deviceOptimized: 'both' },
  { id: '2', title: '用户登录', route: '/login', category: 'P0', module: '核心系统', description: '用户认证入口', status: 'active', complexity: 'simple', deviceOptimized: 'mobile' },
  { id: '3', title: '用户注册', route: '/register', category: 'P0', module: '核心系统', description: '新用户注册', status: 'active', complexity: 'simple', deviceOptimized: 'mobile' },
  { id: '4', title: '密码重置', route: '/reset-password', category: 'P0', module: '核心系统', description: '忘记密码重置', status: 'active', complexity: 'simple', deviceOptimized: 'mobile' },
  { id: '5', title: '认证登录', route: '/auth/login', category: 'P0', module: '核心系统', description: '统一认证登录', status: 'active', complexity: 'simple', deviceOptimized: 'mobile' },
  { id: '6', title: '首页选择器', route: '/(dashboard)/home/selector', category: 'P0', module: '核心系统', description: '首页导航选择', status: 'active', complexity: 'simple', deviceOptimized: 'both' },
  { id: '7', title: '系统设置', route: '/settings', category: 'P0', module: '核心系统', description: '系统配置设置', status: 'active', complexity: 'simple', deviceOptimized: 'both' },
  { id: '8', title: '预览系统', route: '/preview', category: 'P0', module: '核心系统', description: '页面预览系统', status: 'active', complexity: 'advanced', deviceOptimized: 'desktop' },
  { id: '9', title: '系统导航', route: '/navigation', category: 'P0', module: '核心系统', description: '全局导航系统', status: 'active', complexity: 'simple', deviceOptimized: 'both' },
  { id: '103', title: '错误页面', route: '/error', category: 'P0', module: '核心系统', description: '系统错误页面', status: 'active', complexity: 'simple', deviceOptimized: 'both' },
  { id: '104', title: '404页面', route: '/404', category: 'P0', module: '核心系统', description: '页面未找到', status: 'active', complexity: 'simple', deviceOptimized: 'both' },

  // P0 - 平台管理 (1个页面) - 超级管理员专用
  { id: '105', title: '平台管理控制台', route: '/platform', category: 'P0', module: '平台管理', description: '多租户SaaS平台管理 - 工厂管理、订阅套餐、操作日志', status: 'active', complexity: 'advanced', deviceOptimized: 'desktop', tags: ['超级管理员', '多租户', 'SaaS'] },

  // P1-1 🐄 养殖模块 (19个页面)
  { id: '10', title: '养殖主页', route: '/farming', category: 'P1-1', module: '养殖模块', description: '养殖业务主入口', status: 'active', complexity: 'simple', deviceOptimized: 'mobile' },
  { id: '11', title: '繁殖管理', route: '/farming/breeding', category: 'P1-1', module: '养殖模块', description: '动物繁殖记录管理', status: 'active', complexity: 'complex', deviceOptimized: 'mobile' },
  { id: '12', title: '疫苗管理', route: '/farming/vaccine', category: 'P1-1', module: '养殖模块', description: '疫苗接种记录', status: 'active', complexity: 'complex', deviceOptimized: 'mobile' },
  { id: '13', title: '作物管理', route: '/farming/crops', category: 'P1-1', module: '养殖模块', description: '农作物种植管理', status: 'active', complexity: 'complex', deviceOptimized: 'mobile' },
  { id: '14', title: '田地管理', route: '/farming/fields', category: 'P1-1', module: '养殖模块', description: '农田信息管理', status: 'active', complexity: 'complex', deviceOptimized: 'mobile' },
  { id: '15', title: '农场活动', route: '/farming/farm-activities', category: 'P1-1', module: '养殖模块', description: '日常农场活动记录', status: 'active', complexity: 'complex', deviceOptimized: 'mobile' },
  { id: '16', title: '农场管理', route: '/farming/farm-management', category: 'P1-1', module: '养殖模块', description: '农场整体运营管理', status: 'active', complexity: 'complex', deviceOptimized: 'mobile' },
  { id: '17', title: '收获记录', route: '/farming/harvest-records', category: 'P1-1', module: '养殖模块', description: '农产品收获记录', status: 'active', complexity: 'complex', deviceOptimized: 'mobile' },
  { id: '18', title: '种植计划', route: '/farming/planting-plans', category: 'P1-1', module: '养殖模块', description: '作物种植规划', status: 'active', complexity: 'complex', deviceOptimized: 'mobile' },
  { id: '19', title: '创建溯源', route: '/farming/create-trace', category: 'P1-1', module: '养殖模块', description: '创建产品溯源信息', status: 'active', complexity: 'advanced', deviceOptimized: 'mobile' },
  { id: '20', title: '数据收集中心', route: '/farming/data-collection-center', category: 'P1-1', module: '养殖模块', description: '农业数据收集管理', status: 'active', complexity: 'advanced', deviceOptimized: 'mobile' },
  { id: '21', title: '手动收集', route: '/farming/manual-collection', category: 'P1-1', module: '养殖模块', description: '手动数据录入', status: 'active', complexity: 'simple', deviceOptimized: 'mobile' },
  { id: '22', title: '二维码收集', route: '/farming/qrcode-collection', category: 'P1-1', module: '养殖模块', description: '二维码扫描数据收集', status: 'active', complexity: 'simple', deviceOptimized: 'mobile' },
  { id: '23', title: '指标详情', route: '/farming/indicator-detail', category: 'P1-1', module: '养殖模块', description: '农业指标详细分析', status: 'active', complexity: 'complex', deviceOptimized: 'mobile' },
  { id: '24', title: '指标详情页', route: '/farming/indicator-detail/[id]', category: 'P1-1', module: '养殖模块', description: '特定指标详情页面', status: 'active', complexity: 'complex', deviceOptimized: 'mobile' },
  { id: '25', title: '预测分析', route: '/farming/prediction-analytics', category: 'P1-1', module: '养殖模块', description: 'AI农业预测分析', status: 'active', complexity: 'advanced', deviceOptimized: 'mobile' },
  { id: '26', title: '预测配置', route: '/farming/prediction-config', category: 'P1-1', module: '养殖模块', description: '预测模型配置', status: 'active', complexity: 'advanced', deviceOptimized: 'mobile' },
  { id: '27', title: '模型管理', route: '/farming/model-management', category: 'P1-1', module: '养殖模块', description: 'AI模型管理', status: 'active', complexity: 'advanced', deviceOptimized: 'mobile' },
  { id: '28', title: '视频监控', route: '/farming/video-monitoring', category: 'P1-1', module: '养殖模块', description: '农场视频监控系统', status: 'active', complexity: 'advanced', deviceOptimized: 'mobile' },
  { id: '29', title: '监控页面', route: '/(farming)/monitor', category: 'P1-1', module: '养殖模块', description: '农场实时监控', status: 'active', complexity: 'advanced', deviceOptimized: 'mobile' },

  // P1-2 🏭 加工模块 (21个页面) - 包含生产、质量、存储子模块
  { id: '30', title: '加工主页', route: '/processing', category: 'P1-2', module: '加工模块', description: '食品加工业务主入口', status: 'active', complexity: 'simple', deviceOptimized: 'both' },
  { id: '31', title: '生产管理', route: '/processing/production', category: 'P1-2', module: '加工模块', description: '生产流程管理', status: 'active', complexity: 'complex', deviceOptimized: 'both' },
  { id: '32', title: '设备监控', route: '/processing/production/equipment-monitor', category: 'P1-2', module: '加工模块', description: '生产设备监控', status: 'active', complexity: 'advanced', deviceOptimized: 'desktop' },
  { id: '33', title: '生产计划', route: '/processing/production/planning', category: 'P1-2', module: '加工模块', description: '生产计划制定', status: 'active', complexity: 'complex', deviceOptimized: 'both' },
  { id: '34', title: '生产报告', route: '/processing/production/reports', category: 'P1-2', module: '加工模块', description: '生产数据报告', status: 'active', complexity: 'complex', deviceOptimized: 'desktop' },
  { id: '35', title: '生产团队', route: '/processing/production/teams', category: 'P1-2', module: '加工模块', description: '生产团队管理', status: 'active', complexity: 'complex', deviceOptimized: 'both' },
  { id: '36', title: '生产工作流', route: '/processing/production/workflow', category: 'P1-2', module: '加工模块', description: '生产流程配置', status: 'active', complexity: 'advanced', deviceOptimized: 'desktop' },
  { id: '37', title: '质量管理', route: '/processing/quality', category: 'P1-2', module: '加工模块', description: '产品质量控制', status: 'active', complexity: 'complex', deviceOptimized: 'both' },
  { id: '38', title: '质量异常', route: '/processing/quality/exceptions', category: 'P1-2', module: '加工模块', description: '质量异常处理', status: 'active', complexity: 'complex', deviceOptimized: 'both' },
  { id: '39', title: 'HACCP管理', route: '/processing/quality/haccp', category: 'P1-2', module: '加工模块', description: 'HACCP体系管理', status: 'active', complexity: 'advanced', deviceOptimized: 'desktop' },
  { id: '40', title: '肉类评估', route: '/processing/quality/meat-evaluation', category: 'P1-2', module: '加工模块', description: '肉类品质评估', status: 'active', complexity: 'complex', deviceOptimized: 'both' },
  { id: '41', title: '质量报告', route: '/processing/quality/reports/[id]', category: 'P1-2', module: '加工模块', description: '质量检测报告', status: 'active', complexity: 'complex', deviceOptimized: 'desktop' },
  { id: '42', title: '质量标准', route: '/processing/quality/standards', category: 'P1-2', module: '加工模块', description: '质量标准管理', status: 'active', complexity: 'complex', deviceOptimized: 'desktop' },
  { id: '43', title: '温度监控', route: '/processing/quality/temperature', category: 'P1-2', module: '加工模块', description: '温度监控系统', status: 'active', complexity: 'advanced', deviceOptimized: 'both' },
  { id: '44', title: '存储管理', route: '/processing/storage', category: 'P1-2', module: '加工模块', description: '仓储管理系统', status: 'active', complexity: 'complex', deviceOptimized: 'both' },
  { id: '45', title: '冷链管理', route: '/processing/storage/cold-chain', category: 'P1-2', module: '加工模块', description: '冷链运输管理', status: 'active', complexity: 'advanced', deviceOptimized: 'both' },
  { id: '46', title: '成品存储', route: '/processing/storage/finished-goods', category: 'P1-2', module: '加工模块', description: '成品仓库管理', status: 'active', complexity: 'complex', deviceOptimized: 'both' },
  { id: '47', title: '库存盘点', route: '/processing/storage/inventory-check', category: 'P1-2', module: '加工模块', description: '库存盘点系统', status: 'active', complexity: 'complex', deviceOptimized: 'both' },
  { id: '48', title: '原料存储', route: '/processing/storage/raw-materials', category: 'P1-2', module: '加工模块', description: '原材料仓库管理', status: 'active', complexity: 'complex', deviceOptimized: 'both' },
  { id: '49', title: '仓库配置', route: '/processing/storage/warehouse-config', category: 'P1-2', module: '加工模块', description: '仓库配置管理', status: 'active', complexity: 'complex', deviceOptimized: 'desktop' },
  { id: '50', title: '成品管理', route: '/processing/finished-products', category: 'P1-2', module: '加工模块', description: '最终产品管理', status: 'active', complexity: 'complex', deviceOptimized: 'both' },

  // P1-3 🚚 物流模块 (7个页面)
  { id: '60', title: '物流主页', route: '/logistics', category: 'P1-3', module: '物流模块', description: '物流管理主入口', status: 'active', complexity: 'simple', deviceOptimized: 'both' },
  { id: '61', title: '配送管理', route: '/logistics/delivery-management', category: 'P1-3', module: '物流模块', description: '配送订单管理', status: 'active', complexity: 'complex', deviceOptimized: 'both' },
  { id: '62', title: '运输订单', route: '/logistics/transport-orders', category: 'P1-3', module: '物流模块', description: '运输订单管理', status: 'active', complexity: 'complex', deviceOptimized: 'both' },
  { id: '63', title: '物流跟踪', route: '/(logistics)/tracking', category: 'P1-3', module: '物流模块', description: '实时物流跟踪', status: 'active', complexity: 'advanced', deviceOptimized: 'mobile' },
  { id: '64', title: '库存管理', route: '/inventory/stocks', category: 'P1-3', module: '物流模块', description: '库存状态管理', status: 'active', complexity: 'complex', deviceOptimized: 'both' },
  { id: '65', title: '溯源查询', route: '/(trace)/query', category: 'P1-3', module: '物流模块', description: '产品溯源查询', status: 'active', complexity: 'simple', deviceOptimized: 'mobile' },
  { id: '66', title: '溯源列表', route: '/(trace)/list', category: 'P1-3', module: '物流模块', description: '溯源记录列表', status: 'active', complexity: 'complex', deviceOptimized: 'both' },

  // P1-4 💰 销售管理 (21个页面)
  { id: '70', title: '销售订单', route: '/sales/orders', category: 'P1-4', module: '销售管理', description: '销售订单管理', status: 'active', complexity: 'complex', deviceOptimized: 'both' },
  { id: '71', title: '价格管理', route: '/sales/pricing', category: 'P1-4', module: '销售管理', description: '产品定价管理', status: 'active', complexity: 'complex', deviceOptimized: 'both' },
  { id: '72', title: '销售报告', route: '/sales/reports', category: 'P1-4', module: '销售管理', description: '销售数据分析', status: 'active', complexity: 'complex', deviceOptimized: 'desktop' },
  { id: '73', title: '客户管理', route: '/crm/customers', category: 'P1-4', module: '销售管理', description: 'CRM客户关系管理', status: 'active', complexity: 'complex', deviceOptimized: 'both' },
  { id: '74', title: '财务报告', route: '/finance/reports', category: 'P1-4', module: '销售管理', description: '财务数据报告', status: 'active', complexity: 'complex', deviceOptimized: 'desktop' },
  { id: '75', title: '供应商管理', route: '/procurement/suppliers', category: 'P1-4', module: '销售管理', description: '供应商关系管理', status: 'active', complexity: 'complex', deviceOptimized: 'both' },
  { id: '76', title: '质量检查', route: '/quality/inspections', category: 'P1-4', module: '销售管理', description: '产品质量检查', status: 'active', complexity: 'complex', deviceOptimized: 'both' },
  { id: '77', title: 'AI演示', route: '/ai-demo', category: 'P1-4', module: '销售管理', description: 'AI功能演示', status: 'active', complexity: 'advanced', deviceOptimized: 'both' },
  { id: '78', title: '组件演示', route: '/components', category: 'P1-4', module: '销售管理', description: 'UI组件演示', status: 'active', complexity: 'simple', deviceOptimized: 'both' },
  { id: '79', title: '演示页面', route: '/demo', category: 'P1-4', module: '销售管理', description: '功能演示页面', status: 'active', complexity: 'simple', deviceOptimized: 'both' },
  { id: '80', title: '帮助中心', route: '/help-center', category: 'P1-4', module: '销售管理', description: '用户帮助文档', status: 'active', complexity: 'simple', deviceOptimized: 'both' },

  // 补充加工模块剩余页面
  { id: '51', title: '生产批次', route: '/processing/production-batches', category: 'P1-2', module: '加工模块', description: '生产批次管理', status: 'active', complexity: 'complex', deviceOptimized: 'both' },
  { id: '52', title: '生产计划', route: '/processing/production-planning', category: 'P1-2', module: '加工模块', description: '生产计划制定', status: 'active', complexity: 'complex', deviceOptimized: 'both' },
  { id: '53', title: '质量测试', route: '/processing/quality-tests', category: 'P1-2', module: '加工模块', description: '产品质量测试', status: 'active', complexity: 'complex', deviceOptimized: 'both' },
  { id: '54', title: '原材料', route: '/processing/raw-materials', category: 'P1-2', module: '加工模块', description: '原材料管理', status: 'active', complexity: 'complex', deviceOptimized: 'both' },
  { id: '55', title: '配方管理', route: '/processing/recipes', category: 'P1-2', module: '加工模块', description: '产品配方管理', status: 'active', complexity: 'complex', deviceOptimized: 'both' },
  { id: '56', title: '处理报告', route: '/processing/reports', category: 'P1-2', module: '加工模块', description: '加工处理报告', status: 'active', complexity: 'complex', deviceOptimized: 'desktop' },
  { id: '57', title: '照片管理', route: '/processing/photos', category: 'P1-2', module: '加工模块', description: '产品照片管理', status: 'active', complexity: 'simple', deviceOptimized: 'both' },
  { id: '58', title: '加工报告', route: '/(processing)/reports', category: 'P1-2', module: '加工模块', description: '加工业务报告', status: 'active', complexity: 'complex', deviceOptimized: 'desktop' },

  // 补充物流模块剩余页面
  { id: '67', title: '溯源详情', route: '/(trace)/detail/[id]', category: 'P1-3', module: '物流模块', description: '溯源详细信息', status: 'active', complexity: 'complex', deviceOptimized: 'mobile' },
  { id: '68', title: '溯源证书', route: '/(trace)/certificate/[id]', category: 'P1-3', module: '物流模块', description: '溯源认证证书', status: 'active', complexity: 'simple', deviceOptimized: 'mobile' },

  // P2-1 👤 用户管理 (9个页面)
  { id: '81', title: '个人资料', route: '/profile', category: 'P2-1', module: '用户管理', description: '个人信息管理', status: 'active', complexity: 'simple', deviceOptimized: 'mobile' },
  { id: '82', title: '关于我', route: '/profile/about', category: 'P2-1', module: '用户管理', description: '个人介绍页面', status: 'active', complexity: 'simple', deviceOptimized: 'mobile' },
  { id: '83', title: '数据导出', route: '/profile/data-export', category: 'P2-1', module: '用户管理', description: '个人数据导出', status: 'active', complexity: 'complex', deviceOptimized: 'mobile' },
  { id: '84', title: '编辑资料', route: '/profile/edit', category: 'P2-1', module: '用户管理', description: '编辑个人信息', status: 'active', complexity: 'complex', deviceOptimized: 'mobile' },
  { id: '85', title: '用户反馈', route: '/profile/feedback', category: 'P2-1', module: '用户管理', description: '意见反馈系统', status: 'active', complexity: 'complex', deviceOptimized: 'mobile' },
  { id: '86', title: '通知管理', route: '/profile/notifications', category: 'P2-1', module: '用户管理', description: '消息通知管理', status: 'active', complexity: 'simple', deviceOptimized: 'mobile' },
  { id: '87', title: '修改密码', route: '/profile/password', category: 'P2-1', module: '用户管理', description: '密码安全管理', status: 'active', complexity: 'simple', deviceOptimized: 'mobile' },
  { id: '88', title: '隐私设置', route: '/profile/privacy', category: 'P2-1', module: '用户管理', description: '隐私权限控制', status: 'active', complexity: 'complex', deviceOptimized: 'mobile' },
  { id: '89', title: '安全设置', route: '/profile/security', category: 'P2-1', module: '用户管理', description: '账户安全管理', status: 'active', complexity: 'complex', deviceOptimized: 'mobile' },

  // P2-2 ⚙️ 系统管理 (13个页面)
  { id: '90', title: '管理仪表板', route: '/admin/dashboard', category: 'P2-2', module: '系统管理', description: '管理后台主页', status: 'active', complexity: 'complex', deviceOptimized: 'desktop' },
  { id: '91', title: '管理员仪表板', route: '/(admin)/dashboard', category: 'P2-2', module: '系统管理', description: '管理员控制台', status: 'active', complexity: 'complex', deviceOptimized: 'desktop' },
  { id: '92', title: '管理员用户', route: '/admin/admin-users', category: 'P2-2', module: '系统管理', description: '管理员账户管理', status: 'active', complexity: 'complex', deviceOptimized: 'desktop' },
  { id: '93', title: '审计追踪', route: '/admin/audit', category: 'P2-2', module: '系统管理', description: '系统审计日志', status: 'active', complexity: 'complex', deviceOptimized: 'desktop' },
  { id: '94', title: '系统备份', route: '/admin/backup', category: 'P2-2', module: '系统管理', description: '数据备份管理', status: 'active', complexity: 'complex', deviceOptimized: 'desktop' },
  { id: '95', title: '数据导入', route: '/admin/import', category: 'P2-2', module: '系统管理', description: '批量数据导入', status: 'active', complexity: 'complex', deviceOptimized: 'desktop' },
  { id: '96', title: '系统日志', route: '/admin/logs', category: 'P2-2', module: '系统管理', description: '系统运行日志', status: 'active', complexity: 'complex', deviceOptimized: 'desktop' },
  { id: '97', title: '通知中心', route: '/admin/notifications', category: 'P2-2', module: '系统管理', description: '系统通知管理', status: 'active', complexity: 'simple', deviceOptimized: 'desktop' },
  { id: '98', title: '性能监控', route: '/admin/performance', category: 'P2-2', module: '系统管理', description: '系统性能监控', status: 'active', complexity: 'advanced', deviceOptimized: 'desktop' },
  { id: '99', title: '权限管理', route: '/admin/permissions', category: 'P2-2', module: '系统管理', description: '角色权限控制', status: 'active', complexity: 'complex', deviceOptimized: 'desktop' },
  { id: '100', title: '产品管理', route: '/admin/products', category: 'P2-2', module: '系统管理', description: '产品信息管理', status: 'active', complexity: 'complex', deviceOptimized: 'desktop' },
  { id: '101', title: '管理报告', route: '/admin/reports', category: 'P2-2', module: '系统管理', description: '管理数据报告', status: 'active', complexity: 'complex', deviceOptimized: 'desktop' },
  { id: '102', title: '角色管理', route: '/admin/roles', category: 'P2-2', module: '系统管理', description: '用户角色管理', status: 'active', complexity: 'complex', deviceOptimized: 'desktop' }
];

export default function PreviewSystemPage() {
  // 客户端挂载检查，避免水合错误
  const [mounted, setMounted] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('grid');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Navigation模式的状态
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [navigationHistory, setNavigationHistory] = useState<string[]>([]);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set(['核心系统']));

  // Flow模式的状态
  const [selectedFlow, setSelectedFlow] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  // Hierarchy模式的状态
  const [selectedHierarchyNode, setSelectedHierarchyNode] = useState<string | null>(null);
  const [expandedHierarchy, setExpandedHierarchy] = useState<Set<string>>(new Set(['root', '核心系统']));

  // Sitemap模式的状态
  const [sitemapViewMode, setSitemapViewMode] = useState<'graph' | 'tree' | 'matrix'>('graph');
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);

  // Flow模式自动播放逻辑 (Flow模式的useEffect)
  useEffect(() => {
    if (!isPlaying || !selectedFlow) return;

    const step = selectedFlow.steps[currentStep];
    if (!step) {
      setIsPlaying(false);
      return;
    }

    const interval = setInterval(() => {
      setProgress((prev) => {
        const newProgress = prev + (100 / (step.duration / 100));
        if (newProgress >= 100) {
          if (currentStep < selectedFlow.steps.length - 1) {
            setCurrentStep(prev => prev + 1);
            return 0;
          } else {
            setIsPlaying(false);
            return 100;
          }
        }
        return newProgress;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, selectedFlow, currentStep]);

  // 确保组件在客户端挂载后才渲染
  useEffect(() => {
    setMounted(true);
  }, []);

  // 动态获取当前端口（仅在客户端）
  const getCurrentHost = () => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return 'http://localhost:3000';
  };

  // 在挂载前返回加载状态，避免水合错误
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">预览系统加载中...</p>
        </div>
      </div>
    );
  }

  const previewModes = [
    {
      id: 'grid' as const,
      name: '网格预览',
      description: '页面缩略图网格展示',
      icon: Grid,
      color: 'bg-blue-500'
    },
    {
      id: 'navigation' as const,
      name: '导航预览',
      description: '模拟用户导航体验',
      icon: Navigation,
      color: 'bg-green-500'
    },
    {
      id: 'flow' as const,
      name: '流程预览',
      description: '用户流程自动演示',
      icon: PlayCircle,
      color: 'bg-purple-500'
    },
    {
      id: 'hierarchy' as const,
      name: '层级预览',
      description: '页面层级结构展示',
      icon: TreePine,
      color: 'bg-orange-500'
    },
    {
      id: 'sitemap' as const,
      name: '站点地图',
      description: '完整站点结构图',
      icon: Map,
      color: 'bg-red-500'
    }
  ];

  // 简化统计信息
  const stats = {
    totalPages: actualPages.length,
    totalRoutes: 137, // 103页面 + 34API
    apiEndpoints: 34,
    lastUpdated: '2025-02-02'
  };

  // 动态计算分类统计
  const calculateCategoryStats = () => {
    const stats = {
      'all': actualPages.length,
      'P0': actualPages.filter(p => p.category === 'P0').length,
      'P1-1': actualPages.filter(p => p.category === 'P1-1').length,
      'P1-2': actualPages.filter(p => p.category === 'P1-2').length,
      'P1-3': actualPages.filter(p => p.category === 'P1-3').length,
      'P1-4': actualPages.filter(p => p.category === 'P1-4').length,
      'P2-1': actualPages.filter(p => p.category === 'P2-1').length,
      'P2-2': actualPages.filter(p => p.category === 'P2-2').length
    };
    return stats;
  };

  const categoryStats = calculateCategoryStats();

  // 调试输出：实际分类统计
  console.log('=== 实际分类统计 ===');
  console.log('P0 核心系统:', categoryStats.P0, '个页面');
  console.log('P1-1 养殖模块:', categoryStats['P1-1'], '个页面');
  console.log('P1-2 加工模块:', categoryStats['P1-2'], '个页面');
  console.log('P1-3 物流模块:', categoryStats['P1-3'], '个页面');
  console.log('P1-4 销售管理:', categoryStats['P1-4'], '个页面');
  console.log('P2-1 用户管理:', categoryStats['P2-1'], '个页面');
  console.log('P2-2 系统管理:', categoryStats['P2-2'], '个页面');
  console.log('总计:', categoryStats.all, '个页面');
  console.log('=================');

  // 详细分类清单
  console.log('=== 详细分类清单 ===');
  ['P0', 'P1-1', 'P1-2', 'P1-3', 'P1-4', 'P2-1', 'P2-2'].forEach(cat => {
    const pages = actualPages.filter(p => p.category === cat);
    console.log(`\n${cat} (${pages.length}个页面):`);
    pages.forEach(p => console.log(`  - ${p.title} (${p.route})`));
  });
  console.log('=================');

  // 更新的分类体系 - 使用动态计算的数量
  const categories = [
    { id: 'all' as const, name: '全部页面', count: categoryStats.all },

    // 核心系统
    { id: 'P0' as const, name: '🔑 核心系统', count: categoryStats.P0 },

    // 业务模块细分
    { id: 'P1-1' as const, name: '🐄 养殖模块', count: categoryStats['P1-1'] },
    { id: 'P1-2' as const, name: '🏭 加工模块', count: categoryStats['P1-2'] },
    { id: 'P1-3' as const, name: '🚚 物流模块', count: categoryStats['P1-3'] },
    { id: 'P1-4' as const, name: '💰 销售管理', count: categoryStats['P1-4'] },

    // 系统管理
    { id: 'P2-1' as const, name: '👤 用户管理', count: categoryStats['P2-1'] },
    { id: 'P2-2' as const, name: '⚙️ 系统管理', count: categoryStats['P2-2'] }
  ];

  // 过滤页面
  const filteredPages = actualPages.filter(page => {
    // 分类过滤 - 修复类型匹配
    if (categoryFilter !== 'all' && page.category !== categoryFilter) {
      return false;
    }

    // 搜索过滤
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      const matchesTitle = page.title.toLowerCase().includes(searchLower);
      const matchesDesc = page.description.toLowerCase().includes(searchLower);
      const matchesTags = page.tags ?
        page.tags.some(tag => tag.toLowerCase().includes(searchLower)) : false;

      return matchesTitle || matchesDesc || matchesTags;
    }


    return true;
  });

    // 移除设备框架相关代码

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'simple': return 'bg-green-100 text-green-800';
      case 'complex': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // 获取模块图标
  const getModuleIcon = (module: string) => {
    const moduleIcons: { [key: string]: string } = {
      // 实际模块名称映射
      '核心系统': '🏠',
      '平台管理': '🏢',
      '养殖模块': '🌾',
      '加工模块': '🏭',
      '物流模块': '🚛',
      '销售管理': '💰',
      '用户管理': '👥',
      '系统管理': '⚙️',
      // 旧的映射保留以防万一
      '农业模块': '🌱',
      '溯源系统': '🔍',
      '用户系统': '👤',
      '认证系统': '🔐',
      '管理系统': '⚙️',
      'CRM模块': '👥',
      '财务模块': '💰',
      '库存模块': '📦',
      '采购模块': '🛒',
      '质量模块': '✅',
      '销售模块': '💼',
      'AI功能': '🤖',
      '开发工具': '🔧',
      '演示系统': '🎪',
      '帮助系统': '❓',
      '预览系统': '👁️',
      '系统设置': '⚙️',
      '导航系统': '🧭',
      '主页': '🏠',
      '默认': '📱'
    };
    return moduleIcons[module] || moduleIcons['默认'];
  };

  // 页面预览卡片组件
  const PagePreviewCard = ({ page }: { page: PageItem }) => {
    const renderPreviewContent = () => {
        return (
        <div className="w-full h-[200px] bg-gradient-to-br from-blue-50 via-white to-purple-50 flex flex-col items-center justify-center text-gray-500 relative overflow-hidden rounded-lg">
          {/* 装饰性背景图案 */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute top-4 left-4 w-8 h-8 border-2 border-gray-400 rounded-full"></div>
            <div className="absolute bottom-4 right-4 w-6 h-6 border-2 border-gray-400 rounded"></div>
            <div className="absolute top-1/2 right-8 w-4 h-4 bg-gray-300 rounded-full"></div>
            </div>

          {/* 主要内容 - 垂直居中 */}
          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            {/* 模块图标 - 更大更突出 */}
            <div className="text-5xl mb-4 filter drop-shadow-sm">
              {getModuleIcon(page.module)}
          </div>

            {/* 页面标题 */}
            <div className="text-sm font-semibold text-gray-700 mb-2 leading-tight max-w-full">
              {page.title}
                </div>

            {/* 模块标识 */}
            <div className="text-xs text-gray-500 mb-4 px-2 py-1 bg-white/70 rounded-md">
              {page.module}
              </div>

            {/* 简化的内容预览 */}
            <div className="w-full max-w-[80%] space-y-2">
              <div className="h-1.5 bg-gray-300 rounded animate-pulse"></div>
              <div className="h-1.5 bg-gray-300 rounded animate-pulse w-3/4 mx-auto"></div>
              <div className="h-1.5 bg-gray-300 rounded animate-pulse w-1/2 mx-auto"></div>
          </div>
        </div>

          {/* 状态指示器 */}
          <div className="absolute top-3 right-3">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-sm"></div>
                </div>

            {/* 悬停时显示的操作按钮 */}
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
              <div className="flex gap-2">
                <Button
                  size="small"
                  variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(`${getCurrentHost()}${page.route}`, '_blank');
                }}
                className="bg-white/95 hover:bg-white shadow-lg backdrop-blur-sm text-xs px-3 py-1.5"
                title="在新窗口打开页面"
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                打开
                </Button>
              </div>
            </div>
        </div>
      );
    };

    return (
      <Card
        className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] bg-white border border-gray-200 flex flex-col h-full cursor-pointer"
        onClick={(e) => {
          // Ctrl+点击时在新窗口打开，普通点击时在当前窗口打开
          if (e.ctrlKey || e.metaKey) {
            window.open(`${getCurrentHost()}${page.route}`, '_blank');
          } else {
            window.location.href = `${getCurrentHost()}${page.route}`;
          }
        }}
      >
                 <CardContent className="p-4 flex flex-col h-full">
           {/* 页面预览区域 - 简化版本 */}
            {renderPreviewContent()}

          {/* 页面信息 - 优化布局，确保填满剩余空间 */}
          <div className="p-4 space-y-3 flex-1 flex flex-col">
            {/* 标题和分类 */}
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-sm text-gray-900 leading-tight flex-1 line-clamp-2">
                {page.title}
              </h3>
              <Badge variant={page.category === 'P0' ? 'error' : page.category.startsWith('P1') ? 'primary' : 'default'} className="shrink-0 text-xs">
                {page.category}
              </Badge>
            </div>

            {/* 模块信息 - 图标与文字垂直居中 */}
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span className="text-base flex items-center justify-center w-5 h-5">
                {getModuleIcon(page.module)}
              </span>
              <span className="font-medium">{page.module}</span>
            </div>

            {/* 描述 */}
            <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 flex-1">
              {page.description}
            </p>

            {/* 标签和复杂度 - 改进布局 */}
            <div className="flex items-center justify-between gap-2 mt-auto">
              <div className="flex flex-wrap gap-1 flex-1">
                {page.tags?.slice(0, 1).map(tag => (
                  <span key={tag} className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-md border border-blue-200">
                    {tag}
                  </span>
                ))}
                {page.tags && page.tags.length > 1 && (
                  <span className="text-xs px-2 py-1 bg-gray-50 text-gray-500 rounded-md">
                    +{page.tags.length - 1}
                  </span>
                )}
              </div>
              <span className={`text-xs px-2 py-1 rounded-md font-medium ${getComplexityColor(page.complexity)}`}>
                {page.complexity}
              </span>
            </div>

            {/* 路径信息 - 改进样式 */}
            <div className="pt-2 border-t border-gray-100">
              <code className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded border block truncate">
                {page.route}
              </code>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Grid模式渲染
  const renderGridMode = () => (
    <div className="space-y-6">
      {/* 控制面板 - 优化布局，防止换行 */}
      <div className="bg-white rounded-lg shadow-sm border p-4 space-y-4">
        {/* 第一行：搜索框 */}
        <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="搜索页面、模块或标签..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

        {/* 第二行：分类筛选 - 使用滚动处理溢出 */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700 whitespace-nowrap">页面分类:</span>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 flex-1">
            {categories.map(category => (
              <Button
                key={category.id}
                variant={categoryFilter === category.id ? 'primary' : 'ghost'}
                size="small"
                onClick={() => setCategoryFilter(category.id)}
                className="text-sm whitespace-nowrap shrink-0"
              >
                {category.name}
                <span className="ml-1 opacity-75">({category.count})</span>
              </Button>
            ))}
          </div>
          </div>

        {/* 统计信息 - 简化版本 */}
        <div className="pt-3 border-t border-gray-100 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
          <span>显示 <strong>{filteredPages.length}</strong> / {stats.totalPages} 个页面</span>
            <span>总路由: {stats.totalRoutes}</span>
            <span>API端点: {stats.apiEndpoints}</span>
            <span>最后更新: {stats.lastUpdated}</span>
          </div>
        </div>

      {/* 页面网格 - 真正的响应式布局，充分利用屏幕宽度 */}
      <div className="w-full">
        {/* 使用CSS Grid的auto-fit实现真正响应式 */}
        <div
          className="grid gap-6 justify-center w-full"
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gridAutoRows: 'min-content'
          }}
        >
          {filteredPages.map(page => (
            <div key={page.id} className="w-full max-w-[350px] justify-self-center">
              <PagePreviewCard page={page} />
          </div>
          ))}
            </div>
          </div>

      {/* 空状态 - 改进设计 */}
      {filteredPages.length === 0 && (
        <div className="text-center py-16 max-w-md mx-auto">
          <div className="text-6xl mb-6 opacity-50">🔍</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-3">未找到匹配的页面</h3>
          <p className="text-gray-600 mb-6 leading-relaxed">
            尝试调整搜索条件或分类筛选，或者
            <button
              onClick={() => {
                setSearchQuery('');
                setCategoryFilter('all');
              }}
              className="text-blue-600 hover:text-blue-800 font-medium ml-1"
            >
              清除所有筛选
            </button>
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {['农业', '加工', '物流', '溯源'].map(tag => (
              <button
                key={tag}
                onClick={() => setSearchQuery(tag)}
                className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
              >
                搜索 &quot;{tag}&quot;
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // 按模块分组页面 (移到组件级别)
  const groupedPages = actualPages.reduce((groups, page) => {
    const pageModule = page.module;
    if (!groups[pageModule]) {
      groups[pageModule] = [];
    }
    groups[pageModule].push(page);
    return groups;
  }, {} as Record<string, PageItem[]>);

  // Navigation模式渲染
  const renderNavigationMode = () => {

    // 获取模块统计
    const moduleStats = Object.entries(groupedPages).map(([pageModule, pages]) => ({
      module: pageModule,
      count: pages.length,
      icon: getModuleIcon(pageModule),
      categories: [...new Set(pages.map(p => p.category))],
      complexity: {
        simple: pages.filter(p => p.complexity === 'simple').length,
        complex: pages.filter(p => p.complexity === 'complex').length,
        advanced: pages.filter(p => p.complexity === 'advanced').length
      }
    }));

    // 处理导航点击
    const handleNavigate = (pageId: string, pageTitle: string) => {
      setNavigationHistory(prev => [...prev.slice(-9), pageTitle]); // 保留最近10项
    };

    // 切换模块展开状态
    const toggleModule = (pageModule: string) => {
      setExpandedModules(prev => {
        const newSet = new Set(prev);
        if (newSet.has(pageModule)) {
          newSet.delete(pageModule);
        } else {
          newSet.add(pageModule);
        }
        return newSet;
      });
    };

    return (
      <div className="flex h-[calc(100vh-200px)] gap-6">
        {/* 左侧导航栏 */}
        <div className="w-80 bg-white rounded-lg shadow-sm border overflow-hidden flex flex-col">
          <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50">
            <h3 className="font-semibold text-gray-900 mb-2">导航树</h3>
            <div className="text-sm text-gray-600">
              {Object.keys(groupedPages).length} 个模块 • {actualPages.length} 个页面
            </div>
          </div>

          {/* 模块选择器 */}
          <div className="p-3 border-b">
                        <select
              className="w-full text-sm border border-gray-200 rounded px-2 py-1"
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
            >
              <option value="all">所有模块</option>
              {Object.keys(groupedPages).map(pageModule => (
                <option key={pageModule} value={pageModule}>{pageModule}</option>
              ))}
            </select>
          </div>

          {/* 导航树 */}
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            {moduleStats
              .filter(stats => selectedModule === 'all' || stats.module === selectedModule)
              .map(({ module: statsModule, count, icon, categories, complexity: _complexity }) => (
              <div key={statsModule} className="border-b border-gray-100 last:border-b-0">
                {/* 模块标题 */}
                <button
                  onClick={() => toggleModule(statsModule)}
                  className="w-full p-3 flex items-center justify-between hover:bg-gray-50 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{icon}</span>
                    <div>
                      <div className="font-medium text-sm text-gray-900">{statsModule}</div>
                      <div className="text-xs text-gray-500">
                        {count}个页面 • {categories.join(', ')}
        </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    {expandedModules.has(statsModule) ? '▼' : '▶'}
                  </div>
                </button>

                {/* 页面列表 */}
                {expandedModules.has(statsModule) && (
                  <div className="pb-2">
                    {groupedPages[statsModule].map(page => (
                      <button
                        key={page.id}
                        onClick={() => handleNavigate(page.id, page.title)}
                        className="w-full px-6 py-2 text-left hover:bg-blue-50 group flex items-center justify-between"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-gray-900 truncate group-hover:text-blue-700">
                            {page.title}
          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {page.route}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
            <Badge
                            variant={page.category === 'P0' ? 'error' : page.category.startsWith('P1') ? 'primary' : 'default'}
              className="text-xs"
            >
                            {page.category}
            </Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 右侧内容区域 */}
        <div className="flex-1 space-y-6">
          {/* 面包屑导航 */}
          {navigationHistory.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <Navigation className="w-4 h-4" />
                导航历史
              </h4>
              <div className="flex flex-wrap gap-2">
                {navigationHistory.map((item, index) => (
                  <div key={index} className="flex items-center">
                    <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                      {item}
                    </span>
                    {index < navigationHistory.length - 1 && (
                      <span className="text-gray-400 mx-1">→</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 模块统计卡片 */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h4 className="font-medium text-gray-900 mb-4">模块概览</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {moduleStats.map(({ module, count, icon, complexity }) => (
                <div key={module} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{icon}</span>
                    <div>
                      <h5 className="font-medium text-gray-900 text-sm">{module}</h5>
                      <p className="text-xs text-gray-500">{count} 个页面</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-green-600">简单: {complexity.simple}</span>
                      <span className="text-yellow-600">复杂: {complexity.complex}</span>
                      <span className="text-orange-600">高级: {complexity.advanced}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-gradient-to-r from-green-500 via-yellow-500 to-orange-500 h-1.5 rounded-full"
                        style={{ width: '100%' }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 页面关系图谱预览 */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
              <TreePine className="w-4 h-4" />
              页面关系图谱
            </h4>
            <div className="bg-gradient-to-br from-blue-50 via-white to-purple-50 rounded-lg p-8 text-center">
              <div className="space-y-4">
                {/* 简化的关系图谱可视化 */}
                <div className="flex justify-center items-center gap-4 flex-wrap">
                  {Object.keys(groupedPages).map((module, index) => (
                    <div key={module} className="relative">
                      <div className="w-16 h-16 bg-white rounded-full shadow-sm border-2 border-blue-200 flex items-center justify-center">
                        <span className="text-xl">{getModuleIcon(module)}</span>
                      </div>
                      <div className="text-xs text-center mt-1 text-gray-600">{module}</div>
                      {index < Object.keys(groupedPages).length - 1 && (
                        <div className="absolute top-8 -right-6 w-4 h-0.5 bg-blue-300"></div>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-sm text-gray-500 mt-4">
                  页面关系网络图 • {Object.keys(groupedPages).length} 个模块互联
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 其他模式的占位符 - 更新为排除navigation模式
  // 增强的用户流程定义 (包含详细的演示数据)
  const userFlows = [
      {
        id: 'core-trace-flow',
        name: '核心溯源流程',
        description: '完整的产品溯源查询流程演示',
        icon: '🔍',
        totalTime: '约2分钟',
        targetUser: '消费者',
        steps: [
          {
            pageId: 'login',
            name: '用户登录',
            action: '消费者使用手机号快速登录溯源系统',
            duration: 3000,
            details: {
              title: '消费者快速登录',
              mockData: {
                phone: '138****8888',
                verifyCode: '689523',
                loginTime: '2025-02-02 14:30'
              },
              actions: ['输入手机号', '获取验证码', '验证登录', '进入主页'],
              pageElements: ['手机输入框', '验证码按钮', '登录按钮', '隐私协议']
            }
          },
          {
            pageId: 'home-selector',
            name: '功能选择',
            action: '在主页选择溯源查询功能',
            duration: 2000,
            details: {
              title: '溯源平台主页',
              mockData: {
                userName: '张先生',
                historyCount: 15,
                hotProducts: ['有机白菜', '散养鸡蛋', '纯牛奶']
              },
              actions: ['查看个人信息', '浏览热门产品', '点击溯源查询', '查看使用教程'],
              pageElements: ['用户头像', '查询历史', '扫码按钮', '热门推荐']
            }
          },
          {
            pageId: 'trace-query',
            name: '溯源查询',
            action: '扫描产品二维码或输入批次号查询',
            duration: 4000,
            details: {
              title: '产品溯源查询',
              mockData: {
                batchNumber: 'BF20250202001',
                productName: '有机白菜',
                scanResult: '扫描成功',
                queryStatus: '查询中...'
              },
              actions: ['点击扫码', '识别二维码', '确认产品', '发起查询', '等待结果'],
              pageElements: ['摄像头界面', '扫码框', '手动输入', '查询按钮', '进度指示器']
            }
          },
          {
            pageId: 'trace-detail',
            name: '查看详情',
            action: '查看完整的产品溯源信息链条',
            duration: 3000,
            details: {
              title: '完整溯源信息',
              mockData: {
                farmName: '绿野生态农场',
                harvestDate: '2024-12-20',
                qualityGrade: 'A级',
                testResults: '全部合格',
                certNumber: 'OFDC-2024-001'
              },
              actions: ['查看农场信息', '查看种植记录', '查看检测报告', '查看物流信息', '查看销售信息'],
              pageElements: ['溯源时间轴', '农场卡片', '检测数据', '物流轨迹', '证书预览']
            }
          },
          {
            pageId: 'trace-certificate',
            name: '溯源证书',
            action: '生成并下载官方溯源证书',
            duration: 2000,
            details: {
              title: '官方溯源证书',
              mockData: {
                certificateId: 'TC20250202-001',
                issueDate: '2025-02-02',
                qrCode: 'data:image/png;base64...',
                digitalSign: 'SHA256验证'
              },
              actions: ['生成证书', '添加数字签名', '保存到相册', '分享给朋友', '打印证书'],
              pageElements: ['证书预览', '下载按钮', '分享按钮', '打印选项', '有效期说明']
            }
          }
        ]
      },
      {
        id: 'farming-management-flow',
        name: '养殖管理流程',
        description: '农业养殖管理完整操作流程',
        icon: '🌾',
        totalTime: '约3分钟',
        targetUser: '农场主',
        steps: [
          {
            pageId: 'login',
            name: '管理登录',
            action: '农场管理员使用工号登录生产系统',
            duration: 2000,
            details: {
              title: '农场管理员工作站',
              mockData: {
                farmName: '绿野生态农场',
                manager: '王农场主',
                workerId: 'GY-001',
                shift: '早班 06:00-14:00'
              },
              actions: ['输入工号', '指纹识别', '选择班次', '确认权限'],
              pageElements: ['工号输入', '指纹扫描器', '班次选择', '权限确认']
            }
          },
          {
            pageId: 'farming-dashboard',
            name: '养殖概览',
            action: '查看农场今日整体生产状况',
            duration: 3000,
            details: {
              title: '农场实时监控中心',
              mockData: {
                totalArea: '1200亩',
                activeFields: 15,
                todayTasks: 8,
                weatherStatus: '适宜作业',
                alertCount: 2
              },
              actions: ['查看总体数据', '检查天气状况', '查看今日任务', '处理告警信息'],
              pageElements: ['数据大屏', '天气卡片', '任务列表', '告警面板', '地块分布图']
            }
          },
          {
            pageId: 'farming-monitor',
            name: '实时监控',
            action: '监控各地块的环境数据和作物状况',
            duration: 4000,
            details: {
              title: '地块环境监控',
              mockData: {
                fieldA1: { crop: '有机白菜', temp: '18°C', humidity: '68%', soilPH: 6.8 },
                fieldB2: { crop: '散养鸡舍', temp: '22°C', humidity: '55%', airQuality: '良好' },
                sensorStatus: '87个传感器在线'
              },
              actions: ['选择地块A1', '查看实时数据', '分析趋势图表', '设置告警阈值', '生成监控报告'],
              pageElements: ['地块选择器', '实时数据图表', '传感器状态', '告警设置', '数据导出']
            }
          },
          {
            pageId: 'farming-vaccine',
            name: '疫苗管理',
            action: '管理畜禽疫苗接种计划和记录',
            duration: 3000,
            details: {
              title: '疫苗接种管理',
              mockData: {
                animalCount: 1580,
                vaccinePlan: '春季免疫计划',
                completedRate: '89%',
                nextSchedule: '2025-02-05'
              },
              actions: ['查看接种计划', '记录接种情况', '更新动物档案', '安排下次接种', '生成接种证明'],
              pageElements: ['疫苗计划表', '动物档案', '接种记录', '证书生成', '提醒设置']
            }
          },
          {
            pageId: 'farming-breeding',
            name: '繁育记录',
            action: '记录动物繁育信息和后代管理',
            duration: 3000,
            details: {
              title: '繁育档案管理',
              mockData: {
                breedingPairs: 45,
                pregnantAnimals: 12,
                expectedBirths: '本月8只',
                geneticRecords: '完整族谱'
              },
              actions: ['查看繁育配对', '记录怀孕信息', '预测产期', '管理后代档案', '更新族谱信息'],
              pageElements: ['配对记录', '怀孕跟踪', '产期日历', '后代档案', '族谱图表']
            }
          }
        ]
      },
      {
        id: 'processing-quality-flow',
        name: '生产质检流程',
        description: '加工生产质量检测完整流程',
        icon: '🏭',
        totalTime: '约2.5分钟',
        targetUser: '质检员',
        steps: [
          {
            pageId: 'login',
            name: '质检登录',
            action: '质检员刷卡登录质检工作站',
            duration: 2000,
            details: {
              title: '质检工作站',
              mockData: {
                inspector: '李质检师',
                workstation: 'QC-001',
                shift: '早班',
                todayTasks: 12
              },
              actions: ['刷员工卡', '选择工作站', '确认班次', '查看任务'],
              pageElements: ['卡片读取器', '工作站选择', '班次确认', '任务列表']
            }
          },
          {
            pageId: 'processing-production',
            name: '生产管理',
            action: '查看各生产线运行状态和计划',
            duration: 3000,
            details: {
              title: '生产线监控',
              mockData: {
                line1: { product: '净菜包装', status: '运行', speed: '120包/分', efficiency: '96%' },
                line2: { product: '切片蔬菜', status: '维护', resume: '14:30' },
                todayOutput: '15.6吨'
              },
              actions: ['检查1号线状态', '查看生产效率', '确认2号线维护', '记录产量数据'],
              pageElements: ['生产线状态板', '效率图表', '维护计划', '产量统计', '质量目标']
            }
          },
          {
            pageId: 'processing-quality',
            name: '质量检测',
            action: '对生产产品进行全面质量检测',
            duration: 5000,
            details: {
              title: '产品质量检测',
              mockData: {
                batchNumber: 'BF20250202001',
                sampleCount: 30,
                testItems: ['外观', '重量', '微生物', '新鲜度', '包装'],
                passRate: '100%'
              },
              actions: ['抽取样品', '外观检查', '重量测试', '微生物检测', '记录结果', '生成报告'],
              pageElements: ['样品托盘', '检测设备', '数据录入', '结果显示', '报告打印']
            }
          },
          {
            pageId: 'processing-storage',
            name: '存储管理',
            action: '监控产品存储环境和库存状况',
            duration: 3000,
            details: {
              title: '冷链存储监控',
              mockData: {
                warehouse: 'A区冷库',
                temperature: '2-4°C',
                humidity: '85-90%',
                inventory: '15.6吨',
                shelfLife: '7天新鲜期'
              },
              actions: ['检查温湿度', '盘点库存', '检查保质期', '处理告警', '安排出库'],
              pageElements: ['温度监控', '湿度图表', '库存清单', '告警系统', '出库计划']
            }
          }
        ]
      },
      {
        id: 'admin-management-flow',
        name: '系统管理流程',
        description: '管理后台系统配置和用户管理',
        icon: '⚙️',
        totalTime: '约3分钟',
        targetUser: '系统管理员',
        steps: [
          {
            pageId: 'admin-login',
            name: '管理登录',
            action: '系统管理员双重认证登录',
            duration: 2000,
            details: {
              title: '超级管理员登录',
              mockData: {
                adminName: '张系统管理员',
                adminLevel: '超级管理员',
                lastLogin: '2025-02-01 18:20',
                ipAddress: '192.168.1.100'
              },
              actions: ['输入管理员账号', '输入密码', '手机验证码', '确认登录'],
              pageElements: ['账号输入', '密码输入', '验证码', '安全提示', '登录按钮']
            }
          },
          {
            pageId: 'admin-dashboard',
            name: '管理概览',
            action: '查看系统整体运行状态和关键指标',
            duration: 3000,
            details: {
              title: '系统运营仪表板',
              mockData: {
                totalUsers: 15680,
                activeUsers: 3456,
                todayQueries: 28945,
                systemUptime: '99.97%',
                alerts: 3
              },
              actions: ['查看用户统计', '监控查询量', '检查系统状态', '处理告警', '查看报表'],
              pageElements: ['用户统计卡', '查询量图表', '系统状态灯', '告警列表', '性能监控']
            }
          },
          {
            pageId: 'admin-users',
            name: '用户管理',
            action: '管理平台用户账户和权限',
            duration: 4000,
            details: {
              title: '用户账户管理',
              mockData: {
                pendingApprovals: 5,
                newUsers: 23,
                activeUsers: 15680,
                bannedUsers: 12
              },
              actions: ['审核新用户', '处理申请', '管理权限', '处理投诉', '生成报告'],
              pageElements: ['用户列表', '审核面板', '权限设置', '操作日志', '搜索过滤']
            }
          },
          {
            pageId: 'admin-roles-permissions',
            name: '权限配置',
            action: '配置不同角色的系统访问权限',
            duration: 3000,
            details: {
              title: '角色权限管理',
              mockData: {
                roles: ['超级管理员', '农场主', '质检员', '消费者'],
                permissions: 156,
                activeRoles: 4,
                customRoles: 2
              },
              actions: ['查看角色列表', '编辑权限', '创建新角色', '分配权限', '测试权限'],
              pageElements: ['角色树', '权限矩阵', '编辑器', '测试工具', '保存按钮']
            }
          },
          {
            pageId: 'admin-system-config',
            name: '系统配置',
            action: '调整系统运行参数和业务规则',
            duration: 2000,
            details: {
              title: '系统参数配置',
              mockData: {
                configItems: 45,
                lastUpdate: '2025-02-01',
                backupStatus: '正常',
                maintenanceWindow: '凌晨2-4点'
              },
              actions: ['查看配置项', '修改参数', '备份配置', '应用更改', '监控效果'],
              pageElements: ['配置树', '参数编辑器', '备份工具', '应用按钮', '监控面板']
            }
          }
        ]
      }
    ];

  // Flow模式流程控制函数 (移到组件级别)
  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);
  const handleReset = () => {
    setIsPlaying(false);
    setCurrentStep(0);
    setProgress(0);
  };
  const handleStepClick = (stepIndex: number) => {
    setCurrentStep(stepIndex);
    setProgress(0);
    setIsPlaying(false);
  };

  // Flow模式渲染
  const renderFlowMode = () => {

    return (
      <div className="flow-preview-mode h-full flex flex-col">
        {/* 增强的流程选择器 */}
        <div className="p-6 border-b bg-gradient-to-br from-gray-50 to-blue-50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">🎭 用户流程自动演示系统</h2>
              <p className="text-gray-600">选择一个用户角色，体验完整的业务流程演示</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {userFlows.map(flow => (
                <div
                  key={flow.id}
                  className={`group relative bg-white rounded-xl border-2 cursor-pointer transition-all hover:shadow-xl hover:scale-105 ${
                    selectedFlow?.id === flow.id
                      ? 'border-blue-500 shadow-xl ring-4 ring-blue-100'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                  onClick={() => {
                    setSelectedFlow(flow);
                    handleReset();
                  }}
                >
                  {/* 选中指示器 */}
                  {selectedFlow?.id === flow.id && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}

                  <div className="p-6">
                    {/* 图标和基本信息 */}
                    <div className="text-center mb-4">
                      <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center text-3xl transition-all ${
                        selectedFlow?.id === flow.id ? 'bg-blue-100' : 'bg-gray-100 group-hover:bg-blue-50'
                      }`}>
                        {flow.icon}
                      </div>
                      <h3 className="font-semibold text-gray-900 mt-3 mb-1">{flow.name}</h3>
                      <p className="text-sm text-gray-600 leading-relaxed">{flow.description}</p>
                    </div>

                    {/* 详细信息 */}
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">👤 目标用户:</span>
                        <span className="font-medium text-gray-700">{flow.targetUser}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">⏱️ 预计时长:</span>
                        <span className="font-medium text-gray-700">{flow.totalTime}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">📋 步骤数量:</span>
                        <span className="font-medium text-gray-700">{flow.steps.length} 个步骤</span>
                      </div>
                    </div>

                    {/* 步骤预览 */}
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <div className="text-xs text-gray-500 mb-2">主要步骤:</div>
                      <div className="space-y-1">
                        {flow.steps.slice(0, 3).map((step: any, index: number) => (
                          <div key={index} className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-600">
                              {index + 1}
                            </div>
                            <span className="text-xs text-gray-600 truncate">{step.name}</span>
                          </div>
                        ))}
                        {flow.steps.length > 3 && (
                          <div className="text-xs text-gray-500 text-center">
                            ... 还有 {flow.steps.length - 3} 个步骤
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 开始按钮 */}
                    <div className="mt-4">
                      <button className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                        selectedFlow?.id === flow.id
                          ? 'bg-blue-500 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 group-hover:bg-blue-100 group-hover:text-blue-700'
                      }`}>
                        {selectedFlow?.id === flow.id ? '当前选择' : '开始演示'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 演示说明 */}
            <div className="mt-6 bg-white rounded-lg border p-4">
              <div className="flex items-start gap-3">
                <div className="text-blue-500 mt-0.5">💡</div>
                <div>
                  <div className="font-medium text-gray-900">演示说明</div>
                  <div className="text-gray-600 text-sm mt-1">
                    每个流程都包含真实的业务场景、模拟数据和详细的操作步骤。演示会自动播放，
                    您也可以手动控制进度，点击任意步骤跳转到对应环节。
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {selectedFlow ? (
          <div className="flex-1 flex">
            {/* 流程控制面板 */}
            <aside className="w-80 bg-white border-r p-6 overflow-y-auto">
              <div className="mb-6">
                <h3 className="font-medium mb-4 flex items-center gap-2">
                  <span className="text-xl">{selectedFlow.icon}</span>
                  {selectedFlow.name}
                </h3>

                {/* 播放控制 */}
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={handlePlay}
                    disabled={isPlaying}
                    className="px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 flex items-center gap-1"
                  >
                    <span>▶</span> 播放
                  </button>
                  <button
                    onClick={handlePause}
                    disabled={!isPlaying}
                    className="px-3 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50 flex items-center gap-1"
                  >
                    <span>⏸</span> 暂停
                  </button>
                  <button
                    onClick={handleReset}
                    className="px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 flex items-center gap-1"
                  >
                    <span>⏹</span> 重置
                  </button>
                </div>

                {/* 当前步骤显示 */}
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                  <div className="font-medium text-blue-900">
                    步骤 {currentStep + 1}/{selectedFlow.steps.length}
                  </div>
                  <div className="text-blue-700">
                    {selectedFlow.steps[currentStep]?.name}
                  </div>
                  <div className="text-sm text-blue-600 mt-1">
                    {selectedFlow.steps[currentStep]?.action}
                  </div>

                  {/* 进度条 */}
                  <div className="mt-2">
                    <div className="w-full bg-blue-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 步骤列表 */}
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900 mb-3">流程步骤</h4>
                {selectedFlow.steps.map((step: any, index: number) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      index === currentStep
                        ? 'border-blue-500 bg-blue-50'
                        : index < currentStep
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleStepClick(index)}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                        index === currentStep
                          ? 'bg-blue-500 text-white'
                          : index < currentStep
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-300 text-gray-600'
                      }`}>
                        {index < currentStep ? '✓' : index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{step.name}</div>
                        <div className="text-xs text-gray-600">{step.action}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </aside>

            {/* 详细演示预览区域 */}
            <main className="flex-1 p-6 bg-gray-50 overflow-y-auto">
              <div className="max-w-4xl mx-auto">
                {/* 流程头部信息 */}
                <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-2xl">
                        {selectedFlow.icon}
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900">{selectedFlow.name}</h2>
                        <p className="text-gray-600 mt-1">{selectedFlow.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                          <span>👤 {selectedFlow.targetUser}</span>
                          <span>⏱️ {selectedFlow.totalTime}</span>
                          <span>📋 {selectedFlow.steps.length}个步骤</span>
                        </div>
                      </div>
                    </div>
                    <Badge variant={isPlaying ? "success" : "default"} className="ml-4">
                      {isPlaying ? "演示进行中" : "演示已暂停"}
            </Badge>
          </div>

                  {/* 整体进度条 */}
                  <div className="mt-4">
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>总体进度</span>
                      <span>{Math.round(((currentStep + progress/100) / selectedFlow.steps.length) * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${((currentStep + progress/100) / selectedFlow.steps.length) * 100}%` }}
                      />
                    </div>
        </div>
      </div>

                {/* 当前步骤详细展示 */}
                <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-semibold">
                          步骤 {currentStep + 1}: {selectedFlow.steps[currentStep]?.name}
                        </h3>
                        <p className="text-blue-100 mt-1">
                          {selectedFlow.steps[currentStep]?.details?.title}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-blue-100">当前操作</div>
                        <div className="font-medium">{selectedFlow.steps[currentStep]?.action}</div>
                      </div>
                    </div>

                    {/* 当前步骤进度条 */}
                    <div className="mt-4">
                      <div className="w-full bg-blue-400 rounded-full h-2">
                        <div
                          className="bg-white h-2 rounded-full transition-all duration-100"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-6">
                    {/* 模拟数据展示 */}
                    {selectedFlow.steps[currentStep]?.details?.mockData && (
                      <div className="mb-6">
                        <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                          <span>📊</span> 演示数据
                        </h4>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.entries(selectedFlow.steps[currentStep].details.mockData).map(([key, value]) => (
                              <div key={key} className="flex justify-between">
                                <span className="text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                                <span className="font-medium text-gray-900">
                                  {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                                </span>
                              </div>
        ))}
      </div>
                        </div>
                      </div>
                    )}

                    {/* 操作步骤展示 */}
                    {selectedFlow.steps[currentStep]?.details?.actions && (
                      <div className="mb-6">
                        <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                          <span>🎯</span> 操作步骤
                        </h4>
                        <div className="space-y-2">
                          {selectedFlow.steps[currentStep].details.actions.map((action: string, index: number) => (
                            <div
                              key={index}
                              className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                                progress > (index / selectedFlow.steps[currentStep].details.actions.length) * 100
                                  ? 'bg-green-50 border border-green-200'
                                  : 'bg-gray-50 border border-gray-200'
                              }`}
                            >
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                                progress > (index / selectedFlow.steps[currentStep].details.actions.length) * 100
                                  ? 'bg-green-500 text-white'
                                  : 'bg-gray-300 text-gray-600'
                              }`}>
                                {progress > (index / selectedFlow.steps[currentStep].details.actions.length) * 100 ? '✓' : index + 1}
                              </div>
                              <span className={
                                progress > (index / selectedFlow.steps[currentStep].details.actions.length) * 100
                                  ? 'text-green-800 font-medium'
                                  : 'text-gray-700'
                              }>
                                {action}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 页面元素展示 */}
                    {selectedFlow.steps[currentStep]?.details?.pageElements && (
                      <div className="mb-6">
                        <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                          <span>🖥️</span> 页面元素
                        </h4>
                        <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-6">
                          <div className="text-center mb-4">
                            <div className="text-4xl mb-2">📱</div>
                            <div className="text-sm text-gray-600">
                              {selectedFlow.steps[currentStep].details.title} - 页面布局模拟
                            </div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {selectedFlow.steps[currentStep].details.pageElements.map((element: string, index: number) => (
                              <div
                                key={index}
                                className={`p-3 rounded-lg text-center text-sm transition-all ${
                                  progress > (index / selectedFlow.steps[currentStep].details.pageElements.length) * 100
                                    ? 'bg-blue-100 border border-blue-300 text-blue-800'
                                    : 'bg-gray-100 border border-gray-300 text-gray-600'
                                }`}
                              >
                                {element}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 提示信息 */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <div className="text-blue-500 mt-0.5">💡</div>
                        <div>
                          <div className="font-medium text-blue-900">演示说明</div>
                          <div className="text-blue-700 text-sm mt-1">
                            这是一个模拟演示，展示了 <strong>{selectedFlow.targetUser}</strong> 在实际使用
                            <strong>{selectedFlow.steps[currentStep]?.details?.title}</strong> 时的完整操作流程。
                            演示包含真实的业务数据和用户交互场景。
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </main>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center p-8">
            <div>
              <div className="text-6xl mb-4">🎭</div>
              <h3 className="text-xl font-medium text-gray-900 mb-2">
                选择用户流程
              </h3>
              <p className="text-gray-600">
                请从上方选择一个用户流程开始自动演示
              </p>
            </div>
        </div>
      )}
    </div>
  );
  };

    // 构建页面层级结构
  const buildPageHierarchy = () => {
    const hierarchy: any = {
      root: {
        title: '食品溯源系统',
        level: 0,
        children: [],
        pages: []
      }
    };

    // 按模块分组
    const moduleGroups = actualPages.reduce((groups, page) => {
      if (!groups[page.module]) {
        groups[page.module] = [];
      }
      groups[page.module].push(page);
      return groups;
    }, {} as Record<string, PageItem[]>);

    // 为每个模块创建层级节点
    Object.entries(moduleGroups).forEach(([module, pages]) => {
      hierarchy[module] = {
        title: module,
        level: 1,
        parent: 'root',
        children: [],
        pages: pages
      };
      hierarchy.root.children.push(module);

      // 为复杂页面创建子层级
      pages.forEach(page => {
        if (page.complexity === 'advanced' || page.complexity === 'complex') {
          const nodeId = `${module}-${page.id}`;
          hierarchy[nodeId] = {
            title: page.title,
            level: 2,
            parent: module,
            children: [],
            pages: [page]
          };
          hierarchy[module].children.push(nodeId);
        }
      });
    });

    return hierarchy;
  };

  const pageHierarchy = buildPageHierarchy();

  const renderHierarchyMode = () => {
    const handleToggleHierarchy = (nodeId: string) => {
      const newExpanded = new Set(expandedHierarchy);
      if (newExpanded.has(nodeId)) {
        newExpanded.delete(nodeId);
      } else {
        newExpanded.add(nodeId);
      }
      setExpandedHierarchy(newExpanded);
    };

    const renderHierarchyNode = (nodeId: string, level: number = 0) => {
      const node = pageHierarchy[nodeId];
      if (!node) return null;

      const isExpanded = expandedHierarchy.has(nodeId);
      const isSelected = selectedHierarchyNode === nodeId;
      const hasChildren = node.children && node.children.length > 0;

      return (
        <div key={nodeId} className={`ml-${level * 4}`}>
          <div
            className={`flex items-center p-2 rounded-lg cursor-pointer transition-all hover:bg-gray-100 ${
              isSelected ? 'bg-blue-50 border border-blue-200' : ''
            }`}
            onClick={() => setSelectedHierarchyNode(nodeId)}
          >
            {hasChildren && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleHierarchy(nodeId);
                }}
                className="mr-2 p-1 hover:bg-gray-200 rounded"
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            )}

            <div className="flex items-center">
              {getModuleIcon(node.title)}
              <span className="ml-2 font-medium">{node.title}</span>
              {node.pages && (
                <Badge variant="default" className="ml-2">
                  {node.pages.length}
                </Badge>
              )}
            </div>
          </div>

          {isExpanded && hasChildren && (
            <div className="ml-4">
              {node.children.map((childId: string) => renderHierarchyNode(childId, level + 1))}
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="flex h-screen">
        {/* 层级树 */}
        <aside className="w-96 bg-white border-r overflow-y-auto p-4">
          <h2 className="text-lg font-medium mb-4 flex items-center">
            <TreePine className="w-5 h-5 mr-2" />
            页面层级结构
          </h2>
          <div className="space-y-1">
            {renderHierarchyNode('root')}
          </div>
        </aside>

        {/* 主预览区域 */}
        <main className="flex-1 flex flex-col">
          {selectedHierarchyNode && pageHierarchy[selectedHierarchyNode] && (
            <>
              <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium">{pageHierarchy[selectedHierarchyNode].title}</h3>
                    <p className="text-sm text-gray-600">
                      {pageHierarchy[selectedHierarchyNode].pages?.length || 0} 个页面
                    </p>
                  </div>
                  <Badge variant="default">
                    Level {pageHierarchy[selectedHierarchyNode].level}
                  </Badge>
                </div>
              </div>

              <div className="flex-1 p-4 overflow-y-auto">
                {pageHierarchy[selectedHierarchyNode].pages && pageHierarchy[selectedHierarchyNode].pages.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {pageHierarchy[selectedHierarchyNode].pages.map((page: PageItem) => (
                      <PagePreviewCard key={page.id} page={page} />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                    <TreePine className="w-12 h-12 mb-4 opacity-50" />
                    <p>这个节点包含子模块，请展开查看详细页面</p>
                  </div>
                )}
              </div>
            </>
          )}

          {!selectedHierarchyNode && (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
              <TreePine className="w-16 h-16 mb-4 opacity-50" />
              <h3 className="text-xl font-medium mb-2">层级结构预览</h3>
              <p className="text-center max-w-md">
                选择左侧的节点来查看页面层级关系和详细信息
              </p>
            </div>
          )}
        </main>
      </div>
    );
  };

  const renderSitemapMode = () => {
    // 构建站点连接关系
    const buildSiteConnections = () => {
      const connections: any[] = [];

      // 核心系统到各模块的连接
      const modules = ['养殖模块', '加工模块', '物流模块', '销售管理', '用户管理', '系统管理'];
      modules.forEach(module => {
        connections.push({
          id: `core-${module}`,
          from: '核心系统',
          to: module,
          type: 'primary',
          strength: 'strong'
        });
      });

      // 业务流程连接 (养殖 → 加工 → 物流 → 销售)
      const businessFlow = ['养殖模块', '加工模块', '物流模块', '销售管理'];
      for (let i = 0; i < businessFlow.length - 1; i++) {
        connections.push({
          id: `flow-${i}`,
          from: businessFlow[i],
          to: businessFlow[i + 1],
          type: 'business',
          strength: 'strong'
        });
      }

      // 支撑系统连接
      ['用户管理', '系统管理'].forEach(support => {
        modules.slice(0, 4).forEach(business => {
          connections.push({
            id: `support-${support}-${business}`,
            from: support,
            to: business,
            type: 'support',
            strength: 'weak'
          });
        });
      });

      return connections;
    };

    const connections = buildSiteConnections();

    const renderGraphView = () => (
      <div className="relative w-full h-full bg-gradient-to-br from-blue-50 to-indigo-100 overflow-hidden">
        {/* 中心节点 - 核心系统 */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="w-32 h-32 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
            核心系统
          </div>
        </div>

        {/* 业务模块节点 */}
        {[
          { name: '养殖模块', pos: 'top-20 left-1/4', color: 'from-green-500 to-green-600' },
          { name: '加工模块', pos: 'top-20 right-1/4', color: 'from-orange-500 to-orange-600' },
          { name: '物流模块', pos: 'bottom-20 left-1/4', color: 'from-purple-500 to-purple-600' },
          { name: '销售管理', pos: 'bottom-20 right-1/4', color: 'from-red-500 to-red-600' },
          { name: '用户管理', pos: 'top-1/2 left-8', color: 'from-teal-500 to-teal-600' },
          { name: '系统管理', pos: 'top-1/2 right-8', color: 'from-gray-500 to-gray-600' }
        ].map((module) => (
          <div key={module.name} className={`absolute ${module.pos} transform -translate-x-1/2 -translate-y-1/2`}>
            <div
              className={`w-24 h-24 bg-gradient-to-br ${module.color} rounded-full flex items-center justify-center text-white font-medium text-sm shadow-lg cursor-pointer hover:scale-110 transition-transform`}
              onClick={() => setSelectedConnection(module.name)}
            >
              {module.name}
            </div>
          </div>
        ))}

        {/* 连接线 */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {/* 核心连接线 */}
          <line x1="50%" y1="50%" x2="25%" y2="20%" stroke="#3b82f6" strokeWidth="3" strokeDasharray="5,5" opacity="0.6" />
          <line x1="50%" y1="50%" x2="75%" y2="20%" stroke="#3b82f6" strokeWidth="3" strokeDasharray="5,5" opacity="0.6" />
          <line x1="50%" y1="50%" x2="25%" y2="80%" stroke="#3b82f6" strokeWidth="3" strokeDasharray="5,5" opacity="0.6" />
          <line x1="50%" y1="50%" x2="75%" y2="80%" stroke="#3b82f6" strokeWidth="3" strokeDasharray="5,5" opacity="0.6" />
          <line x1="50%" y1="50%" x2="8%" y2="50%" stroke="#3b82f6" strokeWidth="2" strokeDasharray="10,5" opacity="0.4" />
          <line x1="50%" y1="50%" x2="92%" y2="50%" stroke="#3b82f6" strokeWidth="2" strokeDasharray="10,5" opacity="0.4" />

          {/* 业务流程线 */}
          <path d="M 25% 20% Q 50% 10% 75% 20%" stroke="#10b981" strokeWidth="4" fill="none" opacity="0.7" />
          <path d="M 75% 20% Q 90% 50% 75% 80%" stroke="#10b981" strokeWidth="4" fill="none" opacity="0.7" />
          <path d="M 75% 80% Q 50% 90% 25% 80%" stroke="#10b981" strokeWidth="4" fill="none" opacity="0.7" />
        </svg>

        {/* 统计信息 */}
        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-4 shadow-lg">
          <h4 className="font-semibold mb-2">站点地图统计</h4>
          <div className="space-y-1 text-sm">
            <div>总页面: {actualPages.length}</div>
            <div>业务模块: 6个</div>
            <div>核心连接: {connections.filter(c => c.type === 'primary').length}</div>
            <div>业务流程: {connections.filter(c => c.type === 'business').length}</div>
          </div>
        </div>

        {/* 图例 */}
        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg p-4 shadow-lg">
          <h4 className="font-semibold mb-2">连接类型</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center">
              <div className="w-4 h-0.5 bg-blue-500 mr-2"></div>
              <span>核心连接</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-0.5 bg-green-500 mr-2"></div>
              <span>业务流程</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-0.5 bg-gray-400 mr-2 opacity-60"></div>
              <span>支撑连接</span>
            </div>
          </div>
        </div>
      </div>
    );

    const renderTreeView = () => (
      <div className="p-6 h-full overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full text-white font-bold text-lg shadow-lg mb-4">
              核心
            </div>
            <h3 className="text-xl font-semibold">食品溯源系统</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(
              actualPages.reduce((groups, page) => {
                if (!groups[page.module]) groups[page.module] = [];
                groups[page.module].push(page);
                return groups;
              }, {} as Record<string, PageItem[]>)
            ).map(([module, pages]) => (
              <div key={module} className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <div className="flex items-center">
                    {getModuleIcon(module)}
                    <h4 className="ml-2 font-semibold">{module}</h4>
                    <Badge variant="default" className="ml-auto">
                      {pages.length}
                    </Badge>
                  </div>
                </div>
                <div className="p-4">
                  <div className="space-y-2">
                    {pages.slice(0, 5).map(page => (
                      <div key={page.id} className="flex items-center text-sm">
                        <div className="w-2 h-2 bg-gray-300 rounded-full mr-2"></div>
                        <span className="flex-1 truncate">{page.title}</span>
                                                <Badge
                          variant="default"
                          className={`text-xs ${getComplexityColor(page.complexity)}`}
                        >
                          {page.complexity}
                        </Badge>
                      </div>
                    ))}
                    {pages.length > 5 && (
                      <div className="text-xs text-gray-500 text-center pt-2">
                        还有 {pages.length - 5} 个页面...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );

    const renderMatrixView = () => {
      const modules = Object.keys(
        actualPages.reduce((groups, page) => {
          if (!groups[page.module]) groups[page.module] = [];
          groups[page.module].push(page);
          return groups;
        }, {} as Record<string, PageItem[]>)
      );

      return (
        <div className="p-6 h-full overflow-auto">
          <div className="max-w-6xl mx-auto">
            <h3 className="text-xl font-semibold mb-6 text-center">模块关系矩阵</h3>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="w-32 p-3 text-left font-medium text-gray-900">模块</th>
                    {modules.map(module => (
                      <th key={module} className="p-3 text-center font-medium text-gray-900 min-w-24">
                        <div className="transform -rotate-45 text-xs">
                          {module.replace('模块', '').replace('管理', '')}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {modules.map(rowModule => (
                    <tr key={rowModule} className="border-t border-gray-200">
                      <td className="p-3 font-medium text-gray-900 bg-gray-50">
                        <div className="flex items-center">
                          {getModuleIcon(rowModule)}
                          <span className="ml-2 text-sm">{rowModule}</span>
                        </div>
                      </td>
                      {modules.map(colModule => {
                        const hasConnection = connections.some(
                          conn => (conn.from === rowModule && conn.to === colModule) ||
                                  (conn.to === rowModule && conn.from === colModule)
                        );
                        const isSelf = rowModule === colModule;

                        return (
                          <td
                            key={colModule}
                            className={`p-3 text-center cursor-pointer hover:bg-gray-100 transition-colors ${
                              isSelf ? 'bg-blue-50' : hasConnection ? 'bg-green-50' : ''
                            }`}
                            onClick={() => setSelectedConnection(`${rowModule}-${colModule}`)}
                          >
                            {isSelf ? (
                              <div className="w-6 h-6 bg-blue-500 rounded-full mx-auto"></div>
                            ) : hasConnection ? (
                              <div className="w-4 h-4 bg-green-500 rounded-full mx-auto"></div>
                            ) : (
                              <div className="w-2 h-2 bg-gray-300 rounded-full mx-auto"></div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex justify-center">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h4 className="font-semibold mb-3">图例</h4>
                <div className="flex items-center space-x-6 text-sm">
                  <div className="flex items-center">
                    <div className="w-6 h-6 bg-blue-500 rounded-full mr-2"></div>
                    <span>同一模块</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-4 h-4 bg-green-500 rounded-full mr-2"></div>
                    <span>有业务关联</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-gray-300 rounded-full mr-2"></div>
                    <span>无直接关联</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className="flex flex-col h-screen">
        {/* 工具栏 */}
        <div className="p-4 border-b flex justify-between items-center bg-white">
          <h2 className="text-xl font-medium flex items-center">
            <Map className="w-5 h-5 mr-2" />
            站点地图
          </h2>

          <div className="flex items-center gap-4">
            <div className="flex bg-gray-100 rounded-lg p-1">
              {[
                { mode: 'graph', label: '关系图', icon: '🌐' },
                { mode: 'tree', label: '树形图', icon: '🌳' },
                { mode: 'matrix', label: '矩阵图', icon: '📊' }
              ].map(({ mode, label, icon }) => (
                <button
                  key={mode}
                  onClick={() => setSitemapViewMode(mode as any)}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    sitemapViewMode === mode
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <span className="mr-1">{icon}</span>
                  {label}
                </button>
              ))}
            </div>

            <Button variant="secondary" size="small">
              <ExternalLink className="w-4 h-4 mr-2" />
              导出图像
            </Button>
          </div>
        </div>

        {/* 地图视图 */}
        <div className="flex-1 relative overflow-hidden">
          {sitemapViewMode === 'graph' && renderGraphView()}
          {sitemapViewMode === 'tree' && renderTreeView()}
          {sitemapViewMode === 'matrix' && renderMatrixView()}

          {/* 详情面板 */}
          {selectedConnection && (
            <div className="absolute right-4 top-4 w-80 bg-white/95 backdrop-blur-sm rounded-lg p-4 shadow-lg border border-gray-200">
              <div className="flex justify-between items-start mb-3">
                <h4 className="font-semibold">连接详情</h4>
                <button
                  onClick={() => setSelectedConnection(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-2 text-sm">
                <div><strong>选中节点:</strong> {selectedConnection}</div>
                <div><strong>相关页面:</strong> {
                  actualPages.filter(p => p.module === selectedConnection).length
                }</div>
                <div><strong>复杂度分布:</strong></div>
                <div className="ml-4 space-y-1">
                  {['simple', 'complex', 'advanced'].map(complexity => {
                    const count = actualPages.filter(p =>
                      p.module === selectedConnection && p.complexity === complexity
                    ).length;
                    return count > 0 ? (
                      <div key={complexity} className="flex justify-between">
                        <span className="capitalize">{complexity}:</span>
                        <span>{count}</span>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderOtherModes = () => {
    if (previewMode === 'flow') {
      return renderFlowMode();
    } else if (previewMode === 'hierarchy') {
      return renderHierarchyMode();
    } else if (previewMode === 'sitemap') {
      return renderSitemapMode();
    }

    return (
      <div className="text-center py-20">
        <div className="text-6xl mb-4">🚧</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {previewModes.find(m => m.id === previewMode)?.name}
        </h3>
        <p className="text-gray-600 mb-4">
          此模式正在开发中，即将上线
        </p>
        <Badge variant="default">开发进行中</Badge>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 头部 */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                现代化预览系统
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                TASK-P3-024 - 基于100个真实页面的预览系统
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="primary">Stage 4 进行中</Badge>
              <Badge variant="success">Grid模式已完成</Badge>
              <Badge variant="success">Navigation模式已完成</Badge>
              <Badge variant="success">Flow模式已完成</Badge>
            </div>
          </div>
        </div>
      </header>

      {/* 主体内容 - 完全响应式，充分利用屏幕宽度 */}
      <div className="w-full max-w-none mx-auto px-6 py-8">
        {/* 模式切换器 */}
        <div className="mb-8">
          <div className="flex gap-4 overflow-x-auto pb-4">
            {previewModes.map(mode => {
              const IconComponent = mode.icon;
              return (
                <Button
                  key={mode.id}
                  variant={previewMode === mode.id ? 'primary' : 'ghost'}
                  onClick={() => setPreviewMode(mode.id)}
                  className="flex items-center gap-2 whitespace-nowrap"
                >
                  <IconComponent className="w-5 h-5" />
                  <div className="text-left">
                    <div className="font-medium">{mode.name}</div>
                    <div className="text-xs opacity-75">{mode.description}</div>
                  </div>
                </Button>
              );
            })}
          </div>
        </div>

        {/* 内容区域 */}
        {previewMode === 'grid' ? renderGridMode() : previewMode === 'navigation' ? renderNavigationMode() : renderOtherModes()}
      </div>
    </div>
  );
}
