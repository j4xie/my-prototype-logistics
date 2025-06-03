/**
 * @file 浏览器垫片集成示例
 * @description 展示如何基于浏览器检测结果加载特定垫片
 * @version 1.0.0
 */

import { browserDetectorInstance } from '../browser-detector';
import loadPolyfills, { 
  getLoadedPolyfills, 
  isPolyfillLoaded,
  resetPolyfillLoader
} from '../polyfills';

/**
 * 基于浏览器类型加载垫片示例
 * 展示如何为不同浏览器加载特定垫片
 */
export async function browserBasedPolyfillsExample() {
  console.log('开始浏览器特定垫片加载...');
  
  try {
    // 获取浏览器检测结果
    const features = browserDetectorInstance.detect();
    console.log('检测到的浏览器特性:', features);
    
    // 准备需要加载的垫片
    const polyfillsToLoad = [];
    
    // IE浏览器特殊处理
    if (features.isIE) {
      console.log('检测到IE浏览器，版本:', features.version);
      
      polyfillsToLoad.push('promise', 'fetch', 'symbol', 'array-from', 'object-assign', 'classlist', 'raf');
      
      // IE9特殊处理
      if (parseInt(features.version, 10) <= 9) {
        polyfillsToLoad.push('ie-xhr');
      }
    }
    // Safari浏览器特殊处理
    else if (features.isSafari) {
      console.log('检测到Safari浏览器，版本:', features.version);
      
      // Safari私有浏览模式存储问题修复
      if (features.isPrivateMode) {
        polyfillsToLoad.push('safari-storage');
      }
      
      // 旧版Safari特殊处理
      if (parseInt(features.version, 10) < 10) {
        polyfillsToLoad.push('promise', 'fetch');
      }
    }
    // Chrome浏览器特殊处理
    else if (features.isChrome && parseInt(features.version, 10) < 49) {
      console.log('检测到旧版Chrome浏览器');
      polyfillsToLoad.push('promise');
    }
    // Firefox浏览器特殊处理
    else if (features.isFirefox && parseInt(features.version, 10) < 40) {
      console.log('检测到旧版Firefox浏览器');
      polyfillsToLoad.push('promise', 'fetch');
    }
    
    // 移动设备特殊处理
    if (features.isMobile) {
      console.log('检测到移动设备');
      
      // 老旧Android浏览器
      if (features.isAndroid && !features.isChrome) {
        polyfillsToLoad.push('promise', 'fetch', 'object-assign');
      }
      
      // 低端设备优化
      if (features.isLowMemoryDevice) {
        console.log('检测到低内存设备，使用轻量级垫片');
        // 可以在这里选择加载更轻量的垫片版本
      }
    }
    
    // 去除重复项
    const uniquePolyfills = [...new Set(polyfillsToLoad)];
    
    if (uniquePolyfills.length === 0) {
      console.log('当前浏览器不需要特殊垫片');
      return;
    }
    
    console.log('根据浏览器特性，准备加载垫片:', uniquePolyfills);
    
    // 加载垫片
    const result = await loadPolyfills({
      include: uniquePolyfills,
      autoDetect: false,
      debug: true
    });
    
    console.log('浏览器特定垫片加载完成:', result);
    console.log('已加载的垫片:', getLoadedPolyfills());
  } catch (error) {
    console.error('垫片加载失败:', error);
  }
}

/**
 * 基于功能支持加载垫片示例
 * 展示如何检测特定功能并加载所需垫片
 */
export async function featureBasedPolyfillsExample() {
  console.log('开始基于功能检测的垫片加载...');
  
  try {
    // 获取浏览器功能支持情况
    const features = browserDetectorInstance.detect();
    const polyfillsToLoad = [];
    
    // 检查各种功能支持
    if (!features.supportsPromise) {
      console.log('Promise不支持，需要加载垫片');
      polyfillsToLoad.push('promise');
    }
    
    if (!features.supportsFetch) {
      console.log('Fetch API不支持，需要加载垫片');
      polyfillsToLoad.push('fetch');
    }
    
    if (!features.supportsLocalStorage) {
      console.log('localStorage不支持，需要加载垫片');
      polyfillsToLoad.push('localstorage');
    }
    
    if (!features.supportsIndexedDB) {
      console.log('IndexedDB不支持，需要加载垫片');
      polyfillsToLoad.push('indexeddb');
    }
    
    if (!features.supportsRequestAnimationFrame) {
      console.log('requestAnimationFrame不支持，需要加载垫片');
      polyfillsToLoad.push('raf');
    }
    
    // 去除重复项并加载垫片
    const uniquePolyfills = [...new Set(polyfillsToLoad)];
    
    if (uniquePolyfills.length === 0) {
      console.log('当前浏览器支持所有检测的功能，无需加载垫片');
      return;
    }
    
    console.log('根据功能检测，准备加载垫片:', uniquePolyfills);
    
    // 加载垫片
    const result = await loadPolyfills({
      include: uniquePolyfills,
      autoDetect: false,
      debug: true
    });
    
    console.log('功能垫片加载完成:', result);
  } catch (error) {
    console.error('功能垫片加载失败:', error);
  }
}

