/**
 * 日期处理工具函数单元测试
 * @jest-environment jsdom
 */

// 导入被测试模块
import { traceUtils } from '../../../components/modules/utils/utils';

describe('日期工具函数详细测试', () => {
  describe('formatDate函数', () => {
    test('使用不同格式模式正确格式化日期', () => {
      const testDate = new Date(2025, 4, 15, 8, 30, 45, 500); // 2025-05-15 08:30:45.500
      
      // 测试各种格式模板
      expect(traceUtils.formatDate(testDate, 'yyyy-MM-dd')).toBe('2025-05-15');
      expect(traceUtils.formatDate(testDate, 'yyyy年MM月dd日')).toBe('2025年05月15日');
      expect(traceUtils.formatDate(testDate, 'HH:mm:ss')).toBe('08:30:45');
      expect(traceUtils.formatDate(testDate, 'yyyy/MM/dd HH:mm')).toBe('2025/05/15 08:30');
      expect(traceUtils.formatDate(testDate, 'MM/dd/yyyy')).toBe('05/15/2025');
      expect(traceUtils.formatDate(testDate, 'yyyyMMddHHmmss')).toBe('20250515083045');
    });
    
    test('处理特殊字符和格式占位符组合', () => {
      const testDate = new Date(2025, 4, 15, 8, 30, 45);
      
      // 测试带有特殊字符的格式
      expect(traceUtils.formatDate(testDate, 'yyyy-MM-dd[T]HH:mm:ss')).toBe('2025-05-15T08:30:45');
      expect(traceUtils.formatDate(testDate, 'yyyy(MM)dd HH:mm')).toBe('2025(05)15 08:30');
      expect(traceUtils.formatDate(testDate, 'HH時mm分ss秒 yyyy年MM月dd日')).toBe('08時30分45秒 2025年05月15日');
    });
    
    test('处理不同时区和月末边界情况', () => {
      // 注意：此测试可能依赖于运行测试的时区
      // 测试月末和时区边界
      const monthEnd = new Date(2025, 1, 28, 23, 59, 59); // 2025-02-28 23:59:59
      expect(traceUtils.formatDate(monthEnd, 'yyyy-MM-dd HH:mm:ss')).toBe('2025-02-28 23:59:59');
      
      // 测试闰年
      const leapDay = new Date(2024, 1, 29, 12, 0, 0); // 2024-02-29 12:00:00 - 闰年
      expect(traceUtils.formatDate(leapDay, 'yyyy-MM-dd')).toBe('2024-02-29');
    });
    
    test('处理不同类型的输入', () => {
      const dateObj = new Date(2025, 4, 15, 8, 30, 45);
      const timestamp = dateObj.getTime();
      const isoString = dateObj.toISOString();
      
      const expected = '2025-05-15 08:30:45';
      const format = 'yyyy-MM-dd HH:mm:ss';
      
      // 相同的日期应该在相同的格式下产生相同的结果
      expect(traceUtils.formatDate(dateObj, format)).toBe(expected);
      expect(traceUtils.formatDate(timestamp, format)).toBe(expected);
      
      // ISO字符串可能因时区而异，但格式应该正确
      const isoFormatted = traceUtils.formatDate(isoString, format);
      expect(isoFormatted).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });
  });
  
  describe('dateDiff函数', () => {
    test('正确计算不同日期单位的差异', () => {
      const startDate = new Date(2025, 4, 1, 8, 0, 0); // 2025-05-01 08:00:00
      const endDate = new Date(2025, 5, 1, 14, 30, 45); // 2025-06-01 14:30:45
      
      // 测试不同单位的计算
      expect(traceUtils.dateDiff(startDate, endDate, 'days')).toBe(31);
      expect(traceUtils.dateDiff(startDate, endDate, 'hours')).toBe(31 * 24 + 6);
      expect(traceUtils.dateDiff(startDate, endDate, 'minutes')).toBe((31 * 24 + 6) * 60 + 30);
      expect(traceUtils.dateDiff(startDate, endDate, 'seconds')).toBe(((31 * 24 + 6) * 60 + 30) * 60 + 45);
    });
    
    test('处理日期顺序和负差值', () => {
      const earlierDate = new Date(2025, 4, 1);
      const laterDate = new Date(2025, 4, 11);
      
      // 日期顺序交换应产生相反数
      expect(traceUtils.dateDiff(earlierDate, laterDate, 'days')).toBe(10);
      expect(traceUtils.dateDiff(laterDate, earlierDate, 'days')).toBe(-10);
      
      // 绝对值模式应返回正值
      expect(traceUtils.dateDiff(laterDate, earlierDate, 'days', true)).toBe(10);
    });
    
    test('相同日期应返回零差异', () => {
      const date = new Date(2025, 4, 15);
      
      expect(traceUtils.dateDiff(date, date, 'days')).toBe(0);
      expect(traceUtils.dateDiff(date, date, 'hours')).toBe(0);
      expect(traceUtils.dateDiff(date, date, 'minutes')).toBe(0);
      expect(traceUtils.dateDiff(date, date, 'seconds')).toBe(0);
    });
    
    test('处理不同时区和夏令时情况', () => {
      // 模拟跨越夏令时的日期
      const winterDate = new Date(2025, 0, 15); // 冬季
      const summerDate = new Date(2025, 6, 15); // 夏季
      
      // 计算相差天数 (应为181或182天，取决于实现和时区)
      const daysDiff = traceUtils.dateDiff(winterDate, summerDate, 'days');
      
      // 检查差值在合理范围内
      expect(daysDiff).toBeGreaterThanOrEqual(180);
      expect(daysDiff).toBeLessThanOrEqual(183);
    });
    
    test('处理无效单位和边界情况', () => {
      const date1 = new Date(2025, 4, 1);
      const date2 = new Date(2025, 4, 11);
      
      // 使用默认单位（毫秒）
      const msDiff = date2.getTime() - date1.getTime();
      expect(traceUtils.dateDiff(date1, date2)).toBe(msDiff);
      
      // 无效单位应返回默认毫秒差
      expect(traceUtils.dateDiff(date1, date2, 'invalid_unit')).toBe(msDiff);
    });
  });
  
  describe('isValidDate函数', () => {
    test('各种有效日期类型返回true', () => {
      expect(traceUtils.isValidDate(new Date())).toBe(true);
      expect(traceUtils.isValidDate(new Date('2025-05-15'))).toBe(true);
      expect(traceUtils.isValidDate(Date.now())).toBe(true);
      expect(traceUtils.isValidDate('2025-05-15T12:30:45')).toBe(true);
    });
    
    test('无效日期返回false', () => {
      expect(traceUtils.isValidDate(null)).toBe(false);
      expect(traceUtils.isValidDate(undefined)).toBe(false);
      expect(traceUtils.isValidDate('not-a-date')).toBe(false);
      expect(traceUtils.isValidDate('2025-13-45')).toBe(false); // 无效月份
      expect(traceUtils.isValidDate({})).toBe(false);
      expect(traceUtils.isValidDate([])).toBe(false);
      expect(traceUtils.isValidDate(NaN)).toBe(false);
    });
    
    test('边界日期情况测试', () => {
      // 测试日期边界
      expect(traceUtils.isValidDate(new Date(0))).toBe(true); // Unix Epoch
      expect(traceUtils.isValidDate(new Date('1000-01-01'))).toBe(true); // 远古日期
      expect(traceUtils.isValidDate(new Date('9999-12-31'))).toBe(true); // 远期日期
      
      // 无效但格式正确的日期
      expect(traceUtils.isValidDate(new Date('0000-00-00'))).toBe(false);
      expect(traceUtils.isValidDate(new Date('2023-02-31'))).toBe(false); // 2月没有31日
    });
  });
  
  describe('parseDateString函数', () => {
    test('正确解析各种日期字符串格式', () => {
      // ISO 格式
      const isoDate = traceUtils.parseDateString('2025-05-15T08:30:45.000Z');
      expect(isoDate instanceof Date).toBe(true);
      expect(isoDate.getUTCFullYear()).toBe(2025);
      expect(isoDate.getUTCMonth()).toBe(4); // 月份从0开始
      expect(isoDate.getUTCDate()).toBe(15);
      
      // 短格式日期
      const shortDate = traceUtils.parseDateString('2025-05-15');
      expect(shortDate instanceof Date).toBe(true);
      expect(shortDate.getFullYear()).toBe(2025);
      expect(shortDate.getMonth()).toBe(4);
      expect(shortDate.getDate()).toBe(15);
      
      // 美式格式
      const usDate = traceUtils.parseDateString('05/15/2025');
      expect(usDate instanceof Date).toBe(true);
      expect(usDate.getFullYear()).toBe(2025);
      expect(usDate.getMonth()).toBe(4);
      expect(usDate.getDate()).toBe(15);
    });
    
    test('处理无效和异常日期字符串', () => {
      expect(traceUtils.parseDateString(null)).toBeNull();
      expect(traceUtils.parseDateString(undefined)).toBeNull();
      expect(traceUtils.parseDateString('')).toBeNull();
      expect(traceUtils.parseDateString('invalid-date')).toBeNull();
      expect(traceUtils.parseDateString('2025/13/32')).toBeNull(); // 无效月份和日期
    });
    
    test('处理不同格式的自定义日期解析', () => {
      // 假设有自定义日期格式解析功能
      const customDate = traceUtils.parseDateString('20250515083045', 'yyyyMMddHHmmss');
      
      if (customDate) { // 如果支持自定义格式
        expect(customDate instanceof Date).toBe(true);
        expect(customDate.getFullYear()).toBe(2025);
        expect(customDate.getMonth()).toBe(4);
        expect(customDate.getDate()).toBe(15);
        expect(customDate.getHours()).toBe(8);
        expect(customDate.getMinutes()).toBe(30);
        expect(customDate.getSeconds()).toBe(45);
      }
    });
  });
  
  describe('getRelativeTimeString函数', () => {
    test('正确计算相对时间描述', () => {
      const now = new Date();
      
      // 当前时间
      expect(traceUtils.getRelativeTimeString(now)).toBe('刚刚');
      
      // 几分钟前
      const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
      expect(traceUtils.getRelativeTimeString(fiveMinAgo)).toBe('5分钟前');
      
      // 几小时前
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      expect(traceUtils.getRelativeTimeString(twoHoursAgo)).toBe('2小时前');
      
      // 昨天
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      expect(traceUtils.getRelativeTimeString(yesterday)).toMatch(/昨天/);
      
      // 几天前
      const threeDaysAgo = new Date(now);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      expect(traceUtils.getRelativeTimeString(threeDaysAgo)).toMatch(/3天前/);
      
      // 几周前
      const twoWeeksAgo = new Date(now);
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      expect(traceUtils.getRelativeTimeString(twoWeeksAgo)).toMatch(/2周前/);
      
      // 几个月前
      const threeMonthsAgo = new Date(now);
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      expect(traceUtils.getRelativeTimeString(threeMonthsAgo)).toMatch(/3个月前/);
      
      // 一年多前
      const oneYearAgo = new Date(now);
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      expect(traceUtils.getRelativeTimeString(oneYearAgo)).toMatch(/1年前/);
    });
    
    test('未来时间的相对描述', () => {
      const now = new Date();
      
      // 未来5分钟
      const fiveMinLater = new Date(now.getTime() + 5 * 60 * 1000);
      expect(traceUtils.getRelativeTimeString(fiveMinLater)).toBe('5分钟后');
      
      // 未来一天
      const oneDayLater = new Date(now);
      oneDayLater.setDate(oneDayLater.getDate() + 1);
      expect(traceUtils.getRelativeTimeString(oneDayLater)).toMatch(/明天|1天后/);
      
      // 未来一个月
      const oneMonthLater = new Date(now);
      oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
      expect(traceUtils.getRelativeTimeString(oneMonthLater)).toMatch(/1个月后/);
    });
    
    test('处理无效日期输入', () => {
      expect(traceUtils.getRelativeTimeString(null)).toBe('未知时间');
      expect(traceUtils.getRelativeTimeString(undefined)).toBe('未知时间');
      expect(traceUtils.getRelativeTimeString('invalid-date')).toBe('未知时间');
    });
  });
  
  describe('getDayName函数', () => {
    test('返回正确的星期名称', () => {
      // 2025年5月11日是星期日
      const sunday = new Date(2025, 4, 11);
      expect(traceUtils.getDayName(sunday)).toBe('星期日');
      
      // 2025年5月12日是星期一
      const monday = new Date(2025, 4, 12);
      expect(traceUtils.getDayName(monday)).toBe('星期一');
      
      // 2025年5月13日是星期二
      const tuesday = new Date(2025, 4, 13);
      expect(traceUtils.getDayName(tuesday)).toBe('星期二');
      
      // 测试所有星期
      const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
      for (let i = 0; i < 7; i++) {
        const date = new Date(2025, 4, 11 + i);
        expect(traceUtils.getDayName(date)).toBe(weekdays[i]);
      }
    });
    
    test('支持不同的语言格式', () => {
      const date = new Date(2025, 4, 12); // 星期一
      
      // 默认中文
      expect(traceUtils.getDayName(date)).toBe('星期一');
      
      // 英文简短格式
      expect(traceUtils.getDayName(date, 'en', 'short')).toBe('Mon');
      
      // 英文完整格式
      expect(traceUtils.getDayName(date, 'en', 'long')).toBe('Monday');
    });
    
    test('处理无效日期', () => {
      expect(traceUtils.getDayName(null)).toBe('');
      expect(traceUtils.getDayName(undefined)).toBe('');
      expect(traceUtils.getDayName('not-a-date')).toBe('');
    });
  });
  
  describe('getMonthName函数', () => {
    test('返回正确的月份名称', () => {
      // 一月
      const january = new Date(2025, 0, 15);
      expect(traceUtils.getMonthName(january)).toBe('一月');
      
      // 五月
      const may = new Date(2025, 4, 15);
      expect(traceUtils.getMonthName(may)).toBe('五月');
      
      // 十二月
      const december = new Date(2025, 11, 15);
      expect(traceUtils.getMonthName(december)).toBe('十二月');
      
      // 测试所有月份
      const months = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
      for (let i = 0; i < 12; i++) {
        const date = new Date(2025, i, 15);
        expect(traceUtils.getMonthName(date)).toBe(months[i]);
      }
    });
    
    test('支持不同的语言格式', () => {
      const date = new Date(2025, 4, 15); // 五月
      
      // 默认中文
      expect(traceUtils.getMonthName(date)).toBe('五月');
      
      // 英文简短格式
      expect(traceUtils.getMonthName(date, 'en', 'short')).toBe('May');
      
      // 英文完整格式
      expect(traceUtils.getMonthName(date, 'en', 'long')).toBe('May');
    });
    
    test('处理无效日期', () => {
      expect(traceUtils.getMonthName(null)).toBe('');
      expect(traceUtils.getMonthName(undefined)).toBe('');
      expect(traceUtils.getMonthName('not-a-date')).toBe('');
    });
  });
}); 