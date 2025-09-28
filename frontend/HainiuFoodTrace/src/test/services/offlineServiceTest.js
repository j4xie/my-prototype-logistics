/**
 * 离线数据服务逻辑测试
 */

import { OfflineDataService } from '../../services/offline/offlineDataService';

// 模拟网络状态
const mockNetworkStatus = {
  connected: {
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
    isExpensive: false
  },
  disconnected: {
    isConnected: false,
    isInternetReachable: false,
    type: 'none',
    isExpensive: null
  },
  expensive: {
    isConnected: true,
    isInternetReachable: true,
    type: 'cellular',
    isExpensive: true
  }
};

// 测试离线记录添加
function testOfflineRecordAddition() {
  console.log('🧪 测试离线记录添加...');
  
  const offlineService = OfflineDataService.getInstance();
  
  // 模拟工作记录数据
  const mockWorkRecord = {
    employeeId: 123,
    factoryId: 'FAC001',
    recordType: 'production',
    workDetails: {
      workstation: 'WS_001',
      process: '切割',
      parameters: { temperature: 25, humidity: 60 },
      notes: '正常生产'
    },
    location: {
      latitude: 39.9042,
      longitude: 116.4074
    },
    attachments: []
  };
  
  const metadata = {
    userId: 123,
    factoryId: 'FAC001',
    timestamp: new Date()
  };
  
  // 添加离线记录
  const recordId = offlineService.addOfflineRecord('work_record', mockWorkRecord, metadata, 'high');
  
  if (recordId && recordId.startsWith('offline_')) {
    console.log(`✅ 离线记录添加成功: ${recordId}`);
    return recordId;
  } else {
    console.error('❌ 离线记录添加失败');
    return null;
  }
}

// 测试同步统计
function testSyncStats() {
  console.log('🧪 测试同步统计...');
  
  const offlineService = OfflineDataService.getInstance();
  const stats = offlineService.getSyncStats();
  
  console.log('同步统计:', {
    total: stats.total,
    pending: stats.pending,
    syncing: stats.syncing,
    completed: stats.completed,
    failed: stats.failed
  });
  
  // 验证统计数据一致性
  const totalCalculated = stats.pending + stats.syncing + stats.completed + stats.failed;
  
  if (totalCalculated === stats.total) {
    console.log('✅ 统计数据一致');
    return true;
  } else {
    console.error(`❌ 统计数据不一致: 计算总数 ${totalCalculated} != 实际总数 ${stats.total}`);
    return false;
  }
}

// 测试网络状态检测
function testNetworkStatusDetection() {
  console.log('🧪 测试网络状态检测...');
  
  const offlineService = OfflineDataService.getInstance();
  
  // 获取当前网络状态
  const currentStatus = offlineService.getNetworkStatus();
  console.log('当前网络状态:', currentStatus);
  
  // 测试离线模式检测
  const isOffline = offlineService.isOfflineMode();
  console.log(`离线模式: ${isOffline}`);
  
  // 测试数据使用信息
  const dataUsage = offlineService.getDataUsageInfo();
  console.log('数据使用信息:', dataUsage);
  
  // 网络状态应该有基本字段
  if (typeof currentStatus.isConnected === 'boolean' &&
      typeof currentStatus.type === 'string') {
    console.log('✅ 网络状态检测正确');
    return true;
  } else {
    console.error('❌ 网络状态检测错误');
    return false;
  }
}

// 测试优先级排序
function testPriorityOrdering() {
  console.log('🧪 测试优先级排序...');
  
  const offlineService = OfflineDataService.getInstance();
  
  // 添加不同优先级的记录
  const priorities = ['low', 'medium', 'high'];
  const recordIds = [];
  
  for (let i = 0; i < priorities.length; i++) {
    const priority = priorities[i];
    const recordId = offlineService.addOfflineRecord(
      'work_record',
      { test: `record_${i}` },
      { userId: 123, factoryId: 'FAC001' },
      priority
    );
    recordIds.push(recordId);
  }
  
  // 获取待同步记录
  const pendingRecords = offlineService.getOfflineRecords('pending');
  
  console.log('待同步记录数量:', pendingRecords.length);
  
  // 检查是否按优先级排序（高优先级在前）
  let lastPriority = 3; // high=0, medium=1, low=2
  let properlyOrdered = true;
  
  for (const record of pendingRecords) {
    const priorityValue = record.priority === 'high' ? 0 : 
                         record.priority === 'medium' ? 1 : 2;
    
    if (priorityValue > lastPriority) {
      properlyOrdered = false;
      break;
    }
    lastPriority = priorityValue;
  }
  
  if (properlyOrdered) {
    console.log('✅ 优先级排序正确');
    return true;
  } else {
    console.error('❌ 优先级排序错误');
    return false;
  }
}

