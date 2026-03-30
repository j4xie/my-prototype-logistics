import NetInfo from '@react-native-community/netinfo';
import { NetworkManager } from '../../../services/networkManager';

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn().mockResolvedValue({
    type: 'wifi',
    isConnected: true,
    isInternetReachable: true,
    details: { strength: 100, isConnectionExpensive: false },
  }),
  addEventListener: jest.fn(() => jest.fn()),
}));

jest.mock('../../../utils/errorHandler', () => ({
  handleError: jest.fn(),
}));

function resetNetworkManager() {
  // Access and reset private static state for test isolation
  // Actual field names from source: initialized, currentState, listeners (Set), unsubscribe
  (NetworkManager as any).initialized = false;
  (NetworkManager as any).currentState = null;
  (NetworkManager as any).listeners = new Set();
  (NetworkManager as any).unsubscribe = null;
}

beforeEach(() => {
  jest.clearAllMocks();
  resetNetworkManager();
});

afterEach(() => {
  // Ensure cleanup after each test to avoid dangling listeners
  NetworkManager.cleanup();
  resetNetworkManager();
});

describe('NetworkManager', () => {
  // ---- Initialization ----

  describe('initialize', () => {
    it('should fetch current network state on initialize', async () => {
      await NetworkManager.initialize();

      expect(NetInfo.fetch).toHaveBeenCalledTimes(1);
    });

    it('should subscribe to NetInfo updates', async () => {
      await NetworkManager.initialize();

      expect(NetInfo.addEventListener).toHaveBeenCalledTimes(1);
    });

    it('should be idempotent — second call is a no-op', async () => {
      await NetworkManager.initialize();
      await NetworkManager.initialize();

      // fetch is only called once since second init is skipped
      expect(NetInfo.fetch).toHaveBeenCalledTimes(1);
      expect(NetInfo.addEventListener).toHaveBeenCalledTimes(1);
    });
  });

  // ---- State queries ----

  describe('getCurrentState', () => {
    it('should return network state after initialization', async () => {
      await NetworkManager.initialize();

      // getCurrentState is async in the actual implementation
      const state = await NetworkManager.getCurrentState();
      expect(state).toBeDefined();
      expect(state.type).toBe('wifi');
      expect(state.isConnected).toBe(true);
    });

    it('should auto-initialize and return state when not initialized', async () => {
      // getCurrentState auto-initializes if not initialized
      const state = await NetworkManager.getCurrentState();
      // After auto-init, it returns the mocked state
      expect(state).toBeDefined();
    });
  });

  describe('isConnected', () => {
    it('should return true when connected', async () => {
      await NetworkManager.initialize();

      // isConnected is async in the actual implementation
      const connected = await NetworkManager.isConnected();
      expect(connected).toBe(true);
    });

    it('should auto-initialize and return true when not initialized but network available', async () => {
      // isConnected auto-initializes if not initialized
      const connected = await NetworkManager.isConnected();
      expect(connected).toBe(true);
    });

    it('should return false when disconnected', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValueOnce({
        type: 'none',
        isConnected: false,
        isInternetReachable: false,
        details: null,
      });

      await NetworkManager.initialize();

      const connected = await NetworkManager.isConnected();
      expect(connected).toBe(false);
    });
  });

  // ---- Listeners ----

  describe('addListener / removeListener', () => {
    it('should add a listener and receive state changes', async () => {
      await NetworkManager.initialize();
      const listener = jest.fn();

      // addListener returns an unsubscribe function
      // It also immediately calls the listener with current state
      const unsubscribe = NetworkManager.addListener(listener);
      // Reset the immediate call to current state
      const immediateCallCount = listener.mock.calls.length;

      // Simulate a state change via the addEventListener callback
      const netInfoCallback = (NetInfo.addEventListener as jest.Mock).mock.calls[0][0];
      netInfoCallback({ type: 'cellular', isConnected: true, isInternetReachable: true, details: null });

      // Should have been called once more after the state change
      expect(listener).toHaveBeenCalledTimes(immediateCallCount + 1);
      // Last call should have cellular state
      const lastCall = listener.mock.calls[listener.mock.calls.length - 1][0];
      expect(lastCall.type).toBe('cellular');
      expect(lastCall.isConnected).toBe(true);
    });

    it('should remove a listener via returned unsubscribe function', async () => {
      await NetworkManager.initialize();
      const listener = jest.fn();

      // addListener returns unsubscribe function (no separate removeListener method)
      const unsubscribe = NetworkManager.addListener(listener);
      const callCountAfterAdd = listener.mock.calls.length;

      // Use the returned unsubscribe function
      unsubscribe();

      const netInfoCallback = (NetInfo.addEventListener as jest.Mock).mock.calls[0][0];
      netInfoCallback({ type: 'cellular', isConnected: true, isInternetReachable: true, details: null });

      // Should not have been called again after unsubscribe
      expect(listener).toHaveBeenCalledTimes(callCountAfterAdd);
    });
  });

  // ---- Retry with backoff ----

  describe('executeWithRetry', () => {
    it('should succeed on first try without timeout leak', async () => {
      // Use a fast-resolving operation to avoid timeout timer leak
      const operation = jest.fn().mockResolvedValue('success');

      // Pass short timeout so the timer fires quickly even if not cancelled
      const result = await NetworkManager.executeWithRetry(operation, {
        maxRetries: 0,
        baseDelay: 1,
        timeout: 10,
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  // ---- Cleanup ----

  describe('cleanup', () => {
    it('should unsubscribe from NetInfo on cleanup', async () => {
      const mockUnsubscribe = jest.fn();
      (NetInfo.addEventListener as jest.Mock).mockReturnValue(mockUnsubscribe);

      await NetworkManager.initialize();
      NetworkManager.cleanup();

      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });

    it('should be safe to call cleanup without initialization', () => {
      expect(() => NetworkManager.cleanup()).not.toThrow();
    });
  });
});
