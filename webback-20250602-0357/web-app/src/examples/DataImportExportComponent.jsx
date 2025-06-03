import React, { useState, useEffect, useRef } from 'react';
import { MemoryMonitor, BatchProcessor, IndexedDBStreamProcessor } from '../storage/indexeddb-optimizer';

/**
 * 大数据量导入导出示例组件
 * 演示如何使用IndexedDB优化工具处理大量数据
 */
const DataImportExportComponent = () => {
  // 状态管理
  const [dbStatus, setDbStatus] = useState('未初始化');
  const [importStatus, setImportStatus] = useState({ state: 'idle', progress: 0 });
  const [exportStatus, setExportStatus] = useState({ state: 'idle', progress: 0 });
  const [memoryUsage, setMemoryUsage] = useState(null);
  const [recordCount, setRecordCount] = useState(0);
  const [testDataSize, setTestDataSize] = useState(10000);
  const [batchSize, setBatchSize] = useState(100);
  
  // 引用
  const dbRef = useRef(null);
  const abortControllerRef = useRef(null);
  
  // 常量
  const DB_NAME = 'data_test_db';
  const DB_VERSION = 1;
  const STORE_NAME = 'test_records';
  
  /**
   * 初始化数据库
   */
  const initializeDb = async () => {
    try {
      setDbStatus('正在初始化...');
      
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          
          // 检查对象仓库是否已存在，若不存在则创建
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            objectStore.createIndex('timestamp', 'timestamp', { unique: false });
            objectStore.createIndex('category', 'category', { unique: false });
            console.log('创建对象仓库:', STORE_NAME);
          }
        };
        
        request.onsuccess = (event) => {
          const db = event.target.result;
          dbRef.current = db;
          setDbStatus('已连接');
          countRecords(db);
          resolve(db);
        };
        
        request.onerror = (event) => {
          console.error('数据库错误:', event.target.error);
          setDbStatus('连接失败');
          reject(event.target.error);
        };
      });
    } catch (error) {
      console.error('初始化数据库出错:', error);
      setDbStatus('初始化失败');
      throw error;
    }
  };
  
  /**
   * 计算记录数量
   */
  const countRecords = (db = dbRef.current) => {
    if (!db) return;
    
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);
    const countRequest = objectStore.count();
    
    countRequest.onsuccess = () => {
      setRecordCount(countRequest.result);
    };
    
    countRequest.onerror = (event) => {
      console.error('计算记录数量出错:', event.target.error);
    };
  };
  
  /**
   * 生成测试数据
   */
  const generateTestData = (count) => {
    const categories = ['食品', '蔬菜', '肉类', '水果', '乳制品', '谷物', '饮料', '调味品'];
    const result = [];
    
    for (let i = 0; i < count; i++) {
      result.push({
        id: `record_${Date.now()}_${i}`,
        name: `测试数据 ${i}`,
        description: `这是一个测试数据项，用于评估系统在处理大量数据时的性能和内存使用情况。ID: ${i}`,
        value: Math.random() * 1000,
        timestamp: Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000),
        category: categories[Math.floor(Math.random() * categories.length)],
        isActive: Math.random() > 0.3,
        tags: Array.from({ length: Math.floor(Math.random() * 5) + 1 }, 
               (_, j) => `标签${j + 1}`),
        metadata: {
          createdBy: 'system',
          version: '1.0',
          revision: Math.floor(Math.random() * 10),
          notes: '这是用于测试的随机生成数据'
        }
      });
    }
    
    return result;
  };
  
  /**
   * 导入测试数据
   */
  const importTestData = async () => {
    if (!dbRef.current) {
      alert('请先初始化数据库');
      return;
    }
    
    try {
      setImportStatus({ state: 'running', progress: 0 });
      
      // 创建中止控制器
      abortControllerRef.current = new AbortController();
      
      // 生成测试数据 (分批生成以减少内存压力)
      const GENERATE_BATCH_SIZE = 1000;
      let processedCount = 0;
      
      for (let i = 0; i < testDataSize; i += GENERATE_BATCH_SIZE) {
        // 如果操作已被中止，退出循环
        if (abortControllerRef.current.signal.aborted) {
          setImportStatus({ state: 'aborted', progress: Math.round((processedCount / testDataSize) * 100) });
          return;
        }
        
        const currentBatchSize = Math.min(GENERATE_BATCH_SIZE, testDataSize - i);
        const testData = generateTestData(currentBatchSize);
        
        // 使用流式写入
        const stats = await IndexedDBStreamProcessor.streamWrite(
          dbRef.current,
          STORE_NAME,
          testData,
          {
            batchSize: batchSize,
            processingDelay: 10,
            abortSignal: abortControllerRef.current.signal,
            progressCallback: (progress) => {
              const overallProgress = Math.round(((i + progress.processed) / testDataSize) * 100);
              setImportStatus({ state: 'running', progress: overallProgress });
            },
            onError: (error, batch) => {
              console.error('导入数据批次时出错:', error);
            }
          }
        );
        
        processedCount += stats.success;
      }
      
      countRecords();
      setImportStatus({ state: 'completed', progress: 100 });
    } catch (error) {
      console.error('导入测试数据出错:', error);
      setImportStatus({ state: 'error', progress: 0 });
    }
  };
  
  /**
   * 导出数据
   */
  const exportData = async () => {
    if (!dbRef.current) {
      alert('请先初始化数据库');
      return;
    }
    
    try {
      setExportStatus({ state: 'running', progress: 0 });
      
      // 创建中止控制器
      abortControllerRef.current = new AbortController();
      
      // 使用内存监控
      MemoryMonitor.startMonitoring();
      
      let exportedData = [];
      
      // 使用流式读取，不一次性加载全部数据到内存
      await IndexedDBStreamProcessor.streamRead(
        dbRef.current,
        STORE_NAME,
        (item) => {
          // 这里可以进行数据转换或过滤
          // 在实际应用中，可以直接将数据写入文件或发送到服务器，而不是存储在内存中
          exportedData.push(item);
          
          // 每积累1000条数据，就清空一次，模拟数据发送并清理内存
          if (exportedData.length >= 1000) {
            const dataToSend = exportedData;
            exportedData = [];
            
            // 模拟发送数据
            // console.log(`导出数据批次: ${dataToSend.length}条`);
            
            // 在实际应用中，这里可以是：
            // await sendToServer(dataToSend);
            // 或
            // await appendToFile(dataToSend);
          }
          
          return Promise.resolve();
        },
        {
          batchSize: batchSize,
          abortSignal: abortControllerRef.current.signal,
          progressCallback: (stats) => {
            // 由于不知道总数，所以基于成功和失败的总和计算进度
            const total = recordCount || 1;
            const progress = Math.min(100, Math.round((stats.processed / total) * 100));
            setExportStatus({ state: 'running', progress });
          }
        }
      );
      
      // 处理最后剩余的数据
      if (exportedData.length > 0) {
        // 模拟发送最后一批数据
        // console.log(`导出最后一批数据: ${exportedData.length}条`);
        exportedData = [];
      }
      
      MemoryMonitor.stopMonitoring();
      setExportStatus({ state: 'completed', progress: 100 });
    } catch (error) {
      console.error('导出数据出错:', error);
      setExportStatus({ state: 'error', progress: 0 });
      MemoryMonitor.stopMonitoring();
    }
  };
  
  /**
   * 清空数据库
   */
  const clearDatabase = async () => {
    if (!dbRef.current) {
      alert('请先初始化数据库');
      return;
    }
    
    try {
      const transaction = dbRef.current.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      
      await new Promise((resolve, reject) => {
        const clearRequest = objectStore.clear();
        
        clearRequest.onsuccess = () => {
          resolve();
        };
        
        clearRequest.onerror = (event) => {
          reject(event.target.error);
        };
      });
      
      countRecords();
      alert('数据库已清空');
    } catch (error) {
      console.error('清空数据库出错:', error);
      alert('清空数据库失败: ' + error.message);
    }
  };
  
  /**
   * 中止当前操作
   */
  const abortOperation = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      alert('操作已中止');
    }
  };
  
  /**
   * 启动内存监控
   */
  useEffect(() => {
    // 初始化数据库
    initializeDb();
    
    // 启动内存监控
    const memoryCallback = (memoryInfo) => {
      setMemoryUsage(memoryInfo);
    };
    
    MemoryMonitor.onMemoryStatus('normal', memoryCallback);
    MemoryMonitor.onMemoryStatus('warning', memoryCallback);
    MemoryMonitor.onMemoryStatus('danger', memoryCallback);
    MemoryMonitor.startMonitoring();
    
    // 清理函数
    return () => {
      MemoryMonitor.stopMonitoring();
      MemoryMonitor.removeCallback('normal', memoryCallback);
      MemoryMonitor.removeCallback('warning', memoryCallback);
      MemoryMonitor.removeCallback('danger', memoryCallback);
      
      // 关闭数据库连接
      if (dbRef.current) {
        dbRef.current.close();
      }
    };
  }, []);
  
  return (
    <div className="data-import-export-container" style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h2>大数据量处理示例</h2>
      
      <div className="status-section" style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
        <div><strong>数据库状态:</strong> {dbStatus}</div>
        <div><strong>记录数量:</strong> {recordCount}</div>
        <div>
          <strong>内存使用:</strong>
          {memoryUsage ? (
            <>
              <div style={{ marginLeft: '10px' }}>
                <div>使用: {memoryUsage.usedJSHeapSize} MB / {memoryUsage.jsHeapSizeLimit} MB</div>
                <div>
                  <div style={{ width: '100%', backgroundColor: '#eee', borderRadius: '4px', height: '20px' }}>
                    <div 
                      style={{ 
                        width: `${memoryUsage.percentage}%`, 
                        backgroundColor: memoryUsage.percentage > 80 ? 'red' : memoryUsage.percentage > 60 ? 'orange' : 'green',
                        height: '100%',
                        borderRadius: '4px',
                        transition: 'width 0.3s ease'
                      }} 
                    />
                  </div>
                  <div style={{ textAlign: 'right' }}>{memoryUsage.percentage}%</div>
                </div>
              </div>
            </>
          ) : (
            '无法获取内存信息'
          )}
        </div>
      </div>
      
      <div className="controls-section" style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div>
          <label>
            测试数据量:
            <input 
              type="number" 
              value={testDataSize} 
              onChange={(e) => setTestDataSize(Math.max(1, parseInt(e.target.value) || 0))}
              style={{ marginLeft: '10px', width: '100px' }}
            />
          </label>
        </div>
        
        <div>
          <label>
            批处理大小:
            <input 
              type="number" 
              value={batchSize} 
              onChange={(e) => setBatchSize(Math.max(1, parseInt(e.target.value) || 0))}
              style={{ marginLeft: '10px', width: '100px' }}
            />
          </label>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          <button 
            onClick={importTestData}
            disabled={importStatus.state === 'running'}
            style={{
              padding: '8px 15px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: importStatus.state === 'running' ? 'not-allowed' : 'pointer'
            }}
          >
            导入测试数据
          </button>
          
          <button 
            onClick={exportData}
            disabled={exportStatus.state === 'running' || recordCount === 0}
            style={{
              padding: '8px 15px',
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: (exportStatus.state === 'running' || recordCount === 0) ? 'not-allowed' : 'pointer'
            }}
          >
            导出数据
          </button>
          
          <button 
            onClick={clearDatabase}
            disabled={importStatus.state === 'running' || exportStatus.state === 'running'}
            style={{
              padding: '8px 15px',
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: (importStatus.state === 'running' || exportStatus.state === 'running') ? 'not-allowed' : 'pointer'
            }}
          >
            清空数据库
          </button>
          
          <button 
            onClick={abortOperation}
            disabled={importStatus.state !== 'running' && exportStatus.state !== 'running'}
            style={{
              padding: '8px 15px',
              backgroundColor: '#ff9800',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: (importStatus.state !== 'running' && exportStatus.state !== 'running') ? 'not-allowed' : 'pointer'
            }}
          >
            中止操作
          </button>
        </div>
      </div>
      
      <div className="progress-section" style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '10px' }}>
          <strong>导入进度:</strong>
          <div style={{ width: '100%', backgroundColor: '#eee', borderRadius: '4px', height: '20px', marginTop: '5px' }}>
            <div 
              style={{ 
                width: `${importStatus.progress}%`, 
                backgroundColor: importStatus.state === 'error' ? 'red' : '#4CAF50',
                height: '100%',
                borderRadius: '4px',
                transition: 'width 0.3s ease'
              }} 
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{importStatus.state}</span>
            <span>{importStatus.progress}%</span>
          </div>
        </div>
        
        <div>
          <strong>导出进度:</strong>
          <div style={{ width: '100%', backgroundColor: '#eee', borderRadius: '4px', height: '20px', marginTop: '5px' }}>
            <div 
              style={{ 
                width: `${exportStatus.progress}%`, 
                backgroundColor: exportStatus.state === 'error' ? 'red' : '#2196F3',
                height: '100%',
                borderRadius: '4px',
                transition: 'width 0.3s ease'
              }} 
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{exportStatus.state}</span>
            <span>{exportStatus.progress}%</span>
          </div>
        </div>
      </div>
      
      <div className="tips-section" style={{ backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '5px' }}>
        <h3 style={{ marginTop: '0' }}>内存优化技巧</h3>
        <ul>
          <li>使用分批处理代替一次性加载全部数据</li>
          <li>处理完一批数据后释放内存引用</li>
          <li>适当设置延迟让JS引擎有机会进行垃圾回收</li>
          <li>监控内存使用情况，在高内存使用时减少批量大小</li>
          <li>对不再需要的大对象及时设置为null</li>
          <li>避免创建过多的中间对象和临时变量</li>
          <li>谨慎使用闭包，避免内存泄漏</li>
        </ul>
      </div>
    </div>
  );
};

export default DataImportExportComponent; 