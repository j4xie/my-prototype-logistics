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
          browsers: [
            "last 2 Chrome versions",
            "last 2 Firefox versions", 
            "last 2 Safari versions",
            "last 2 Edge versions"
          ]
        },
        modules: 'auto'
      },
    ],
  ],
  plugins: [],
}; 