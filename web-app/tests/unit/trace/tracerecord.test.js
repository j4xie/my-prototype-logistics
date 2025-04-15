/**
 * @file 溯源记录视图组件单元测试
 * @description 测试溯源记录组件的渲染和功能
 * @version 1.0.0
 */

import { traceRecordView } from '../../../components/modules/trace/TraceRecordView';
import { traceUtils } from '../../../components/modules/utils/utils';

// 模拟DOM环境
beforeEach(() => {
  // 清除document.body内容
  document.body.innerHTML = `
    <div id="trace-list-container"></div>
    <div id="trace-detail-container"></div>
    <div id="trace-timeline-container"></div>
  `;
  
  // 重置模拟函数
  jest.clearAllMocks();
});

// 模拟数据
const mockRecords = [
  {
    id: 'record-001',
    productId: 'prod-001',
    productName: '有机草莓',
    status: 'completed',
    location: '浙江省杭州市',
    timestamp: '2025-05-10T08:30:00Z',
    details: {
      operator: '张三',
      notes: '收获并包装',
      attachments: ['image1.jpg']
    }
  },
  {
    id: 'record-002',
    productId: 'prod-001',
    productName: '有机草莓',
    status: 'in-transit',
    location: '江苏省南京市',
    timestamp: '2025-05-11T10:15:00Z',
    details: {
      operator: '李四',
      notes: '运输中',
      attachments: []
    }
  }
];

// 模拟工具函数
jest.mock('../../../components/modules/utils/utils', () => ({
  traceUtils: {
    formatDate: jest.fn(date => '2025-05-15'),
    generateId: jest.fn(() => 'generated-id'),
    detectDevice: jest.fn(() => 'desktop')
  }
}));

describe('溯源记录视图组件测试', () => {
  describe('初始化测试', () => {
    test('应该使用默认配置正确初始化', () => {
      const view = traceRecordView.init();
      expect(view).toBeDefined();
      expect(view.renderList).toBeDefined();
      expect(view.renderDetail).toBeDefined();
      expect(view.renderTimeline).toBeDefined();
      expect(view.renderStatusTag).toBeDefined();
    });

    test('应该合并用户配置与默认配置', () => {
      const customConfig = {
        showTimeline: false,
        dateFormat: 'YYYY/MM/DD'
      };
      const view = traceRecordView.init(customConfig);
      
      // 渲染一个记录检查配置是否生效
      const container = document.getElementById('trace-list-container');
      view.renderList(mockRecords, container);
      
      // 检查日期格式是否按照自定义配置应用
      expect(traceUtils.formatDate).toHaveBeenCalledWith(expect.any(String), 'YYYY/MM/DD');
    });
  });

  describe('列表渲染测试', () => {
    test('应该正确渲染记录列表', () => {
      const view = traceRecordView.init();
      const container = document.getElementById('trace-list-container');
      
      view.renderList(mockRecords, container);
      
      // 检查列表项是否创建
      const listItems = container.querySelectorAll('.trace-record-item');
      expect(listItems.length).toBe(2);
      
      // 检查第一项内容
      expect(listItems[0].textContent).toContain('有机草莓');
      expect(listItems[0].textContent).toContain('浙江省杭州市');
    });

    test('应该处理空记录列表', () => {
      const view = traceRecordView.init();
      const container = document.getElementById('trace-list-container');
      
      view.renderList([], container);
      
      // 检查空状态信息
      expect(container.textContent).toContain('暂无溯源记录');
    });
  });

  describe('详情渲染测试', () => {
    test('应该正确渲染记录详情', () => {
      const view = traceRecordView.init();
      const container = document.getElementById('trace-detail-container');
      
      view.renderDetail(mockRecords[0], container);
      
      // 检查详情内容
      expect(container.textContent).toContain('有机草莓');
      expect(container.textContent).toContain('浙江省杭州市');
      expect(container.textContent).toContain('张三');
      expect(container.textContent).toContain('收获并包装');
    });

    test('应该处理空记录详情', () => {
      const view = traceRecordView.init();
      const container = document.getElementById('trace-detail-container');
      
      view.renderDetail(null, container);
      
      // 检查空状态信息
      expect(container.textContent).toContain('无法加载溯源记录详情');
    });
  });

  describe('状态标签测试', () => {
    test('应该生成正确的状态标签', () => {
      const view = traceRecordView.init();
      
      // 完成状态
      const completedTag = view.renderStatusTag('completed');
      expect(completedTag.className).toContain('status-completed');
      expect(completedTag.textContent).toContain('已完成');
      
      // 运输中状态
      const transitTag = view.renderStatusTag('in-transit');
      expect(transitTag.className).toContain('status-in-transit');
      expect(transitTag.textContent).toContain('运输中');
    });

    test('应该处理未知状态', () => {
      const view = traceRecordView.init();
      
      const unknownTag = view.renderStatusTag('unknown-status');
      expect(unknownTag.className).toContain('status-unknown');
      expect(unknownTag.textContent).toContain('未知状态');
    });
  });

  describe('时间线渲染测试', () => {
    test('应该正确渲染时间线', () => {
      const view = traceRecordView.init();
      const container = document.getElementById('trace-timeline-container');
      
      view.renderTimeline(mockRecords, container);
      
      // 检查时间线项
      const timelineItems = container.querySelectorAll('.timeline-item');
      expect(timelineItems.length).toBe(2);
      
      // 检查时间顺序（最新的在前面）
      const firstItemDate = timelineItems[0].querySelector('.timeline-date').textContent;
      const secondItemDate = timelineItems[1].querySelector('.timeline-date').textContent;
      expect(firstItemDate).toBe('2025-05-15');
      expect(secondItemDate).toBe('2025-05-15');
    });

    test('应该处理空时间线', () => {
      const view = traceRecordView.init();
      const container = document.getElementById('trace-timeline-container');
      
      view.renderTimeline([], container);
      
      // 检查空状态信息
      expect(container.textContent).toContain('暂无溯源记录时间线');
    });
  });
}); 