# TASK-RN-012: 员工录入系统 - 数据管理

> React Native Android开发 - Phase 2 Week 1
>
> 任务编号: TASK-RN-012
> 工期: 1.5天 (12小时)
> 优先级: 高
> 状态: 待开始
> 依赖: TASK-RN-011

## 🎯 任务目标

实现员工录入系统的数据管理功能，包括离线存储、数据同步、冲突处理、历史记录管理和数据导出功能，确保数据安全和可靠性。

## 📋 具体工作内容

### 1. SQLite本地数据库设计 (4小时)

#### 数据库表结构
```sql
-- 员工录入记录主表
CREATE TABLE employee_inputs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  batch_code TEXT NOT NULL,
  input_type TEXT NOT NULL, -- 'material_receipt', 'production_record', etc.
  status TEXT DEFAULT 'draft', -- 'draft', 'completed', 'synced', 'conflict'
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  synced_at INTEGER,
  version INTEGER DEFAULT 1,
  is_deleted INTEGER DEFAULT 0
);

-- 原料接收数据表
CREATE TABLE material_receipts (
  id TEXT PRIMARY KEY,
  input_id TEXT NOT NULL,
  batch_code TEXT NOT NULL,
  supplier_name TEXT,
  material_type TEXT,
  quantity REAL,
  unit TEXT,
  received_date INTEGER,
  quality TEXT,
  temperature REAL,
  notes TEXT,
  photos TEXT, -- JSON array of photo paths
  FOREIGN KEY (input_id) REFERENCES employee_inputs (id)
);

-- 生产记录数据表
CREATE TABLE production_records (
  id TEXT PRIMARY KEY,
  input_id TEXT NOT NULL,
  production_line TEXT,
  start_time INTEGER,
  end_time INTEGER,
  temperature REAL,
  duration INTEGER,
  equipment_id TEXT,
  process_type TEXT,
  process_photos TEXT, -- JSON array
  FOREIGN KEY (input_id) REFERENCES employee_inputs (id)
);

-- 同步队列表
CREATE TABLE sync_queue (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  operation TEXT NOT NULL, -- 'create', 'update', 'delete'
  data TEXT, -- JSON data
  priority INTEGER DEFAULT 1,
  retry_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);
```

#### 数据库管理类
```typescript
// src/modules/processing/services/database.ts
import SQLite from 'react-native-sqlite-storage';

class ProcessingDatabase {
  private db: SQLite.SQLiteDatabase | null = null;

  async initialize(): Promise<void> {
    this.db = await SQLite.openDatabase({
      name: 'processing.db',
      location: 'default',
    });

    await this.createTables();
    await this.setupIndexes();
  }

  private async createTables(): Promise<void> {
    const tables = [
      `CREATE TABLE IF NOT EXISTS employee_inputs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        batch_code TEXT NOT NULL,
        input_type TEXT NOT NULL,
        status TEXT DEFAULT 'draft',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        synced_at INTEGER,
        version INTEGER DEFAULT 1,
        is_deleted INTEGER DEFAULT 0
      )`,
      // ... 其他表的创建语句
    ];

    for (const sql of tables) {
      await this.db!.executeSql(sql);
    }
  }

  // 插入员工录入记录
  async insertEmployeeInput(data: EmployeeInputData): Promise<string> {
    const id = generateUUID();
    const timestamp = Date.now();

    await this.db!.executeSql(
      `INSERT INTO employee_inputs 
       (id, user_id, batch_code, input_type, status, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, data.userId, data.batchCode, data.inputType, 'draft', timestamp, timestamp]
    );

    // 添加到同步队列
    await this.addToSyncQueue('employee_inputs', id, 'create', data);

    return id;
  }

  // 更新记录
  async updateEmployeeInput(id: string, data: Partial<EmployeeInputData>): Promise<void> {
    const timestamp = Date.now();
    
    await this.db!.executeSql(
      `UPDATE employee_inputs 
       SET updated_at = ?, version = version + 1 
       WHERE id = ?`,
      [timestamp, id]
    );

    await this.addToSyncQueue('employee_inputs', id, 'update', data);
  }

  // 查询记录
  async getEmployeeInputs(filter: InputFilter = {}): Promise<EmployeeInputData[]> {
    let sql = `SELECT * FROM employee_inputs WHERE is_deleted = 0`;
    const params: any[] = [];

    if (filter.status) {
      sql += ` AND status = ?`;
      params.push(filter.status);
    }

    if (filter.dateRange) {
      sql += ` AND created_at BETWEEN ? AND ?`;
      params.push(filter.dateRange.start, filter.dateRange.end);
    }

    sql += ` ORDER BY created_at DESC`;

    const [results] = await this.db!.executeSql(sql, params);
    return Array.from(results.rows.raw());
  }
}

