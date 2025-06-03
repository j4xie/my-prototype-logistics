/**
 * @module config/assets
 * @description 资源管理配置
 */

/**
 * 资源配置
 * @type {Object}
 */
const assetsConfig = {
  // 图像资源配置
  images: {
    // 图像路径配置
    paths: {
      icons: './assets/icons',
      photos: './assets/images',
      logos: './assets/images/logos',
      backgrounds: './assets/images/backgrounds',
      thumbnails: './assets/monitoring/thumbnails'
    },
    // 图像格式配置
    formats: {
      supported: ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'],
      thumbnails: '.webp',
      icons: '.svg'
    },
    // 图像尺寸配置
    sizes: {
      thumbnails: {
        width: 150,
        height: 150
      },
      previews: {
        width: 300,
        height: 300
      },
      default: {
        width: 800,
        height: 600
      }
    }
  },
  
  // 样式资源配置
  styles: {
    // 样式路径配置
    paths: {
      css: './assets/css',
      scss: './assets/styles',
      themes: './assets/styles/themes'
    },
    // 主题配置
    themes: ['light', 'dark', 'highContrast'],
    defaultTheme: 'light'
  },
  
  // 字体资源配置
  fonts: {
    path: './assets/fonts',
    formats: ['.woff2', '.woff', '.ttf'],
    preload: ['main', 'icons']
  },
  
  // 脚本资源配置
  scripts: {
    path: './assets/js',
    modules: './assets/components'
  }
};

/**
 * 获取资源路径
 * @param {string} type - 资源类型
 * @param {string} name - 资源名称
 * @param {Object} options - 额外选项
 * @returns {string} - 资源路径
 */
function getAssetPath(type, name, options = {}) {
  let basePath = '';
  let extension = '';
  
  switch (type) {
    case 'image':
      const category = options.category || 'photos';
      basePath = assetsConfig.images.paths[category] || assetsConfig.images.paths.photos;
      extension = options.format || '.png';
      break;
      
    case 'style':
      const styleType = options.styleType || 'css';
      basePath = assetsConfig.styles.paths[styleType] || assetsConfig.styles.paths.css;
      extension = styleType === 'scss' ? '.scss' : '.css';
      break;
      
    case 'font':
      basePath = assetsConfig.fonts.path;
      extension = options.format || '.woff2';
      break;
      
    case 'script':
      basePath = options.isModule ? assetsConfig.scripts.modules : assetsConfig.scripts.path;
      extension = '.js';
      break;
      
    default:
      throw new Error(`未知的资源类型: ${type}`);
  }
  
  return `${basePath}/${name}${extension}`;
}

/**
 * 验证资源是否存在
 * @param {string} path - 资源路径
 * @returns {boolean} - 资源是否存在
 */
function validateAsset(path) {
  // 在生产环境中，通常使用资源清单验证
  // 在开发环境中，可以直接检查文件系统
  // 此处简化实现，未来可扩展
  try {
    const fs = require('fs');
    return fs.existsSync(path);
  } catch (error) {
    console.warn(`验证资源时出错: ${path}`, error);
    return false;
  }
}

module.exports = {
  assetsConfig,
  getAssetPath,
  validateAsset
}; 