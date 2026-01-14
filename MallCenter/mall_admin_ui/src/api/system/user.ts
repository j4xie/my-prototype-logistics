import { http } from "@/utils/http";
import type {
  SysUser,
  SysUserForm,
  SysUserQuery,
  ResetPwdParams,
  ApiResult,
  ListResult
} from "./types";

/** 获取用户分页列表 */
export const getUserList = (params: SysUserQuery) => {
  return http.request<ListResult<SysUser>>("get", "/system/user/list", {
    params
  });
};

/** 获取用户详情 */
export const getUserById = (userId: number) => {
  return http.request<ApiResult<SysUser>>("get", `/system/user/${userId}`);
};

/** 新增用户 */
export const createUser = (data: SysUserForm) => {
  return http.request<ApiResult<void>>("post", "/system/user", { data });
};

/** 修改用户 */
export const updateUser = (data: SysUserForm) => {
  return http.request<ApiResult<void>>("put", "/system/user", { data });
};

/** 删除用户 */
export const deleteUser = (userId: number) => {
  return http.request<ApiResult<void>>("delete", `/system/user/${userId}`);
};

/** 批量删除用户 */
export const deleteUsers = (userIds: number[]) => {
  return http.request<ApiResult<void>>("delete", `/system/user/${userIds.join(",")}`);
};

/** 重置用户密码 */
export const resetUserPwd = (data: ResetPwdParams) => {
  return http.request<ApiResult<void>>("put", "/system/user/resetPwd", { data });
};

/** 修改用户状态 */
export const changeUserStatus = (userId: number, status: "0" | "1") => {
  return http.request<ApiResult<void>>("put", "/system/user/changeStatus", {
    data: { userId, status }
  });
};

/** 导出用户列表 */
export const exportUser = (params: SysUserQuery) => {
  return http.request<Blob>("post", "/system/user/export", {
    params,
    responseType: "blob"
  });
};
