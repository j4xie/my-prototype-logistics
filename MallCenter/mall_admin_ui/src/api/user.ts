import { http } from "@/utils/http";

/** 后端统一响应格式 */
export type BackendResult<T = any> = {
  code: number;
  msg: string;
  data: T;
};

/** 登录响应数据 */
export type LoginData = {
  token: string;
};

/** 用户信息响应数据 */
export type UserInfoData = {
  user: {
    userId: number;
    userName: string;
    nickName: string;
    avatar: string;
    deptId: number;
  };
  roles: string[];
  permissions: string[];
};

/** 前端使用的用户结果类型（兼容原有逻辑） */
export type UserResult = {
  success: boolean;
  data: {
    /** 头像 */
    avatar: string;
    /** 用户名 */
    username: string;
    /** 昵称 */
    nickname: string;
    /** 当前登录用户的角色 */
    roles: Array<string>;
    /** 按钮级别权限 */
    permissions: Array<string>;
    /** `token` */
    accessToken: string;
    /** 用于调用刷新`accessToken`的接口时所需的`token` */
    refreshToken: string;
    /** `accessToken`的过期时间（格式'xxxx/xx/xx xx:xx:xx'） */
    expires: Date;
  };
};

export type RefreshTokenResult = {
  success: boolean;
  data: {
    /** `token` */
    accessToken: string;
    /** 用于调用刷新`accessToken`的接口时所需的`token` */
    refreshToken: string;
    /** `accessToken`的过期时间（格式'xxxx/xx/xx xx:xx:xx'） */
    expires: Date;
  };
};

/** 登录请求参数 */
export interface LoginParams {
  username: string;
  password: string;
  code?: string;
  uuid?: string;
}

/** 登录接口 */
export const getLogin = (data: LoginParams) => {
  return http.request<BackendResult<LoginData>>("post", "/login", { data });
};

/** 获取用户信息接口 */
export const getInfo = () => {
  return http.request<BackendResult<UserInfoData>>("get", "/getInfo");
};

/** 刷新`token` */
export const refreshTokenApi = (data?: object) => {
  return http.request<RefreshTokenResult>("post", "/refresh-token", { data });
};
