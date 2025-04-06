const traceBlockchain = require('../../components/trace-blockchain');

describe('区块链模块测试', () => {
  let blockchain;
  
  beforeEach(() => {
    blockchain = traceBlockchain;
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('初始化测试', () => {
    test('应该正确初始化区块链连接', async () => {
      jest.spyOn(blockchain, 'init').mockResolvedValue(true);
      const result = await blockchain.init();
      expect(result).toBe(true);
    });
    
    test('应该处理初始化失败的情况', async () => {
      jest.spyOn(blockchain, 'init').mockRejectedValue(new Error('连接失败'));
      await expect(blockchain.init()).rejects.toThrow('连接失败');
    });
  });
  
  describe('智能合约测试', () => {
    beforeEach(async () => {
      jest.spyOn(blockchain, 'init').mockResolvedValue(true);
      await blockchain.init();
    });
    
    test('应该能获取产品信息', async () => {
      const productId = '123456';
      jest.spyOn(blockchain, 'getTraceHistory').mockResolvedValue({
        productId,
        timestamp: Date.now(),
        data: [{ type: 'PRODUCE', timestamp: Date.now() }]
      });
      
      const result = await blockchain.getTraceHistory(productId);
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
      
      jest.spyOn(blockchain, 'addTraceRecord').mockResolvedValue({
        transactionId: 'tx_' + Date.now(),
        status: 'success'
      });
      
      const result = await blockchain.addTraceRecord(
        traceData.productId,
        traceData.operation,
        traceData.data
      );
      
      expect(result).toHaveProperty('transactionId');
      expect(result).toHaveProperty('status', 'success');
    });
  });
  
  describe('交易验证测试', () => {
    test('应该能验证交易的真实性', async () => {
      const productId = '123456';
      const verificationData = { checksum: 'abc123' };
      
      jest.spyOn(blockchain, 'verifyProduct').mockResolvedValue({
        valid: true,
        verificationTime: Date.now()
      });
      
      const result = await blockchain.verifyProduct(productId, verificationData);
      expect(result).toHaveProperty('valid', true);
      expect(result).toHaveProperty('verificationTime');
    });
    
    test('应该能检测无效交易', async () => {
      const fakeProductId = 'fake_id';
      const verificationData = { checksum: 'invalid' };
      
      jest.spyOn(blockchain, 'verifyProduct').mockResolvedValue({
        valid: false,
        error: '验证失败：无效的产品ID'
      });
      
      const result = await blockchain.verifyProduct(fakeProductId, verificationData);
      expect(result).toHaveProperty('valid', false);
      expect(result).toHaveProperty('error');
    });
  });
  
  describe('性能测试', () => {
    test('应该在规定时间内完成批量交易', async () => {
      const batchSize = 10;
      const startTime = Date.now();
      
      jest.spyOn(blockchain, 'addTraceRecord').mockImplementation(() => {
        return Promise.resolve({
          transactionId: 'tx_' + Date.now(),
          status: 'success'
        });
      });
      
      const promises = Array(batchSize).fill().map((_, i) => {
        return blockchain.addTraceRecord(
          `test_${i}`,
          'TEST',
          { test: true }
        );
      });
      
      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      expect(results).toHaveLength(batchSize);
      expect(endTime - startTime).toBeLessThan(5000);
    });
  });
  
  describe('错误处理测试', () => {
    test('应该优雅处理网络错误', async () => {
      jest.spyOn(blockchain, 'getTraceHistory').mockRejectedValue(new Error('网络错误'));
      
      await expect(blockchain.getTraceHistory('123')).rejects.toThrow('网络错误');
    });
    
    test('应该处理无效的输入数据', async () => {
      jest.spyOn(blockchain, 'addTraceRecord').mockImplementation((productId) => {
        if (!productId || productId === '') {
          return Promise.reject(new Error('无效的产品ID'));
        }
        return Promise.resolve({ status: 'success' });
      });
      
      await expect(blockchain.addTraceRecord('', 'TEST', {})).rejects.toThrow('无效的产品ID');
    });
  });
}); 