export const processingDB = new ProcessingDatabase();
```

### 2. 数据同步机制 (4小时)

#### 同步管理器
```typescript
// src/modules/processing/services/syncManager.ts
import NetInfo from '@react-native-community/netinfo';
import { processingDB } from './database';
import { processingAPI } from './api';

class SyncManager {
  private isOnline = false;
  private syncInProgress = false;
  private syncQueue: SyncQueueItem[] = [];

  constructor() {
    this.initializeNetworkListener();
    this.startPeriodicSync();
  }

  private initializeNetworkListener(): void {
    NetInfo.addEventListener(state => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected ?? false;

      // 网络恢复时自动同步
      if (wasOffline && this.isOnline) {
        this.syncAllPendingData();
      }
    });
  }

  // 添加到同步队列
  async addToQueue(item: SyncQueueItem): Promise<void> {
    await processingDB.addToSyncQueue(
      item.tableName,
      item.recordId,
      item.operation,
      item.data
    );

    // 如果在线，立即尝试同步
    if (this.isOnline && !this.syncInProgress) {
      this.syncAllPendingData();
    }
  }

  // 同步所有待同步数据
  async syncAllPendingData(): Promise<void> {
    if (this.syncInProgress || !this.isOnline) {
      return;
    }

    this.syncInProgress = true;

    try {
      const queueItems = await processingDB.getSyncQueue();
      
      for (const item of queueItems) {
        try {
          await this.syncSingleItem(item);
          await processingDB.removeSyncQueueItem(item.id);
        } catch (error) {
          console.error(`同步失败: ${item.id}`, error);
          await processingDB.incrementRetryCount(item.id);
          
          // 重试次数过多的项目暂时跳过
          if (item.retryCount >= 3) {
            await this.handleSyncConflict(item, error);
          }
        }
      }
    } finally {
      this.syncInProgress = false;
    }
  }

  private async syncSingleItem(item: SyncQueueItem): Promise<void> {
    switch (item.operation) {
      case 'create':
        await processingAPI.createEmployeeInput(JSON.parse(item.data));
        break;
      case 'update':
        await processingAPI.updateEmployeeInput(item.recordId, JSON.parse(item.data));
        break;
      case 'delete':
        await processingAPI.deleteEmployeeInput(item.recordId);
        break;
    }

    // 更新本地记录为已同步状态
    await processingDB.markAsSynced(item.recordId);
  }

  // 处理同步冲突
  private async handleSyncConflict(item: SyncQueueItem, error: any): Promise<void> {
    // 获取服务器端的最新数据
    const serverData = await processingAPI.getEmployeeInput(item.recordId);
    const localData = await processingDB.getEmployeeInput(item.recordId);

    // 标记为冲突状态
    await processingDB.markAsConflict(item.recordId, {
      serverData,
      localData,
      conflictReason: error.message
    });

    // 通知用户处理冲突
    this.notifyConflict(item.recordId);
  }
}

export const syncManager = new SyncManager();
```

### 3. 冲突处理机制 (2小时)

#### 冲突解决界面
```typescript
// src/modules/processing/components/ConflictResolver.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface ConflictResolverProps {
  localData: EmployeeInputData;
  serverData: EmployeeInputData;
  onResolve: (resolution: ConflictResolution) => void;
}

