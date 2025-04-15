/**
 * 食品溯源系统 - 溯源记录查询组件额外单元测试
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

// 模拟API
const mockApi = {
  fetchRecords: sinon.stub(),
  fetchRecordById: sinon.stub(),
  fetchRecordsByProductId: sinon.stub()
};

// 导入组件
const TraceRecordQuery = require('../../../components/modules/trace/TraceRecordQuery');

describe('TraceRecordQuery 组件额外单元测试', () => {
  // 测试前的设置
  beforeEach(() => {
    // 重置存根和模拟
    sinon.reset();
    
    // 模拟环境变量
    process.env.NODE_ENV = 'test';
    
    // 默认模拟数据
    mockApi.fetchRecords.resolves([
      {
        id: 'record1',
        productId: 'prod1',
        productName: '有机大米',
        status: 'completed',
        location: '浙江省',
        timestamp: Date.now() - 100000,
        productType: '水果',
        details: { batch: 'B001', operator: '张三' }
      },
      {
        id: 'record2',
        productId: 'prod2',
        productName: '有机蔬菜',
        status: 'processing',
        location: '湖南省',
        timestamp: Date.now() - 200000,
        productType: '蔬菜',
        details: { batch: 'B002', operator: '李四' }
      },
      {
        id: 'record3',
        productId: 'prod1',
        productName: '有机大米',
        status: 'completed',
        location: '浙江省',
        timestamp: Date.now() - 300000,
        productType: '水果',
        details: { batch: 'B003', operator: '王五' }
      }
    ]);
    
    // 初始化组件
    TraceRecordQuery.init({
      api: mockApi,
      autoload: false
    });
  });
  
  describe('组件初始化与配置', () => {
    it('应正确设置自定义页面大小', () => {
      const customPageSize = 5;
      TraceRecordQuery.init({
        api: mockApi,
        autoload: false,
        pageSize: customPageSize
      });
      
      expect(TraceRecordQuery.getState().pagination.pageSize).to.equal(customPageSize);
    });
    
    it('应支持不同的排序配置', () => {
      TraceRecordQuery.init({
        api: mockApi,
        autoload: false,
        sortField: 'productName',
        sortOrder: 'desc'
      });
      
      const state = TraceRecordQuery.getState();
      expect(state.sorting.field).to.equal('productName');
      expect(state.sorting.order).to.equal('desc');
    });
    
    it('应支持初始筛选条件', () => {
      const initialFilters = {
        status: 'completed',
        productType: '水果'
      };
      
      TraceRecordQuery.init({
        api: mockApi,
        autoload: false,
        filters: initialFilters
      });
      
      const state = TraceRecordQuery.getState();
      expect(state.filters.status).to.equal(initialFilters.status);
      expect(state.filters.productType).to.equal(initialFilters.productType);
    });
  });
  
  describe('数据加载与错误处理', () => {
    it('应在API调用失败时设置错误状态', async () => {
      // 模拟API调用失败
      const errorMessage = '网络错误，请稍后再试';
      mockApi.fetchRecords.rejects(new Error(errorMessage));
      
      // 加载数据
      await TraceRecordQuery.loadRecords();
      
      // 验证状态
      const state = TraceRecordQuery.getState();
      expect(state.loading).to.be.false;
      expect(state.error).to.be.true;
      expect(state.errorMessage).to.equal(errorMessage);
    });
    
    it('应在刷新数据时重置错误状态', async () => {
      // 先设置一个错误状态
      mockApi.fetchRecords.rejects(new Error('初始错误'));
      await TraceRecordQuery.loadRecords();
      
      // 然后修复API并刷新
      mockApi.fetchRecords.resolves([]);
      await TraceRecordQuery.refreshRecords();
      
      // 验证状态
      const state = TraceRecordQuery.getState();
      expect(state.error).to.be.false;
      expect(state.errorMessage).to.be.null;
    });
    
    it('应在没有找到记录时设置空结果状态', async () => {
      // 模拟API返回空数组
      mockApi.fetchRecords.resolves([]);
      
      // 加载数据
      await TraceRecordQuery.loadRecords();
      
      // 验证状态
      const state = TraceRecordQuery.getState();
      expect(state.records.length).to.equal(0);
      expect(state.isEmpty).to.be.true;
    });
  });
  
  describe('复合筛选场景', () => {
    it('应支持多重筛选条件组合', async () => {
      // 加载初始数据
      await TraceRecordQuery.loadRecords();
      
      // 应用多个筛选条件
      TraceRecordQuery.filterByStatus('completed');
      TraceRecordQuery.filterByProductType('水果');
      TraceRecordQuery.filterByLocation('浙江省');
      
      // 验证筛选结果
      const state = TraceRecordQuery.getState();
      expect(state.filteredRecords.length).to.equal(2);
      expect(state.filteredRecords[0].status).to.equal('completed');
      expect(state.filteredRecords[0].productType).to.equal('水果');
      expect(state.filteredRecords[0].location).to.equal('浙江省');
    });
    
    it('应在修改筛选条件时重置分页到第一页', async () => {
      // 加载初始数据
      await TraceRecordQuery.loadRecords();
      
      // 设置为第二页
      TraceRecordQuery.setPagination(2, 1);
      
      // 应用筛选条件
      TraceRecordQuery.filterByStatus('completed');
      
      // 验证分页重置
      const state = TraceRecordQuery.getState();
      expect(state.pagination.currentPage).to.equal(1);
    });
    
    it('应支持清除所有筛选条件', async () => {
      // 加载初始数据
      await TraceRecordQuery.loadRecords();
      
      // 应用多个筛选条件
      TraceRecordQuery.filterByStatus('completed');
      TraceRecordQuery.filterByProductType('水果');
      TraceRecordQuery.filterByLocation('浙江省');
      
      // 清除所有筛选条件
      TraceRecordQuery.clearFilters();
      
      // 验证筛选条件已清除
      const state = TraceRecordQuery.getState();
      expect(state.filters.status).to.be.null;
      expect(state.filters.productType).to.be.null;
      expect(state.filters.location).to.be.null;
      expect(state.filteredRecords.length).to.equal(3); // 所有记录
    });
  });
  
  describe('排序功能', () => {
    it('应按照时间升序排序', async () => {
      // 加载初始数据
      await TraceRecordQuery.loadRecords();
      
      // 按时间升序排序
      TraceRecordQuery.sortRecords('timestamp', 'asc');
      
      // 验证排序结果
      const state = TraceRecordQuery.getState();
      const timestamps = state.filteredRecords.map(record => record.timestamp);
      const isSorted = timestamps.every((val, i, arr) => !i || val >= arr[i - 1]);
      
      expect(isSorted).to.be.true;
      expect(state.sorting.field).to.equal('timestamp');
      expect(state.sorting.order).to.equal('asc');
    });
    
    it('应按照产品名称降序排序', async () => {
      // 加载初始数据
      await TraceRecordQuery.loadRecords();
      
      // 按产品名称降序排序
      TraceRecordQuery.sortRecords('productName', 'desc');
      
      // 验证排序结果
      const state = TraceRecordQuery.getState();
      const productNames = state.filteredRecords.map(record => record.productName);
      const isSorted = productNames.every((val, i, arr) => !i || val <= arr[i - 1]);
      
      expect(isSorted).to.be.true;
      expect(state.sorting.field).to.equal('productName');
      expect(state.sorting.order).to.equal('desc');
    });
    
    it('应在排序字段不存在时使用默认排序', async () => {
      // 加载初始数据
      await TraceRecordQuery.loadRecords();
      
      // 尝试按不存在的字段排序
      TraceRecordQuery.sortRecords('nonExistentField', 'asc');
      
      // 验证使用了默认排序
      const state = TraceRecordQuery.getState();
      expect(state.sorting.field).to.equal('timestamp'); // 默认字段
      expect(state.sorting.order).to.equal('desc'); // 默认顺序
    });
  });
  
  describe('数据持久化', () => {
    it('应将筛选条件保存到本地存储', async () => {
      // 加载初始数据
      await TraceRecordQuery.loadRecords();
      
      // 应用筛选条件
      TraceRecordQuery.filterByStatus('completed');
      TraceRecordQuery.saveFiltersToStorage();
      
      // 验证本地存储调用
      expect(localStorage.setItem.calledOnce).to.be.true;
      const savedFilters = JSON.parse(localStorage.setItem.firstCall.args[1]);
      expect(savedFilters.status).to.equal('completed');
    });
    
    it('应从本地存储加载筛选条件', () => {
      // 模拟本地存储中的筛选条件
      const savedFilters = {
        status: 'completed',
        productType: '水果',
        dateRange: { start: '2025-01-01', end: '2025-05-01' }
      };
      localStorage.getItem.returns(JSON.stringify(savedFilters));
      
      // 从存储加载筛选条件
      TraceRecordQuery.loadFiltersFromStorage();
      
      // 验证加载的筛选条件
      const state = TraceRecordQuery.getState();
      expect(state.filters.status).to.equal(savedFilters.status);
      expect(state.filters.productType).to.equal(savedFilters.productType);
      expect(state.filters.dateRange.start).to.equal(savedFilters.dateRange.start);
      expect(state.filters.dateRange.end).to.equal(savedFilters.dateRange.end);
    });
  });
  
  describe('边界情况处理', () => {
    it('应处理无效的日期范围', () => {
      // 设置无效的日期范围
      TraceRecordQuery.filterByDateRange('invalid-date', '2025-05-01');
      
      // 验证筛选结果不受影响
      const state = TraceRecordQuery.getState();
      expect(state.filters.dateRange).to.be.null;
      expect(state.error).to.be.false;
    });
    
    it('应处理日期范围为空的情况', () => {
      // 设置空的日期范围
      TraceRecordQuery.filterByDateRange('', '');
      
      // 验证筛选结果
      const state = TraceRecordQuery.getState();
      expect(state.filters.dateRange).to.be.null;
    });
    
    it('应处理分页超出范围的情况', async () => {
      // 加载初始数据 (3条记录)
      await TraceRecordQuery.loadRecords();
      
      // 设置超出范围的页码
      TraceRecordQuery.setPagination(10, 1);
      
      // 验证页码被自动调整
      const state = TraceRecordQuery.getState();
      expect(state.pagination.currentPage).to.equal(1); // 调整到最后一页
    });
  });
}); 