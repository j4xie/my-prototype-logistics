module.exports = function(api) {
  api.cache(true);
  
  const presets = ['babel-preset-expo'];
  
  const plugins = [];
  
  // Add import.meta transformation for web
  if (process.env.BABEL_ENV === 'web' || process.env.NODE_ENV === 'web') {
    plugins.push(
      ['@babel/plugin-transform-modules-commonjs', { allowTopLevelThis: true }],
      ['babel-plugin-transform-import-meta', { module: 'ES6' }]
    );
  }

  return {
    presets,
    plugins,
  };
};