export function ConflictResolver({ localData, serverData, onResolve }: ConflictResolverProps) {
  const [selectedResolution, setSelectedResolution] = useState<'local' | 'server' | 'merge'>('local');

  const handleResolve = () => {
    const resolution: ConflictResolution = {
      strategy: selectedResolution,
      finalData: selectedResolution === 'local' ? localData : 
                 selectedResolution === 'server' ? serverData :
                 mergeData(localData, serverData)
    };

    onResolve(resolution);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>数据冲突</Text>
      <Text style={styles.description}>
        本地数据与服务器数据存在冲突，请选择解决方案：
      </Text>

      <View style={styles.optionContainer}>
        <TouchableOpacity
          style={[styles.option, selectedResolution === 'local' && styles.selectedOption]}
          onPress={() => setSelectedResolution('local')}
        >
          <Text style={styles.optionTitle}>使用本地数据</Text>
          <Text style={styles.optionDescription}>保留本地修改，覆盖服务器数据</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.option, selectedResolution === 'server' && styles.selectedOption]}
          onPress={() => setSelectedResolution('server')}
        >
          <Text style={styles.optionTitle}>使用服务器数据</Text>
          <Text style={styles.optionDescription}>丢弃本地修改，使用服务器数据</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.option, selectedResolution === 'merge' && styles.selectedOption]}
          onPress={() => setSelectedResolution('merge')}
        >
          <Text style={styles.optionTitle}>合并数据</Text>
          <Text style={styles.optionDescription}>智能合并两端数据</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.resolveButton} onPress={handleResolve}>
        <Text style={styles.resolveButtonText}>解决冲突</Text>
      </TouchableOpacity>
    </View>
  );
}
```

### 4. 历史记录管理 (1.5小时)

#### 历史记录查看器
```typescript
// src/modules/processing/components/HistoryViewer.tsx
export function HistoryViewer() {
  const [inputs, setInputs] = useState<EmployeeInputData[]>([]);
  const [filter, setFilter] = useState<InputFilter>({});

  const loadHistory = async () => {
    const data = await processingDB.getEmployeeInputs(filter);
    setInputs(data);
  };

  const handleEdit = async (input: EmployeeInputData) => {
    // 只允许编辑未同步的记录
    if (input.status === 'synced') {
      Alert.alert('提示', '已同步的记录无法编辑');
      return;
    }

    // 导航到编辑页面
    navigation.navigate('EmployeeInput', { 
      mode: 'edit', 
      inputId: input.id 
    });
  };

  return (
    <View style={styles.container}>
      <FilterBar filter={filter} onFilterChange={setFilter} />
      
      <FlatList
        data={inputs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <HistoryItem 
            input={item}
            onEdit={() => handleEdit(item)}
            onViewDetails={() => viewDetails(item)}
          />
        )}
      />
    </View>
  );
}
```

### 5. 数据导出功能 (0.5小时)

#### 导出管理器
```typescript
// src/modules/processing/services/exportManager.ts
import RNFS from 'react-native-fs';
import Share from 'react-native-share';

class ExportManager {
  async exportToCSV(inputs: EmployeeInputData[]): Promise<void> {
    const csvContent = this.generateCSV(inputs);
    const filePath = `${RNFS.DocumentDirectoryPath}/employee_inputs_${Date.now()}.csv`;
    
    await RNFS.writeFile(filePath, csvContent, 'utf8');
    
    await Share.open({
      url: `file://${filePath}`,
      type: 'text/csv',
      title: '导出员工录入数据'
    });
  }

  private generateCSV(inputs: EmployeeInputData[]): string {
    const headers = ['批次编号', '录入类型', '录入时间', '状态', '备注'];
    const rows = inputs.map(input => [
      input.batchCode,
      input.inputType,
      new Date(input.createdAt).toLocaleString(),
      input.status,
      input.notes || ''
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
}

export const exportManager = new ExportManager();
```

## ✅ 验收标准

### 功能验收
- [ ] **离线存储**: 数据可以在离线状态下正常保存
- [ ] **自动同步**: 网络恢复后自动同步本地数据
- [ ] **冲突处理**: 数据冲突时提供解决选项
- [ ] **历史记录**: 可以查看和管理历史录入记录
- [ ] **数据导出**: 支持CSV格式导出

### 性能验收
- [ ] **数据库性能**: 大量数据下查询响应时间 < 1秒
- [ ] **同步效率**: 批量同步数据不会阻塞UI
- [ ] **存储优化**: 本地存储空间占用合理
- [ ] **内存管理**: 长时间使用不会出现内存泄漏

### 可靠性验收
- [ ] **数据完整性**: 数据同步过程中不会丢失
- [ ] **错误恢复**: 同步失败后可以重试
- [ ] **版本控制**: 支持数据版本管理
- [ ] **备份恢复**: 关键数据有备份机制

## 🔗 依赖关系

### 输入依赖
- TASK-RN-011 员工录入表单完成
- 网络状态监听组件
- 本地存储权限

### 输出交付
- 完整的数据管理系统
- 可靠的同步机制
- 用户友好的冲突处理
- 历史记录管理功能

---

**任务负责人**: [待分配]
**预估开始时间**: TASK-RN-011完成后
**预估完成时间**: 1.5个工作日后

*本任务完成后，员工录入系统将具备完整的数据管理能力，确保数据安全和可靠性。*