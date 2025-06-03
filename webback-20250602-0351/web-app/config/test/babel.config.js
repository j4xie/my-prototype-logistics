/**
 * @file config/test/babel.config.js
 * @description 测试环境专用的Babel配置
 */

module.exports = {
  presets: [
    [
      '@babel/preset-env', 
      {
        targets: {
          node: 'current',
        },
        // 设置为auto，让Babel自动判断如何处理模块
        modules: 'auto'
      }
    ],
    '@babel/preset-react'
  ],
  plugins: [
    '@babel/plugin-transform-runtime',
    '@babel/plugin-proposal-class-properties',
    '@babel/plugin-proposal-object-rest-spread',
  ]
}; 