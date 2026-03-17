import { registerRootComponent } from 'expo';
import { LogBox } from 'react-native';

// 忽略开发环境中的非关键警告，避免 LogBox 覆盖 UI 影响 E2E 测试
LogBox.ignoreLogs([
  'Invalid prop',
  'Load RFM data failed',
  'Animated:',
  'props.pointerEvents',
  'shadow*',
  'textShadow*',
]);

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
