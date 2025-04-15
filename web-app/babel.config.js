/**
 * Babel配置文件
 * 用于支持Jest测试中的ES模块和新特性
 */

module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          node: 'current',
        },
      },
    ],
  ],
  plugins: [],
}; 