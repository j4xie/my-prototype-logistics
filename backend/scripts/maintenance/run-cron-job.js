#!/usr/bin/env node

/**
 * 手动执行定时任务脚本
 * 用于测试和手动触发定时任务
 * 
 * 使用方法:
 * node scripts/run-cron-job.js [任务名称]
 * 
 * 可用的任务:
 * - cleanup-whitelists : 清理过期白名单
 * - cleanup-sessions   : 清理过期会话
 * - update-factory     : 更新工厂活跃状态
 * - weekly-report      : 生成周报
 */

import { PrismaClient } from '@prisma/client';
import {
  cleanupExpiredWhitelists,
  cleanupExpiredSessions,
  updateFactoryActiveStatus,
  generateWeeklyReport
} from '../src/services/cronJobs.js';

const prisma = new PrismaClient();

const taskName = process.argv[2];

const tasks = {
  'cleanup-whitelists': {
    name: '清理过期白名单',
    handler: cleanupExpiredWhitelists
  },
  'cleanup-sessions': {
    name: '清理过期会话',
    handler: cleanupExpiredSessions
  },
  'update-factory': {
    name: '更新工厂活跃状态',
    handler: updateFactoryActiveStatus
  },
  'weekly-report': {
    name: '生成周报',
    handler: generateWeeklyReport
  }
};

const showUsage = () => {
  console.log('\n使用方法:');
  console.log('  node scripts/run-cron-job.js [任务名称]\n');
  console.log('可用的任务:');
  Object.entries(tasks).forEach(([key, task]) => {
    console.log(`  ${key.padEnd(20)} : ${task.name}`);
  });
  console.log('');
};

const runTask = async () => {
  if (!taskName) {
    console.error('❌ 错误: 请指定要执行的任务名称');
    showUsage();
    process.exit(1);
  }

  const task = tasks[taskName];
  if (!task) {
    console.error(`❌ 错误: 未知的任务名称 "${taskName}"`);
    showUsage();
    process.exit(1);
  }

  console.log(`\n🚀 开始执行任务: ${task.name}`);
  console.log('⏰ 开始时间:', new Date().toLocaleString('zh-CN'));
  console.log('');

  try {
    await task.handler();
    console.log('\n✅ 任务执行成功');
    console.log('⏰ 结束时间:', new Date().toLocaleString('zh-CN'));
  } catch (error) {
    console.error('\n❌ 任务执行失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

// 显示当前白名单统计信息
const showWhitelistStats = async () => {
  const stats = await prisma.userWhitelist.groupBy({
    by: ['status'],
    _count: {
      id: true
    }
  });

  const expiredCount = await prisma.userWhitelist.count({
    where: {
      status: 'PENDING',
      expiresAt: {
        lt: new Date()
      }
    }
  });

  console.log('\n📊 当前白名单统计:');
  stats.forEach(stat => {
    console.log(`   ${stat.status}: ${stat._count.id} 条`);
  });
  console.log(`   待过期: ${expiredCount} 条`);
  console.log('');
};

// 主函数
const main = async () => {
  // 如果是清理白名单任务，先显示统计信息
  if (taskName === 'cleanup-whitelists') {
    await showWhitelistStats();
  }

  await runTask();
};

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});