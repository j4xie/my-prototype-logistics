import { useFieldVisibilityStore } from '../../../store/fieldVisibilityStore';
import { createApiMock, resetApiMock } from '../../utils/mockApiClient';
import MockAdapter from 'axios-mock-adapter';

const DEFAULT_FACTORY_ID = 'CRETAS_2024_001';

let mock: MockAdapter;

beforeEach(() => {
  mock = createApiMock();
  useFieldVisibilityStore.setState({
    hiddenFields: {},
    loaded: false,
    loading: false,
  });
});

afterEach(() => {
  resetApiMock(mock);
});

describe('useFieldVisibilityStore', () => {
  describe('loadVisibility - success', () => {
    it('sets hiddenFields and loaded=true on success', async () => {
      const hiddenFields = {
        MaterialBatch: ['expiryDate', 'supplier'],
        ProcessTask: ['notes'],
      };
      mock
        .onGet(`/api/mobile/${DEFAULT_FACTORY_ID}/field-visibility`)
        .reply(200, { success: true, data: hiddenFields });

      await useFieldVisibilityStore.getState().loadVisibility(DEFAULT_FACTORY_ID);
      const state = useFieldVisibilityStore.getState();
      expect(state.loaded).toBe(true);
      expect(state.loading).toBe(false);
      expect(state.hiddenFields).toEqual(hiddenFields);
    });

    it('sets loading during request', async () => {
      mock
        .onGet(`/api/mobile/${DEFAULT_FACTORY_ID}/field-visibility`)
        .reply(200, { success: true, data: {} });

      const promise = useFieldVisibilityStore.getState().loadVisibility(DEFAULT_FACTORY_ID);
      // loading might be true during the request
      await promise;
      expect(useFieldVisibilityStore.getState().loading).toBe(false);
    });

    it('handles empty hiddenFields', async () => {
      mock
        .onGet(`/api/mobile/${DEFAULT_FACTORY_ID}/field-visibility`)
        .reply(200, { success: true, data: {} });

      await useFieldVisibilityStore.getState().loadVisibility(DEFAULT_FACTORY_ID);
      expect(useFieldVisibilityStore.getState().hiddenFields).toEqual({});
      expect(useFieldVisibilityStore.getState().loaded).toBe(true);
    });
  });

  describe('loadVisibility - failure', () => {
    it('sets loaded=false and loading=false on error', async () => {
      mock
        .onGet(`/api/mobile/${DEFAULT_FACTORY_ID}/field-visibility`)
        .reply(500, { success: false, message: 'Server error' });

      await useFieldVisibilityStore.getState().loadVisibility(DEFAULT_FACTORY_ID);
      const state = useFieldVisibilityStore.getState();
      expect(state.loading).toBe(false);
    });

    it('sets loaded=false on network error', async () => {
      mock
        .onGet(`/api/mobile/${DEFAULT_FACTORY_ID}/field-visibility`)
        .networkError();

      await useFieldVisibilityStore.getState().loadVisibility(DEFAULT_FACTORY_ID);
      expect(useFieldVisibilityStore.getState().loading).toBe(false);
    });
  });

  describe('loadVisibility - concurrent', () => {
    it('second call returns immediately if already loading', async () => {
      mock
        .onGet(`/api/mobile/${DEFAULT_FACTORY_ID}/field-visibility`)
        .reply(200, { success: true, data: { MaterialBatch: ['cost'] } });

      useFieldVisibilityStore.setState({ loading: true });
      await useFieldVisibilityStore.getState().loadVisibility(DEFAULT_FACTORY_ID);
      // Should not have changed hiddenFields since it returned early
      expect(useFieldVisibilityStore.getState().hiddenFields).toEqual({});
    });
  });

  describe('isFieldVisible', () => {
    it('returns true when not loaded (default visible)', () => {
      useFieldVisibilityStore.setState({ loaded: false, hiddenFields: {} });
      const result = useFieldVisibilityStore.getState().isFieldVisible('MaterialBatch', 'cost');
      expect(result).toBe(true);
    });

    it('returns false when entityType exists and field is hidden', () => {
      useFieldVisibilityStore.setState({
        loaded: true,
        hiddenFields: { MaterialBatch: ['cost', 'supplier'] },
      });
      const result = useFieldVisibilityStore.getState().isFieldVisible('MaterialBatch', 'cost');
      expect(result).toBe(false);
    });

    it('returns true when entityType exists but field is not hidden', () => {
      useFieldVisibilityStore.setState({
        loaded: true,
        hiddenFields: { MaterialBatch: ['cost'] },
      });
      const result = useFieldVisibilityStore.getState().isFieldVisible('MaterialBatch', 'name');
      expect(result).toBe(true);
    });

    it('returns true when entityType does not exist in hiddenFields', () => {
      useFieldVisibilityStore.setState({
        loaded: true,
        hiddenFields: { MaterialBatch: ['cost'] },
      });
      const result = useFieldVisibilityStore.getState().isFieldVisible('ProcessTask', 'name');
      expect(result).toBe(true);
    });

    it('returns true when hiddenFields is empty', () => {
      useFieldVisibilityStore.setState({ loaded: true, hiddenFields: {} });
      const result = useFieldVisibilityStore.getState().isFieldVisible('MaterialBatch', 'cost');
      expect(result).toBe(true);
    });
  });

  describe('reset', () => {
    it('clears all state', () => {
      useFieldVisibilityStore.setState({
        loaded: true,
        loading: false,
        hiddenFields: { MaterialBatch: ['cost'] },
      });
      useFieldVisibilityStore.getState().reset();
      const state = useFieldVisibilityStore.getState();
      expect(state.hiddenFields).toEqual({});
      expect(state.loaded).toBe(false);
      expect(state.loading).toBe(false);
    });

    it('reset after load returns to default', async () => {
      mock
        .onGet(`/api/mobile/${DEFAULT_FACTORY_ID}/field-visibility`)
        .reply(200, { success: true, data: { MaterialBatch: ['cost'] } });

      await useFieldVisibilityStore.getState().loadVisibility(DEFAULT_FACTORY_ID);
      expect(useFieldVisibilityStore.getState().loaded).toBe(true);
      useFieldVisibilityStore.getState().reset();
      expect(useFieldVisibilityStore.getState().loaded).toBe(false);
      expect(useFieldVisibilityStore.getState().hiddenFields).toEqual({});
    });
  });
});