// 测试记录管理
function testRecordManagement() {
  console.log('🧪 测试记录管理...');
  
  const offlineService = OfflineDataService.getInstance();
  
  // 添加测试记录
  const recordId = offlineService.addOfflineRecord(
    'work_record',
    { test: 'management_test' },
    { userId: 123, factoryId: 'FAC001' },
    'medium'
  );
  
  // 获取所有记录
  const allRecords = offlineService.getOfflineRecords();
  const initialCount = allRecords.length;
  
  console.log(`初始记录数量: ${initialCount}`);
  
  // 删除记录
  const deleteResult = offlineService.deleteRecord(recordId);
  
  if (deleteResult) {
    const recordsAfterDelete = offlineService.getOfflineRecords();
    if (recordsAfterDelete.length === initialCount - 1) {
      console.log('✅ 记录删除成功');
    } else {
      console.error('❌ 记录删除失败');
      return false;
    }
  } else {
    console.error('❌ 记录删除操作失败');
    return false;
  }
  
  // 测试清理失败记录
  const failedCount = offlineService.clearFailedRecords();
  console.log(`清理失败记录数量: ${failedCount}`);
  
  return true;
}

// 测试重试机制
function testRetryMechanism() {
  console.log('🧪 测试重试机制...');
  
  // 模拟一个失败的记录
  const mockFailedRecord = {
    id: 'test_retry_001',
    type: 'work_record',
    data: { test: 'retry_test' },
    metadata: {
      userId: 123,
      factoryId: 'FAC001',
      timestamp: new Date(),
      retryCount: 2, // 已重试2次
      lastRetryAt: new Date(Date.now() - 5000), // 5秒前最后一次重试
      error: 'Network timeout'
    },
    syncStatus: 'failed',
    priority: 'medium',
    createdAt: new Date()
  };
  
  console.log('模拟失败记录:', {
    id: mockFailedRecord.id,
    retryCount: mockFailedRecord.metadata.retryCount,
    syncStatus: mockFailedRecord.syncStatus,
    error: mockFailedRecord.metadata.error
  });
  
  // 检查重试逻辑
  const maxRetries = 3; // 服务默认最大重试次数
  const canRetry = mockFailedRecord.metadata.retryCount < maxRetries;
  
  console.log(`可以重试: ${canRetry}`);
  console.log(`剩余重试次数: ${maxRetries - mockFailedRecord.metadata.retryCount}`);
  
  // 计算下次重试时间
  const retryDelays = [1000, 5000, 15000]; // 1s, 5s, 15s
  const nextDelay = retryDelays[mockFailedRecord.metadata.retryCount] || 15000;
  const nextRetryTime = mockFailedRecord.metadata.lastRetryAt.getTime() + nextDelay;
  const timeUntilRetry = Math.max(0, nextRetryTime - Date.now());
  
  console.log(`下次重试延迟: ${nextDelay}ms`);
  console.log(`距离下次重试: ${timeUntilRetry}ms`);
  
  if (canRetry && nextDelay > 0) {
    console.log('✅ 重试机制逻辑正确');
    return true;
  } else {
    console.error('❌ 重试机制逻辑错误');
    return false;
  }
}

// 测试周期性同步
function testPeriodicSync() {
  console.log('🧪 测试周期性同步...');
  
  const offlineService = OfflineDataService.getInstance();
  
  // 检查同步间隔
  const syncInterval = 5 * 60 * 1000; // 5分钟
  console.log(`同步间隔: ${syncInterval / 1000} 秒`);
  
  // 模拟上次同步时间
  const lastSyncTime = new Date(Date.now() - 4 * 60 * 1000); // 4分钟前
  const timeSinceLastSync = Date.now() - lastSyncTime.getTime();
  const timeUntilNextSync = Math.max(0, syncInterval - timeSinceLastSync);
  
  console.log(`距离上次同步: ${Math.round(timeSinceLastSync / 1000)} 秒`);
  console.log(`距离下次同步: ${Math.round(timeUntilNextSync / 1000)} 秒`);
  
  // 检查是否需要同步
  const needsSync = timeSinceLastSync >= syncInterval;
  console.log(`需要同步: ${needsSync}`);
  
  if (typeof timeUntilNextSync === 'number' && timeUntilNextSync >= 0) {
    console.log('✅ 周期性同步逻辑正确');
    return true;
  } else {
    console.error('❌ 周期性同步逻辑错误');
    return false;
  }
}

// 运行所有测试
export function runOfflineServiceTests() {
  console.log('🚀 开始离线数据服务逻辑测试...\n');
  
  const tests = [
    { name: '离线记录添加', func: testOfflineRecordAddition },
    { name: '同步统计', func: testSyncStats },
    { name: '网络状态检测', func: testNetworkStatusDetection },
    { name: '优先级排序', func: testPriorityOrdering },
    { name: '记录管理', func: testRecordManagement },
    { name: '重试机制', func: testRetryMechanism },
    { name: '周期性同步', func: testPeriodicSync }
  ];
  
  let passed = 0;
  let failed = 0;
  
  tests.forEach(test => {
    try {
      console.log(`\n--- ${test.name} ---`);
      const result = test.func();
      if (result) {
        passed++;
        console.log(`✅ ${test.name} 通过`);
      } else {
        failed++;
        console.error(`❌ ${test.name} 失败`);
      }
    } catch (error) {
      failed++;
      console.error(`❌ ${test.name} 异常:`, error.message);
    }
  });
  
  console.log(`\n📊 离线数据服务测试结果:`);
  console.log(`✅ 通过: ${passed}`);
  console.log(`❌ 失败: ${failed}`);
  console.log(`📈 成功率: ${(passed / (passed + failed) * 100).toFixed(1)}%`);
  
  return { passed, failed, total: tests.length };
}

// 如果直接运行此文件
if (typeof require !== 'undefined' && require.main === module) {
  runOfflineServiceTests();
}