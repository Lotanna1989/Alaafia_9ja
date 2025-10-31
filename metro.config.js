const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// React 19 compatibility
config.resolver.platforms = ['native', 'web', 'android', 'ios'];

// If you have resolver issues
config.resolver.alias = {
  'react-native': 'react-native',
};

module.exports = config;