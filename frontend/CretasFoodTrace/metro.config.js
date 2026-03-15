const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add transformer to handle import.meta
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: false,
  },
});

// Add resolver configuration for web
config.resolver.alias = {
  'react-native': 'react-native-web',
};

// Prefer CJS over ESM to avoid import.meta issues in non-module script context
// (zustand/esm/middleware.mjs uses import.meta.env which fails in Metro web bundles)
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

// Force 'require' condition over 'import' in package.json exports to get CJS builds
config.resolver.unstable_conditionNames = ['react-native', 'require', 'default'];

module.exports = config;