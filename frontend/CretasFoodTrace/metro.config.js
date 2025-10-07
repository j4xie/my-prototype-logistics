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

module.exports = config;