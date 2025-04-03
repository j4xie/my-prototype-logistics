// 资源路径配置文件
// 版本: 1.0.0

const assetsConfig = {
  // 基础URL配置
  baseUrl: '/assets',
  
  // 图标资源
  icons: {
    base: '/assets/icons',
    paths: {
      home: {
        gray: '/home-gray.svg',
        blue: '/home-blue.svg'
      },
      record: {
        gray: '/record-gray.svg',
        blue: '/record-blue.svg'
      },
      user: {
        gray: '/user-gray.svg',
        blue: '/user-blue.svg'
      },
      info: {
        blue: '/info-blue.svg'
      }
    }
  },
  
  // 样式文件
  styles: {
    base: '/assets/styles',
    common: '/styles.css',
    modules: {
      processing: '/styles.css',
      admin: '/styles.css'
    }
  },
  
  // JavaScript模块
  scripts: {
    base: '/components',
    core: [
      '/trace-core.js',
      '/trace-ui.js',
      '/trace-scanner.js',
      '/trace-map.js',
      '/trace-blockchain.js',
      '/config-manager.js'
    ],
    modules: {
      performance: '/trace-performance.js',
      common: '/trace-common.js',
      validation: '/trace-form-validation.js'
    }
  },
  
  // 图片资源
  images: {
    base: '/assets/images',
    monitor: {
      placeholder: '/monitor-placeholder.jpg',
      thumbs: [
        '/monitor-thumb1.jpg',
        '/monitor-thumb2.jpg',
        '/monitor-thumb3.jpg',
        '/monitor-thumb4.jpg'
      ]
    }
  },
  
  // 模块资源路径映射 - 统一处理各个目录下的资源请求
  moduleAssets: {
    farming: {
      icons: '/assets/icons',
      styles: '/assets/styles',
      images: '/assets/images',
      components: '/components'
    },
    processing: {
      icons: '/assets/icons',
      styles: '/assets/styles',
      images: '/assets/images',
      components: '/components'
    },
    logistics: {
      icons: '/assets/icons',
      styles: '/assets/styles',
      images: '/assets/images',
      components: '/components'
    },
    admin: {
      icons: '/assets/icons',
      styles: '/assets/styles',
      components: '/components'
    },
    profile: {
      icons: '/assets/icons',
      styles: '/assets/styles',
      components: '/components'
    }
  }
};

// 资源路径获取函数
const getAssetPath = (type, name, module) => {
  // 如果指定了模块，尝试从模块资源映射获取
  if (module && assetsConfig.moduleAssets && assetsConfig.moduleAssets[module]) {
    const moduleConfig = assetsConfig.moduleAssets[module];
    if (moduleConfig[type]) {
      return `${moduleConfig[type]}${name}`;
    }
  }
  
  const config = assetsConfig[type];
  if (!config) throw new Error(`未知的资源类型: ${type}`);
  
  if (typeof name === 'string') {
    return `${config.base}${name}`;
  }
  
  return config;
};

// 验证资源是否存在
const validateAsset = async (path) => {
  try {
    const response = await fetch(path);
    return response.ok;
  } catch (error) {
    console.error(`资源验证失败: ${path}`, error);
    return false;
  }
};

module.exports = {
  assetsConfig,
  getAssetPath,
  validateAsset
}; 