/**
 * 自定义检测与垫片加载策略示例
 * 展示如何创建自定义的垫片加载策略
 */
export async function customDetectionPolyfillLoaderExample() {
  console.log('开始自定义垫片加载策略...');
  
  try {
    // 获取浏览器特性
    const features = browserDetectorInstance.detect();
    
    // 创建自定义策略
    let strategy = 'standard';
    const priorityPolyfills = [];
    const secondaryPolyfills = [];
    
    // 根据浏览器和设备类型确定策略
    if (features.isIE || (features.isSafari && parseInt(features.version, 10) < 10)) {
      strategy = 'legacy';
      priorityPolyfills.push('promise', 'fetch', 'symbol');
      secondaryPolyfills.push('array-from', 'object-assign', 'classlist');
    } else if (features.isChrome && parseInt(features.version, 10) >= 60) {
      strategy = 'modern';
      // 现代Chrome几乎不需要垫片
    } else if (features.isMobile) {
      strategy = 'mobile';
      
      if (features.isLowMemoryDevice) {
        // 低端移动设备只加载关键垫片
        priorityPolyfills.push('promise', 'fetch');
      } else {
        // 普通移动设备
        priorityPolyfills.push('promise', 'fetch');
        secondaryPolyfills.push('array-from', 'object-assign');
      }
    }
    
    console.log(`使用 "${strategy}" 垫片加载策略`);
    
    // 首先加载优先级高的垫片
    if (priorityPolyfills.length > 0) {
      console.log('加载优先级高的垫片:', priorityPolyfills);
      await loadPolyfills({
        include: priorityPolyfills,
        autoDetect: false,
        debug: true
      });
    }
    
    // 然后加载次要垫片
    if (secondaryPolyfills.length > 0) {
      console.log('加载次要垫片:', secondaryPolyfills);
      await loadPolyfills({
        include: secondaryPolyfills,
        autoDetect: false,
        debug: true
      });
    }
    
    console.log('自定义垫片策略加载完成');
    console.log('已加载的垫片:', getLoadedPolyfills());
  } catch (error) {
    console.error('自定义垫片加载失败:', error);
  }
}

/**
 * 基于性能评估的垫片加载优化示例
 * 展示如何根据设备性能优化垫片加载
 */
export async function optimizedPerformanceExample() {
  console.log('开始基于性能的垫片加载优化...');
  
  try {
    // 获取设备性能评估
    const features = browserDetectorInstance.detect();
    const performance = features.devicePerformanceLevel || 'medium';
    
    console.log(`设备性能级别: ${performance}`);
    console.log(`性能分数: ${features.performanceScore}`);
    console.log(`是否低端设备: ${features.isLowEndDevice ? '是' : '否'}`);
    
    // 根据性能级别确定加载策略
    if (features.isLowEndDevice || performance === 'low' || performance === 'medium-low') {
      console.log('检测到低端设备，采用轻量级垫片策略');
      
      // 只加载最关键的垫片
      const criticalPolyfills = ['promise', 'fetch'].filter(p => !isPolyfillLoaded(p));
      
      if (criticalPolyfills.length > 0) {
        console.log('加载关键垫片:', criticalPolyfills);
        await loadPolyfills({
          include: criticalPolyfills,
          autoDetect: false,
          debug: true
        });
      }
      
      // 其他垫片在需要时才加载（懒加载策略）
      console.log('其他垫片将在需要时懒加载');
    } else {
      console.log('检测到标准或高性能设备，采用完整垫片策略');
      
      // 可以加载更全面的垫片
      await loadPolyfills({
        autoDetect: true, // 自动检测所需的所有垫片
        debug: true
      });
      
      console.log('已完成所有垫片加载');
    }
  } catch (error) {
    console.error('优化垫片加载失败:', error);
  }
}

/**
 * 运行所有垫片示例
 */
export async function runAllExamples() {
  // 先重置垫片加载器状态
  resetPolyfillLoader();
  
  try {
    console.log('=== 1. 基于浏览器类型的垫片加载 ===');
    await browserBasedPolyfillsExample();
    console.log('\n');
    
    console.log('=== 2. 基于功能支持的垫片加载 ===');
    await featureBasedPolyfillsExample();
    console.log('\n');
    
    console.log('=== 3. 自定义垫片加载策略 ===');
    await customDetectionPolyfillLoaderExample();
    console.log('\n');
    
    console.log('=== 4. 基于性能优化的垫片加载 ===');
    await optimizedPerformanceExample();
  } catch (error) {
    console.error('运行示例时出错:', error);
  }
}

// 默认导出所有示例函数
export default {
  browserBasedPolyfillsExample,
  featureBasedPolyfillsExample,
  customDetectionPolyfillLoaderExample,
  optimizedPerformanceExample,
  runAllExamples
}; 