import { http } from "@/utils/http";
import type {
  SysRole,
  SysRoleForm,
  SysRoleQuery,
  ApiResult,
  ListResult
} from "./types";

/** 获取角色分页列表 */
export const getRoleList = (params: SysRoleQuery) => {
  return http.request<ListResult<SysRole>>("get", "/system/role/list", {
    params
  });
};

/** 获取所有角色列表（不分页） */
export const getAllRoles = () => {
  return http.request<ApiResult<SysRole[]>>("get", "/system/role/listAll");
};

/** 获取角色详情 */
export const getRoleById = (roleId: number) => {
  return http.request<ApiResult<SysRole>>("get", `/system/role/${roleId}`);
};

/** 新增角色 */
export const createRole = (data: SysRoleForm) => {
  return http.request<ApiResult<void>>("post", "/system/role", { data });
};

/** 修改角色 */
export const updateRole = (data: SysRoleForm) => {
  return http.request<ApiResult<void>>("put", "/system/role", { data });
};

/** 删除角色 */
export const deleteRole = (roleId: number) => {
  return http.request<ApiResult<void>>("delete", `/system/role/${roleId}`);
};

/** 批量删除角色 */
export const deleteRoles = (roleIds: number[]) => {
  return http.request<ApiResult<void>>("delete", `/system/role/${roleIds.join(",")}`);
};

/** 修改角色状态 */
export const changeRoleStatus = (roleId: number, status: "0" | "1") => {
  return http.request<ApiResult<void>>("put", "/system/role/changeStatus", {
    data: { roleId, status }
  });
};

/** 获取角色已分配的菜单ID列表 */
export const getRoleMenuIds = (roleId: number) => {
  return http.request<ApiResult<number[]>>("get", `/system/role/roleMenuIds/${roleId}`);
};
