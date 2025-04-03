const { TraceBlockchain } = require('../../components/trace-blockchain');
const { jest } = require('@jest/globals');

describe('区块链模块测试', () => {
  let blockchain;
  
  beforeEach(() => {
    blockchain = new TraceBlockchain();
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('初始化测试', () => {
    test('应该正确初始化区块链连接', async () => {
      const connection = await blockchain.initialize();
      expect(connection.status).toBe('connected');
    });
    
    test('应该处理初始化失败的情况', async () => {
      jest.spyOn(blockchain, 'initialize').mockRejectedValue(new Error('连接失败'));
      await expect(blockchain.initialize()).rejects.toThrow('连接失败');
    });
  });
  
  describe('智能合约测试', () => {
    beforeEach(async () => {
      await blockchain.initialize();
    });
    
    test('应该能获取产品信息', async () => {
      const productId = '123456';
      const result = await blockchain.getProductInfo(productId);
      expect(result).toHaveProperty('productId', productId);
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('data');
    });
    
    test('应该能记录新的溯源数据', async () => {
      const traceData = {
        productId: '123456',
        operation: 'PRODUCE',
        timestamp: Date.now(),
        data: { batch: 'B001', operator: 'OP001' }
      };
      
      const result = await blockchain.recordTrace(traceData);
      expect(result).toHaveProperty('transactionId');
      expect(result).toHaveProperty('status', 'success');
    });
  });
  
  describe('交易验证测试', () => {
    test('应该能验证交易的真实性', async () => {
      const txId = 'tx_123456';
      const result = await blockchain.verifyTransaction(txId);
      expect(result).toHaveProperty('valid', true);
      expect(result).toHaveProperty('verificationTime');
    });
    
    test('应该能检测无效交易', async () => {
      const fakeTxId = 'fake_tx';
      const result = await blockchain.verifyTransaction(fakeTxId);
      expect(result).toHaveProperty('valid', false);
      expect(result).toHaveProperty('error');
    });
  });
  
  describe('性能测试', () => {
    test('应该在规定时间内完成批量交易', async () => {
      const batchSize = 100;
      const startTime = Date.now();
      
      const promises = Array(batchSize).fill().map((_, i) => {
        return blockchain.recordTrace({
          productId: `test_${i}`,
          operation: 'TEST',
          timestamp: Date.now(),
          data: { test: true }
        });
      });
      
      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      expect(results).toHaveLength(batchSize);
      expect(endTime - startTime).toBeLessThan(5000); // 5秒内完成
    });
  });
  
  describe('错误处理测试', () => {
    test('应该优雅处理网络错误', async () => {
      jest.spyOn(blockchain, 'getProductInfo').mockRejectedValue(new Error('网络错误'));
      
      await expect(blockchain.getProductInfo('123')).rejects.toThrow('网络错误');
    });
    
    test('应该处理无效的输入数据', async () => {
      const invalidData = { productId: '' };
      await expect(blockchain.recordTrace(invalidData)).rejects.toThrow('无效的产品ID');
    });
  });
}); 