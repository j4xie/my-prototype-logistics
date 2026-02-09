module.exports = function(api) {
  api.cache(true);

  const presets = ['babel-preset-expo'];

  const plugins = [
    // Add react-native-dotenv for environment variable management
    [
      'module:react-native-dotenv',
      {
        moduleName: '@env',
        path: '.env',
        safe: false,
        allowUndefined: true,
        verbose: false,
      },
    ],
  ];

  // Transform import.meta for web compatibility (Zustand devtools uses import.meta.env)
  plugins.push('babel-plugin-transform-import-meta');

  return {
    presets,
    plugins,
  };
};