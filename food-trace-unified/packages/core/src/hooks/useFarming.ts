// 农业Hooks - 基础框架
import { useFarmingStore } from '../store/farmingStore';

export const useFarming = () => {
  const {
    farms,
    currentFarm,
    fields,
    crops,
    loading,
    error,
    fetchFarms,
    fetchFields,
    fetchCrops,
    setCurrentFarm
  } = useFarmingStore();

  return {
    farms,
    currentFarm,
    fields,
    crops,
    loading,
    error,
    fetchFarms,
    fetchFields,
    fetchCrops,
    setCurrentFarm
  };
};