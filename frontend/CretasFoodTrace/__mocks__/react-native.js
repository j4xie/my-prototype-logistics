/**
 * Manual mock for react-native in Jest node environment.
 * The moduleNameMapper maps all 'react-native*' imports here.
 */
const React = require('react');

const createMockComponent = (name) => {
  const component = ({ children, ...props }) => {
    return React.createElement(name, props, children);
  };
  component.displayName = name;
  return component;
};

module.exports = {
  // Core components
  View: createMockComponent('View'),
  Text: createMockComponent('Text'),
  TouchableOpacity: createMockComponent('TouchableOpacity'),
  TouchableHighlight: createMockComponent('TouchableHighlight'),
  TouchableWithoutFeedback: createMockComponent('TouchableWithoutFeedback'),
  Pressable: createMockComponent('Pressable'),
  ScrollView: createMockComponent('ScrollView'),
  FlatList: createMockComponent('FlatList'),
  SectionList: createMockComponent('SectionList'),
  TextInput: createMockComponent('TextInput'),
  Image: createMockComponent('Image'),
  ImageBackground: createMockComponent('ImageBackground'),
  Modal: createMockComponent('Modal'),
  ActivityIndicator: createMockComponent('ActivityIndicator'),
  Switch: createMockComponent('Switch'),
  KeyboardAvoidingView: createMockComponent('KeyboardAvoidingView'),
  SafeAreaView: createMockComponent('SafeAreaView'),
  StatusBar: createMockComponent('StatusBar'),
  RefreshControl: createMockComponent('RefreshControl'),

  // APIs
  StyleSheet: {
    create: (styles) => styles,
    flatten: (style) => (Array.isArray(style) ? Object.assign({}, ...style) : style || {}),
    hairlineWidth: 0.5,
    absoluteFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
    absoluteFillObject: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  },
  Platform: {
    OS: 'ios',
    select: (obj) => obj.ios || obj.default,
    Version: 14,
  },
  Dimensions: {
    get: () => ({ width: 375, height: 812, scale: 2, fontScale: 1 }),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  Alert: {
    alert: jest.fn(),
  },
  Linking: {
    openURL: jest.fn(() => Promise.resolve()),
    canOpenURL: jest.fn(() => Promise.resolve(true)),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  Animated: {
    View: createMockComponent('Animated.View'),
    Text: createMockComponent('Animated.Text'),
    Image: createMockComponent('Animated.Image'),
    ScrollView: createMockComponent('Animated.ScrollView'),
    FlatList: createMockComponent('Animated.FlatList'),
    Value: jest.fn().mockImplementation(() => ({
      setValue: jest.fn(),
      interpolate: jest.fn(() => ({ __getValue: () => 0 })),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      removeAllListeners: jest.fn(),
      stopAnimation: jest.fn(),
      __getValue: () => 0,
    })),
    timing: jest.fn(() => ({ start: jest.fn((cb) => cb && cb({ finished: true })), stop: jest.fn() })),
    spring: jest.fn(() => ({ start: jest.fn((cb) => cb && cb({ finished: true })), stop: jest.fn() })),
    decay: jest.fn(() => ({ start: jest.fn((cb) => cb && cb({ finished: true })), stop: jest.fn() })),
    parallel: jest.fn(() => ({ start: jest.fn((cb) => cb && cb({ finished: true })), stop: jest.fn() })),
    sequence: jest.fn(() => ({ start: jest.fn((cb) => cb && cb({ finished: true })), stop: jest.fn() })),
    loop: jest.fn(() => ({ start: jest.fn(), stop: jest.fn() })),
    event: jest.fn(() => jest.fn()),
    createAnimatedComponent: (component) => component,
  },
  Keyboard: {
    dismiss: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    removeListener: jest.fn(),
  },
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    removeEventListener: jest.fn(),
  },
  PixelRatio: {
    get: () => 2,
    getFontScale: () => 1,
    getPixelSizeForLayoutSize: (size) => size * 2,
    roundToNearestPixel: (size) => size,
  },
  Easing: {
    linear: jest.fn(),
    ease: jest.fn(),
    bezier: jest.fn(() => jest.fn()),
    in: jest.fn(),
    out: jest.fn(),
    inOut: jest.fn(),
  },
  NativeModules: {},
  NativeEventEmitter: jest.fn().mockImplementation(() => ({
    addListener: jest.fn(),
    removeAllListeners: jest.fn(),
  })),
  useColorScheme: jest.fn(() => 'light'),
  useWindowDimensions: jest.fn(() => ({ width: 375, height: 812, scale: 2, fontScale: 1 })),
  Appearance: {
    getColorScheme: () => 'light',
    addChangeListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  I18nManager: {
    isRTL: false,
  },
  LayoutAnimation: {
    configureNext: jest.fn(),
    create: jest.fn(),
    Types: { spring: 'spring', linear: 'linear', easeInEaseOut: 'easeInEaseOut' },
    Properties: { opacity: 'opacity', scaleXY: 'scaleXY' },
  },
  InteractionManager: {
    runAfterInteractions: jest.fn((cb) => { if (typeof cb === 'function') cb(); return { then: jest.fn(), cancel: jest.fn() }; }),
  },
};
