// 物流Hooks - 基础框架
import { useLogisticsStore } from '../store/logisticsStore';

export const useLogistics = () => {
  const {
    orders,
    vehicles,
    routes,
    currentOrder,
    loading,
    error,
    fetchOrders,
    fetchVehicles,
    fetchRoutes,
    setCurrentOrder
  } = useLogisticsStore();

  return {
    orders,
    vehicles,
    routes,
    currentOrder,
    loading,
    error,
    fetchOrders,
    fetchVehicles,
    fetchRoutes,
    setCurrentOrder
  };
};