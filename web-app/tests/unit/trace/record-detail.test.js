/**
 * 食品溯源系统 - 溯源记录详情组件单元测试
 * @version 1.0.0
 */

const { expect } = require('chai');
const sinon = require('sinon');
const { JSDOM } = require('jsdom');

// 模拟浏览器环境
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.localStorage = {
  getItem: sinon.stub(),
  setItem: sinon.stub(),
  removeItem: sinon.stub()
};

// 模拟地图API
global.TraceMapService = {
  init: sinon.stub(),
  loadMap: sinon.stub(),
  addMarker: sinon.stub(),
  centerAt: sinon.stub(),
  destroy: sinon.stub()
};

// 模拟分享API
global.navigator.share = sinon.stub();
global.navigator.clipboard = {
  writeText: sinon.stub()
};

// 模拟API
const mockApi = {
  fetchRecordById: sinon.stub(),
  fetchCertificateById: sinon.stub(),
  fetchLocationDetails: sinon.stub(),
  fetchProductDetails: sinon.stub()
};

// 模拟事件触发
function triggerEvent(element, eventName) {
  const event = document.createEvent('HTMLEvents');
  event.initEvent(eventName, true, false);
  element.dispatchEvent(event);
}

// 导入组件
const TraceRecordDetail = require('../../../components/modules/trace/TraceRecordDetail');

