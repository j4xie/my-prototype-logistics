/**
 * 资源加载器简单测试
 * @jest-environment jsdom
 */

describe('基本测试', () => {
  test('测试环境是否正常工作', () => {
    expect(true).toBe(true);
  });
  
  test('简单的加法运算', () => {
    expect(1 + 1).toBe(2);
  });
}); 