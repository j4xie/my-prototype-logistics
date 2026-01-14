import { http } from "@/utils/http";
import type { SysMenu, MenuTreeNode, ApiResult } from "./types";

/** 获取菜单列表 */
export const getMenuList = (params?: { menuName?: string; status?: "0" | "1" }) => {
  return http.request<ApiResult<SysMenu[]>>("get", "/system/menu/list", {
    params
  });
};

/** 获取菜单树形结构（用于角色分配权限） */
export const getMenuTreeSelect = () => {
  return http.request<ApiResult<MenuTreeNode[]>>("get", "/system/menu/treeselect");
};

/** 获取角色对应的菜单树形结构 */
export const getRoleMenuTreeSelect = (roleId: number) => {
  return http.request<ApiResult<{ checkedKeys: number[]; menus: MenuTreeNode[] }>>(
    "get",
    `/system/menu/roleMenuTreeselect/${roleId}`
  );
};

/** 获取菜单详情 */
export const getMenuById = (menuId: number) => {
  return http.request<ApiResult<SysMenu>>("get", `/system/menu/${menuId}`);
};

/** 新增菜单 */
export const createMenu = (data: Partial<SysMenu>) => {
  return http.request<ApiResult<void>>("post", "/system/menu", { data });
};

/** 修改菜单 */
export const updateMenu = (data: Partial<SysMenu>) => {
  return http.request<ApiResult<void>>("put", "/system/menu", { data });
};

/** 删除菜单 */
export const deleteMenu = (menuId: number) => {
  return http.request<ApiResult<void>>("delete", `/system/menu/${menuId}`);
};
