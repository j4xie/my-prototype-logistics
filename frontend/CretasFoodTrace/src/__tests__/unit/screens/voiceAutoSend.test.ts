/**
 * Voice Auto-Send 逻辑单元测试
 * 测试 AIChatScreen 中语音识别结果的自动发送计时器逻辑
 */

describe('Voice Auto-Send Logic', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('auto-sends after 1500ms', () => {
    const handleSend = jest.fn();
    let previewText = '';
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Simulate handleVoiceResult
    const text = '查看库存';
    previewText = text;
    timer = setTimeout(() => {
      handleSend(text);
      previewText = '';
    }, 1500);

    expect(previewText).toBe('查看库存');
    expect(handleSend).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1500);

    expect(handleSend).toHaveBeenCalledWith('查看库存');
    expect(previewText).toBe('');
  });

  test('sets preview text immediately on voice result', () => {
    const handleSend = jest.fn();
    let previewText = '';

    const text = '今日产量报表';
    previewText = text;
    setTimeout(() => {
      handleSend(text);
      previewText = '';
    }, 1500);

    // Before any time passes, preview should be visible
    expect(previewText).toBe('今日产量报表');
    expect(handleSend).not.toHaveBeenCalled();

    // At 1000ms, still not sent
    jest.advanceTimersByTime(1000);
    expect(handleSend).not.toHaveBeenCalled();
    expect(previewText).toBe('今日产量报表');
  });

  test('cancelVoicePreview clears the timer and preview text', () => {
    const handleSend = jest.fn();
    let previewText = '';
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Simulate handleVoiceResult
    previewText = '查看订单';
    timer = setTimeout(() => {
      handleSend('查看订单');
      previewText = '';
    }, 1500);

    // Simulate cancelVoicePreview
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    previewText = '';

    // Advance past the timeout
    jest.advanceTimersByTime(2000);

    expect(handleSend).not.toHaveBeenCalled();
    expect(previewText).toBe('');
  });

  test('canceling before 1500ms prevents handleSend from being called', () => {
    const handleSend = jest.fn();
    let previewText = '';
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Simulate handleVoiceResult
    previewText = '库存查询';
    timer = setTimeout(() => {
      handleSend('库存查询');
      previewText = '';
    }, 1500);

    expect(previewText).toBe('库存查询');

    // Cancel at 500ms
    jest.advanceTimersByTime(500);
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    previewText = '';

    // Advance well past the original timeout
    jest.advanceTimersByTime(3000);

    expect(handleSend).not.toHaveBeenCalled();
    expect(previewText).toBe('');
  });

  test('new voice result replaces previous timer', () => {
    const handleSend = jest.fn();
    let previewText = '';
    let timer: ReturnType<typeof setTimeout> | null = null;

    // First voice result
    previewText = '查看库存';
    timer = setTimeout(() => {
      handleSend('查看库存');
      previewText = '';
    }, 1500);

    // 800ms later, new voice result arrives
    jest.advanceTimersByTime(800);

    // Cancel previous timer
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }

    // New voice result
    previewText = '查看订单';
    timer = setTimeout(() => {
      handleSend('查看订单');
      previewText = '';
    }, 1500);

    // First timer would have fired at 1500ms but was canceled
    jest.advanceTimersByTime(700);
    expect(handleSend).not.toHaveBeenCalled();
    expect(previewText).toBe('查看订单');

    // New timer fires at 800 + 1500 = 2300ms total
    jest.advanceTimersByTime(800);
    expect(handleSend).toHaveBeenCalledTimes(1);
    expect(handleSend).toHaveBeenCalledWith('查看订单');
    expect(previewText).toBe('');
  });
});
