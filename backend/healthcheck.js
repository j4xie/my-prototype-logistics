#!/usr/bin/env node

/**
 * Docker健康检查脚本
 * 用于检查API服务是否正常运行
 */

import http from 'http';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function healthCheck() {
  const timeout = 3000; // 3秒超时
  
  try {
    console.log('开始健康检查...');
    
    // 1. 检查HTTP服务响应
    await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 3001,
        path: '/api/mobile/health',
        method: 'GET',
        timeout: timeout
      }, (res) => {
        if (res.statusCode === 200) {
          console.log('✓ HTTP服务响应正常');
          resolve();
        } else {
          reject(new Error(`HTTP服务响应异常: ${res.statusCode}`));
        }
      });
      
      req.on('error', reject);
      req.on('timeout', () => reject(new Error('HTTP请求超时')));
      req.end();
    });
    
    // 2. 检查数据库连接
    await prisma.$queryRaw`SELECT 1`;
    console.log('✓ 数据库连接正常');
    
    // 3. 检查关键表是否存在
    const tableCheck = await prisma.$queryRaw`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name IN ('factories', 'users', 'sessions')
    `;
    
    if (tableCheck[0].count >= 3) {
      console.log('✓ 数据库表结构正常');
    } else {
      throw new Error('数据库表结构不完整');
    }
    
    console.log('健康检查通过 ✓');
    process.exit(0);
    
  } catch (error) {
    console.error('健康检查失败 ✗', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 设置超时保护
setTimeout(() => {
  console.error('健康检查超时');
  process.exit(1);
}, 5000);

healthCheck();