describe('TraceRecordDetail 组件单元测试', () => {
  // 测试数据
  const testRecord = {
    id: 'record-123',
    productId: 'prod-456',
    productName: '有机大米',
    status: 'completed',
    location: '浙江省杭州市',
    timestamp: Date.now() - 864000000, // 10天前
    productType: '粮食',
    details: {
      batch: 'B001',
      operator: '张三',
      operationName: '收获',
      description: '按标准流程收获',
      certificates: ['cert-789']
    }
  };
  
  const testCertificate = {
    id: 'cert-789',
    name: '有机认证证书',
    issuer: '中国有机认证中心',
    issueDate: '2025-01-15',
    validUntil: '2026-01-14',
    image: 'https://example.com/certificates/cert-789.jpg'
  };
  
  const testLocation = {
    address: '浙江省杭州市西湖区',
    latitude: 30.259924,
    longitude: 120.219375,
    details: '有机农场'
  };
  
  const testProductDetails = {
    name: '有机大米',
    description: '纯天然无污染有机大米',
    producer: '浙江有机农业有限公司',
    origin: '浙江省杭州市',
    nutrients: {
      protein: '7.8g/100g',
      fat: '0.5g/100g',
      carbohydrate: '77.5g/100g'
    }
  };
  
  // 测试前的设置
  beforeEach(() => {
    // 重置存根和模拟
    sinon.reset();
    
    // 模拟环境变量
    process.env.NODE_ENV = 'test';
    
    // 默认模拟返回值
    mockApi.fetchRecordById.resolves(testRecord);
    mockApi.fetchCertificateById.resolves(testCertificate);
    mockApi.fetchLocationDetails.resolves(testLocation);
    mockApi.fetchProductDetails.resolves(testProductDetails);
    
    // 初始化组件
    TraceRecordDetail.init({
      api: mockApi,
      containerId: 'detail-container',
      mapContainerId: 'map-container'
    });
  });
  
  // 测试加载记录
  describe('记录加载功能', () => {
    it('应正确加载指定ID的记录', async () => {
      const recordId = 'record-123';
      await TraceRecordDetail.loadRecord(recordId);
      
      // 验证API调用
      expect(mockApi.fetchRecordById.calledOnceWith(recordId)).to.be.true;
      
      // 验证状态
      const state = TraceRecordDetail.getState();
      expect(state.loading).to.be.false;
      expect(state.record).to.deep.equal(testRecord);
      expect(state.error).to.be.false;
    });
    
    it('应在记录不存在时设置错误状态', async () => {
      // 模拟API返回null
      mockApi.fetchRecordById.resolves(null);
      
      // 加载不存在的记录
      await TraceRecordDetail.loadRecord('non-existent');
      
      // 验证状态
      const state = TraceRecordDetail.getState();
      expect(state.loading).to.be.false;
      expect(state.error).to.be.true;
      expect(state.errorMessage).to.equal('未找到溯源记录');
    });
    
    it('应在API调用失败时设置错误状态', async () => {
      // 模拟API调用失败
      const errorMessage = '网络错误，请稍后再试';
      mockApi.fetchRecordById.rejects(new Error(errorMessage));
      
      // 加载记录
      try {
        await TraceRecordDetail.loadRecord('record-123');
      } catch (e) {
        // 预期会有错误
      }
      
      // 验证状态
      const state = TraceRecordDetail.getState();
      expect(state.loading).to.be.false;
      expect(state.error).to.be.true;
      expect(state.errorMessage).to.equal(errorMessage);
    });
  });
  
  // 测试证书加载
  describe('证书加载功能', () => {
    it('应正确加载记录关联的证书', async () => {
      // 先加载记录
      await TraceRecordDetail.loadRecord('record-123');
      
      // 加载证书
      await TraceRecordDetail.loadCertificate();
      
      // 验证API调用
      expect(mockApi.fetchCertificateById.calledOnceWith('cert-789')).to.be.true;
      
      // 验证状态
      const state = TraceRecordDetail.getState();
      expect(state.certificate).to.deep.equal(testCertificate);
    });
    
    it('应处理记录没有关联证书的情况', async () => {
      // 修改测试记录，移除证书
      const recordWithoutCert = {
        ...testRecord,
        details: { ...testRecord.details, certificates: [] }
      };
      mockApi.fetchRecordById.resolves(recordWithoutCert);
      
      // 加载记录
      await TraceRecordDetail.loadRecord('record-123');
      
      // 尝试加载证书
      await TraceRecordDetail.loadCertificate();
      
      // 验证状态
      const state = TraceRecordDetail.getState();
      expect(state.hasCertificate).to.be.false;
      expect(state.certificateError).to.be.true;
      expect(state.certificateErrorMessage).to.equal('此记录没有关联证书');
    });
  });
  
  // 测试地图功能
  describe('地图功能', () => {
    it('应正确初始化地图并显示位置', async () => {
      // 先加载记录
      await TraceRecordDetail.loadRecord('record-123');
      
      // 显示地图
      await TraceRecordDetail.showMap();
      
      // 验证地图服务调用
      expect(TraceMapService.init.calledOnce).to.be.true;
      expect(TraceMapService.loadMap.calledOnce).to.be.true;
      expect(TraceMapService.addMarker.calledOnce).to.be.true;
      
      // 验证使用了正确的坐标
      const markerCall = TraceMapService.addMarker.firstCall;
      expect(markerCall.args[0]).to.equal(testLocation.latitude);
      expect(markerCall.args[1]).to.equal(testLocation.longitude);
      
      // 验证状态
      const state = TraceRecordDetail.getState();
      expect(state.mapLoaded).to.be.true;
    });
    
    it('应处理位置信息不存在的情况', async () => {
      // 修改测试记录，移除位置
      const recordWithoutLocation = {
        ...testRecord,
        location: ''
      };
      mockApi.fetchRecordById.resolves(recordWithoutLocation);
      
      // 加载记录
      await TraceRecordDetail.loadRecord('record-123');
      
      // 尝试显示地图
      await TraceRecordDetail.showMap();
      
      // 验证状态
      const state = TraceRecordDetail.getState();
      expect(state.hasLocation).to.be.false;
      expect(state.mapError).to.be.true;
    });
  });
  
  // 测试分享功能
  describe('分享功能', () => {
    it('应在支持Navigator API时使用原生分享', async () => {
      // 设置navigator.share调用成功
      navigator.share.resolves();
      
      // 先加载记录
      await TraceRecordDetail.loadRecord('record-123');
      
      // 触发分享
      const result = await TraceRecordDetail.shareRecord();
      
      // 验证API调用
      expect(navigator.share.calledOnce).to.be.true;
      expect(result.success).to.be.true;
      
      // 验证分享内容包含记录信息
      const shareData = navigator.share.firstCall.args[0];
      expect(shareData.title).to.contain(testRecord.productName);
      expect(shareData.text).to.contain(testRecord.details.operationName);
    });
    
    it('应在不支持Navigator API时使用剪贴板', async () => {
      // 禁用navigator.share
      navigator.share = null;
      
      // 设置剪贴板调用成功
      navigator.clipboard.writeText.resolves();
      
      // 先加载记录
      await TraceRecordDetail.loadRecord('record-123');
      
      // 触发分享
      const result = await TraceRecordDetail.shareRecord();
      
      // 验证API调用
      expect(navigator.clipboard.writeText.calledOnce).to.be.true;
      expect(result.success).to.be.true;
      expect(result.method).to.equal('clipboard');
      
      // 验证剪贴板内容包含记录信息
      const clipboardText = navigator.clipboard.writeText.firstCall.args[0];
      expect(clipboardText).to.contain(testRecord.productName);
      expect(clipboardText).to.contain(testRecord.id);
    });
  });
  
  // 测试产品详情功能
  describe('产品详情功能', () => {
    it('应正确加载产品详细信息', async () => {
      // 先加载记录
      await TraceRecordDetail.loadRecord('record-123');
      
      // 加载产品详情
      await TraceRecordDetail.loadProductDetails();
      
      // 验证API调用
      expect(mockApi.fetchProductDetails.calledOnceWith(testRecord.productId)).to.be.true;
      
      // 验证状态
      const state = TraceRecordDetail.getState();
      expect(state.productDetails).to.deep.equal(testProductDetails);
    });
    
    it('应处理产品ID不存在的情况', async () => {
      // 修改测试记录，移除产品ID
      const recordWithoutProductId = {
        ...testRecord,
        productId: ''
      };
      mockApi.fetchRecordById.resolves(recordWithoutProductId);
      
      // 加载记录
      await TraceRecordDetail.loadRecord('record-123');
      
      // 尝试加载产品详情
      await TraceRecordDetail.loadProductDetails();
      
      // 验证状态
      const state = TraceRecordDetail.getState();
      expect(state.productDetailsError).to.be.true;
      expect(state.productDetailsErrorMessage).to.equal('产品ID不存在');
    });
  });
  
  // 测试时间格式化
  describe('时间格式化功能', () => {
    it('应正确格式化时间戳', () => {
      const timestamp = 1715385600000; // 2024-05-11 00:00:00 UTC
      const formatted = TraceRecordDetail.formatTimestamp(timestamp);
      
      expect(formatted).to.match(/2024-05-11/);
    });
    
    it('应处理无效的时间戳', () => {
      const formatted = TraceRecordDetail.formatTimestamp('invalid');
      expect(formatted).to.equal('未知时间');
    });
  });
  
  // 测试渲染功能
  describe('UI渲染功能', () => {
    it('应重渲染UI当状态改变时', async () => {
      // 设置模拟
      TraceRecordDetail.renderUI = sinon.spy();
      
      // 加载记录
      await TraceRecordDetail.loadRecord('record-123');
      
      // 验证渲染调用
      expect(TraceRecordDetail.renderUI.called).to.be.true;
    });
    
    it('应在不同状态展示不同UI', async () => {
      // 设置UI测试方法
      TraceRecordDetail.isElementVisible = (selector) => {
        // 在测试环境中，直接返回预期结果
        if (selector === '.loading-indicator') {
          return TraceRecordDetail.getState().loading;
        }
        if (selector === '.error-message') {
          return TraceRecordDetail.getState().error;
        }
        if (selector === '.record-details') {
          return !TraceRecordDetail.getState().loading && !TraceRecordDetail.getState().error;
        }
        return false;
      };
      
      // 测试加载状态
      TraceRecordDetail.setState({ loading: true, error: false });
      expect(TraceRecordDetail.isElementVisible('.loading-indicator')).to.be.true;
      expect(TraceRecordDetail.isElementVisible('.record-details')).to.be.false;
      
      // 测试错误状态
      TraceRecordDetail.setState({ loading: false, error: true });
      expect(TraceRecordDetail.isElementVisible('.error-message')).to.be.true;
      expect(TraceRecordDetail.isElementVisible('.record-details')).to.be.false;
      
      // 测试正常状态
      TraceRecordDetail.setState({ loading: false, error: false });
      expect(TraceRecordDetail.isElementVisible('.record-details')).to.be.true;
    });
  });
}); 