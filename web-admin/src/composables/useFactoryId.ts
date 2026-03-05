import { computed } from 'vue';
import { useAuthStore } from '@/store/modules/auth';

/**
 * Returns the current user's factoryId as a computed ref.
 *
 * Usage:
 *   const factoryId = useFactoryId();
 *   // factoryId.value in script, {{ factoryId }} in template
 */
export function useFactoryId() {
  const authStore = useAuthStore();
  return computed(() => authStore.factoryId);
}
