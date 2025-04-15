/**
 * @file 溯源记录时间轴视图组件单元测试
 * @description 测试溯源记录视图组件的时间轴渲染功能
 * @version 1.0.0
 */

import { TraceRecordView } from '../../../components/modules/trace/TraceRecordView';
import { traceUtils } from '../../../components/modules/utils/utils';

// 模拟依赖模块
jest.mock('../../../components/modules/utils/utils', () => ({
  traceUtils: {
    formatDate: jest.fn(date => {
      if (!date) return '';
      const d = new Date(date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })
  }
}));

// 模拟记录数据
const mockRecord = {
  id: 'record-001',
  productId: 'product-001',
  productName: '有机草莓',
  productType: '水果',
  batchNumber: 'BATCH-2025-05',
  operation: '收获',
  stage: '生产阶段',
  handler: { name: '张三' },
  location: '浙江省杭州市',
  timestamp: '2025-05-15T10:30:00Z',
  status: 'completed',
  details: {
    notes: '按标准流程收获',
    temperature: '25°C',
    humidity: '65%'
  }
};

const mockTimelineRecords = [
  {
    id: 'record-001',
    productId: 'product-001',
    productName: '有机草莓',
    operation: '收获',
    stage: '生产阶段',
    handler: { name: '张三' },
    location: '浙江省杭州市',
    timestamp: '2025-05-15T10:30:00Z',
    status: 'completed'
  },
  {
    id: 'record-002',
    productId: 'product-001',
    productName: '有机草莓',
    operation: '包装',
    stage: '加工阶段',
    handler: { name: '李四' },
    location: '浙江省杭州市',
    timestamp: '2025-05-16T14:30:00Z',
    status: 'completed'
  },
  {
    id: 'record-003',
    productId: 'product-001',
    productName: '有机草莓',
    operation: '运输',
    stage: '物流阶段',
    handler: { name: '王五' },
    location: '浙江省杭州市 -> 上海市',
    timestamp: '2025-05-17T09:15:00Z',
    status: 'in-transit'
  },
  {
    id: 'record-004',
    productId: 'product-001',
    productName: '有机草莓',
    operation: '销售',
    stage: '销售阶段',
    handler: { name: '赵六' },
    location: '上海市',
    timestamp: '2025-05-18T15:45:00Z',
    status: 'pending'
  }
];

describe('溯源记录时间轴视图组件测试', () => {
  let viewComponent;
  let container;
  
  beforeEach(() => {
    // 重置所有模拟
    jest.clearAllMocks();
    
    // 初始化测试DOM环境
    document.body.innerHTML = '<div id="test-container"></div>';
    container = document.getElementById('test-container');
    
    // 初始化视图组件
    viewComponent = TraceRecordView.init();
  });
  
  describe('基本时间轴渲染测试', () => {
    test('renderTimeline应将时间线渲染到容器中', () => {
      viewComponent.renderTimeline(mockRecord, container, {
        timelineRecords: mockTimelineRecords
      });
      
      // 验证容器中包含时间线
      expect(container.innerHTML).not.toBe('');
      expect(container.querySelector('.trace-timeline')).not.toBeNull();
      expect(container.textContent).toContain('溯源时间线');
    });
    
    test('时间线应按时间降序排序', () => {
      viewComponent.renderTimeline(mockRecord, container, {
        timelineRecords: mockTimelineRecords
      });
      
      // 获取所有时间线项
      const timelineItems = container.querySelectorAll('.trace-timeline-item');
      
      // 验证排序和数量
      expect(timelineItems.length).toBe(4);
      
      // 验证第一项（最新的）是销售阶段
      expect(timelineItems[0].textContent).toContain('销售阶段');
      expect(timelineItems[0].textContent).toContain('2025-05-18');
      
      // 验证最后一项（最早的）是生产阶段
      expect(timelineItems[3].textContent).toContain('生产阶段');
      expect(timelineItems[3].textContent).toContain('2025-05-15');
    });
    
    test('当前记录在时间线中应高亮显示', () => {
      viewComponent.renderTimeline(mockRecord, container, {
        timelineRecords: mockTimelineRecords
      });
      
      // 获取所有时间线项
      const timelineItems = container.querySelectorAll('.trace-timeline-item');
      
      // 验证当前记录项有current类
      const currentItem = Array.from(timelineItems).find(item => 
        item.classList.contains('current')
      );
      
      expect(currentItem).not.toBeNull();
      expect(currentItem.textContent).toContain('生产阶段');
      expect(currentItem.textContent).toContain('张三');
    });
    
    test('没有记录时应显示空状态', () => {
      viewComponent.renderTimeline(mockRecord, container, {
        timelineRecords: []
      });
      
      // 验证显示了空状态
      expect(container.textContent).toContain('暂无溯源时间线数据');
    });
    
    test('未提供记录参数时应返回容器而不进行渲染', () => {
      const originalInnerHTML = container.innerHTML;
      
      const result = viewComponent.renderTimeline(null, container);
      
      // 验证容器内容未改变
      expect(result).toBe(container);
      expect(container.innerHTML).toBe(originalInnerHTML);
    });
  });
  
  describe('时间线项内容测试', () => {
    test('时间线项应包含状态、时间和操作人信息', () => {
      viewComponent.renderTimeline(mockRecord, container, {
        timelineRecords: mockTimelineRecords
      });
      
      // 获取所有时间线项
      const timelineItems = container.querySelectorAll('.trace-timeline-item');
      
      // 检查第三个时间线项（运输阶段）
      const transportItem = timelineItems[1]; // 因为是降序排序，运输阶段是第二个
      
      expect(transportItem.textContent).toContain('物流阶段');
      expect(transportItem.textContent).toContain('王五');
      expect(transportItem.textContent).toContain('浙江省杭州市 -> 上海市');
      
      // 检查是否有状态指示
      const statusIndicator = transportItem.querySelector('.trace-timeline-content');
      expect(statusIndicator).not.toBeNull();
    });
    
    test('时间线项应显示记录详情信息', () => {
      // 添加详情到一个记录
      const recordsWithDetails = [...mockTimelineRecords];
      recordsWithDetails[0].details = {
        notes: '按标准流程收获',
        temperature: '25°C',
        humidity: '65%'
      };
      
      viewComponent.renderTimeline(mockRecord, container, {
        timelineRecords: recordsWithDetails
      });
      
      // 获取所有时间线项
      const timelineItems = container.querySelectorAll('.trace-timeline-item');
      
      // 检查第一个时间线项（收获阶段）是否显示详情
      const harvestItem = timelineItems[3]; // 因为是降序排序，收获阶段是最后一个
      
      expect(harvestItem.textContent).toContain('notes');
      expect(harvestItem.textContent).toContain('按标准流程收获');
      expect(harvestItem.textContent).toContain('temperature');
      expect(harvestItem.textContent).toContain('25°C');
      expect(harvestItem.textContent).toContain('humidity');
      expect(harvestItem.textContent).toContain('65%');
    });
  });
  
  describe('自定义时间线模板测试', () => {
    test('应支持自定义时间线模板函数', () => {
      // 自定义模板函数
      const customTemplate = (record, options) => `
        <div class="custom-timeline">
          <h3 class="custom-title">自定义时间线</h3>
          <div class="custom-items">
            ${options.timelineRecords.map(item => `
              <div class="custom-item">
                <strong>${item.operation}</strong>
                <span>${item.handler.name}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
      
      // 使用自定义模板初始化组件
      const customView = TraceRecordView.init({
        templates: {
          timeline: customTemplate
        }
      });
      
      // 渲染时间线
      customView.renderTimeline(mockRecord, container, {
        timelineRecords: mockTimelineRecords
      });
      
      // 验证自定义模板被使用
      expect(container.querySelector('.custom-timeline')).not.toBeNull();
      expect(container.querySelector('.custom-title')).not.toBeNull();
      expect(container.textContent).toContain('自定义时间线');
      
      // 验证自定义项目
      const customItems = container.querySelectorAll('.custom-item');
      expect(customItems.length).toBe(4);
      expect(customItems[0].textContent).toContain('收获');
      expect(customItems[0].textContent).toContain('张三');
    });
    
    test('应支持自定义时间线模板字符串', () => {
      // 自定义模板字符串
      const customTemplate = `
        <div class="custom-timeline-string">
          <h3>简化时间线</h3>
          <p>共有4条溯源记录</p>
        </div>
      `;
      
      // 使用自定义模板初始化组件
      const customView = TraceRecordView.init({
        templates: {
          timeline: customTemplate
        }
      });
      
      // 渲染时间线
      customView.renderTimeline(mockRecord, container, {
        timelineRecords: mockTimelineRecords
      });
      
      // 验证自定义模板被使用
      expect(container.querySelector('.custom-timeline-string')).not.toBeNull();
      expect(container.textContent).toContain('简化时间线');
      expect(container.textContent).toContain('共有4条溯源记录');
    });
  });
  
  describe('状态和图标辅助函数测试', () => {
    test('每种状态的颜色应该有正确的返回值', () => {
      // 获取私有方法
      const getStatusColor = viewComponent._testExpose?.getStatusColor;
      
      // 如果私有方法不可访问，则跳过测试
      if (!getStatusColor) {
        console.warn('getStatusColor方法不可访问，无法测试');
        return;
      }
      
      // 测试各种状态的颜色
      expect(getStatusColor('completed')).toContain('green');
      expect(getStatusColor('in-transit')).toContain('blue');
      expect(getStatusColor('pending')).toContain('yellow');
      expect(getStatusColor('error')).toContain('red');
      expect(getStatusColor('unknown')).toContain('gray');
    });
    
    test('时间格式化应根据配置正确显示', () => {
      // 获取私有方法
      const formatRecordTime = viewComponent._testExpose?.formatRecordTime;
      
      // 如果私有方法不可访问，则跳过测试
      if (!formatRecordTime) {
        console.warn('formatRecordTime方法不可访问，无法测试');
        return;
      }
      
      // 测试时间格式化
      const testDate = '2025-05-15T10:30:00Z';
      expect(formatRecordTime(testDate)).toContain('2025');
      expect(formatRecordTime(testDate)).toContain('05');
      expect(formatRecordTime(testDate)).toContain('15');
    });
  });
}); 