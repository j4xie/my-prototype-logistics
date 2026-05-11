import axios from 'axios';
import Toast from 'react-native-toast-message';
import Constants from 'expo-constants';
import { API_BASE_URL } from '../constants/config';
import { logger } from '../utils/logger';
import { compareSemver } from './compareSemver';

export { compareSemver };

const versionLogger = logger.createContextLogger('AppVersionCheck');

interface HealthResponse {
  status: string;
  timestamp: number;
  appMinVersion?: string;
}

/**
 * Fetch /api/mobile/health and compare server's appMinVersion against this
 * app's installed version (Constants.expoConfig.version).
 *
 * If installed < min: show non-dismissable update Toast.
 * Errors (network / parse / missing field) are logged and silently ignored —
 * version check failure must never block app startup.
 *
 * Per PR #309 B5.
 */
export async function checkAppMinVersion(): Promise<void> {
  try {
    const currentVersion =
      (Constants.expoConfig?.version as string | undefined) ?? '0.0.0';

    // Bare axios call (no auth required, /health is public).
    // Don't reuse apiClient — its interceptor unwraps response.data, which would
    // strip the envelope we need. Plus we want to fail silently independent of
    // the auth flow.
    const resp = await axios.get<HealthResponse>(`${API_BASE_URL}/api/mobile/health`, {
      timeout: 10000,
    });

    const minVersion = resp.data?.appMinVersion;
    if (!minVersion) {
      versionLogger.debug('Server did not return appMinVersion, skipping check');
      return;
    }

    versionLogger.info(`App version check: current=${currentVersion}, min=${minVersion}`);

    if (compareSemver(currentVersion, minVersion) < 0) {
      Toast.show({
        type: 'error',
        text1: '请更新版本',
        text2: `当前版本 ${currentVersion} 已过旧，请更新到 ${minVersion} 或更高版本`,
        autoHide: false,
        position: 'top',
        topOffset: 60,
      });
      versionLogger.warn(
        `App version ${currentVersion} is below minimum ${minVersion}, prompted update`
      );
    }
  } catch (err) {
    // Silent fail — version check must not block app startup.
    versionLogger.warn('App version check failed (non-fatal)', err);
  }
}
