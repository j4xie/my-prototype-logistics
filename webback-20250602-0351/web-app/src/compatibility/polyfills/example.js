/**
 * @file 垫片系统使用示例
 * @description 展示不同场景下垫片系统的使用方法
 * @version 1.0.0
 */

import loadPolyfills, {
  getLoadedPolyfills,
  isPolyfillLoaded,
  getPolyfillMetrics,
  resetPolyfillLoader,
  PolyfillLoader
} from './index';

/**
 * 基本使用示例
 * 自动检测并加载所需垫片
 */
export async function basicUsageExample() {
  console.log('开始加载垫片...');
  
  try {
    // 自动检测并加载所需垫片
    const result = await loadPolyfills({
      debug: true, // 启用调试输出
      autoDetect: true // 自动检测所需垫片（默认为true）
    });
    
    console.log('垫片加载完成:', result);
    console.log('已加载的垫片:', getLoadedPolyfills());
    
    // 检查特定垫片是否已加载
    console.log('Promise垫片已加载:', isPolyfillLoaded('promise'));
    console.log('Fetch垫片已加载:', isPolyfillLoaded('fetch'));
    
    // 获取性能指标
    console.log('加载性能指标:', getPolyfillMetrics());
  } catch (error) {
    console.error('垫片加载失败:', error);
  }
}

/**
 * 指定垫片加载示例
 * 显式指定需要加载的垫片
 */
export async function specifiedPolyfillsExample() {
  console.log('开始加载指定垫片...');
  
  try {
    // 显式指定需要加载的垫片
    const result = await loadPolyfills({
      include: ['promise', 'fetch', 'array-from'],
      exclude: [], // 排除的垫片
      autoDetect: false, // 禁用自动检测
      debug: true
    });
    
    console.log('指定垫片加载完成:', result);
    console.log('已加载的垫片:', getLoadedPolyfills());
  } catch (error) {
    console.error('垫片加载失败:', error);
  }
}

/**
 * 自定义加载器示例
 * 创建自定义配置的加载器实例
 */
export async function customLoaderExample() {
  console.log('创建自定义加载器...');
  
  // 创建自定义加载器
  const loader = new PolyfillLoader({
    debug: true,
    basePath: '/assets/polyfills/',
    timeout: 5000, // 5秒超时
    autoInit: false // 禁用自动初始化
  });
  
  try {
    // 初始化加载器
    await loader.init();
    
    // 加载垫片
    const result = await loader.loadPolyfills({
      include: ['symbol', 'object-assign']
    });
    
    console.log('自定义加载器垫片加载完成:', result);
    console.log('自定义加载器已加载的垫片:', Array.from(loader.loadedPolyfills));
    console.log('自定义加载器性能指标:', loader.getMetrics());
  } catch (error) {
    console.error('自定义加载器垫片加载失败:', error);
  }
}

/**
 * 条件加载示例
 * 根据条件动态加载垫片
 */
export async function conditionalLoadingExample() {
  console.log('开始条件加载垫片...');
  
  // 检查是否需要加载 Promise 垫片
  const needsPromise = typeof window.Promise === 'undefined';
  
  // 检查是否需要加载 fetch 垫片
  const needsFetch = typeof window.fetch === 'undefined';
  
  // 准备需要加载的垫片列表
  const polyfillsToLoad = [];
  
  if (needsPromise) {
    console.log('检测到缺少 Promise 支持，将加载 Promise 垫片');
    polyfillsToLoad.push('promise');
  }
  
  if (needsFetch) {
    console.log('检测到缺少 fetch 支持，将加载 fetch 垫片');
    polyfillsToLoad.push('fetch');
  }
  
  if (polyfillsToLoad.length === 0) {
    console.log('当前环境不需要加载垫片');
    return;
  }
  
  try {
    // 加载所需垫片
    const result = await loadPolyfills({
      include: polyfillsToLoad,
      autoDetect: false,
      debug: true
    });
    
    console.log('条件垫片加载完成:', result);
  } catch (error) {
    console.error('条件垫片加载失败:', error);
  }
}

/**
 * 优先级加载示例
 * 先加载关键垫片，然后加载非关键垫片
 */
export async function priorityLoadingExample() {
  console.log('开始优先级加载垫片...');
  
  try {
    // 先加载关键垫片
    console.log('加载关键垫片...');
    await loadPolyfills({
      include: ['promise', 'fetch'],
      debug: true
    });
    
    console.log('关键垫片加载完成');
    
    // 应用可以在这里开始初始化关键功能
    console.log('应用可以在这里初始化关键功能...');
    
    // 然后加载非关键垫片
    console.log('加载非关键垫片...');
    await loadPolyfills({
      include: ['array-from', 'object-assign', 'symbol'],
      debug: true
    });
    
    console.log('所有垫片加载完成');
    console.log('已加载的垫片:', getLoadedPolyfills());
  } catch (error) {
    console.error('优先级垫片加载失败:', error);
  }
}

/**
 * 加载失败处理示例
 * 演示如何处理垫片加载失败的情况
 */
export async function errorHandlingExample() {
  console.log('测试垫片加载错误处理...');
  
  try {
    // 尝试加载不存在的垫片
    const result = await loadPolyfills({
      include: ['non-existent-polyfill'],
      debug: true
    });
    
    console.log('加载结果:', result);
  } catch (error) {
    console.error('预期的垫片加载错误:', error);
    
    // 错误恢复：加载一些基本垫片
    console.log('尝试恢复加载基本垫片...');
    
    try {
      await loadPolyfills({
        include: ['promise'],
        debug: true
      });
      
      console.log('基本垫片加载成功');
    } catch (fallbackError) {
      console.error('无法加载基本垫片:', fallbackError);
    }
  }
}

/**
 * 重置示例
 * 演示如何重置垫片加载器状态
 */
export async function resetExample() {
  console.log('测试垫片加载器重置...');
  
  // 先加载一些垫片
  await loadPolyfills({
    include: ['promise', 'fetch'],
    debug: true
  });
  
  console.log('初始垫片加载完成');
  console.log('已加载的垫片:', getLoadedPolyfills());
  
  // 重置加载器
  console.log('重置垫片加载器...');
  resetPolyfillLoader();
  
  console.log('重置后已加载的垫片:', getLoadedPolyfills());
  
  // 再次加载垫片
  await loadPolyfills({
    include: ['array-from'],
    debug: true
  });
  
  console.log('重置后加载新垫片完成');
  console.log('最终已加载的垫片:', getLoadedPolyfills());
}

/**
 * 运行所有示例
 */
export async function runAllExamples() {
  console.log('===== 垫片系统使用示例 =====');
  
  await basicUsageExample();
  console.log('\n');
  
  await specifiedPolyfillsExample();
  console.log('\n');
  
  await customLoaderExample();
  console.log('\n');
  
  await conditionalLoadingExample();
  console.log('\n');
  
  await priorityLoadingExample();
  console.log('\n');
  
  await errorHandlingExample();
  console.log('\n');
  
  await resetExample();
  
  console.log('===== 示例运行完成 =====');
}

// 默认导出所有示例
export default {
  basicUsageExample,
  specifiedPolyfillsExample,
  customLoaderExample,
  conditionalLoadingExample,
  priorityLoadingExample,
  errorHandlingExample,
  resetExample,
  runAllExamples
}; 