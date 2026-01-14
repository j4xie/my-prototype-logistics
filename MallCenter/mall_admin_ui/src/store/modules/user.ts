import { defineStore } from "pinia";
import {
  type userType,
  store,
  router,
  resetRouter,
  routerArrays,
  storageLocal
} from "../utils";
import {
  type UserResult,
  type RefreshTokenResult,
  type LoginParams,
  type BackendResult,
  type LoginData,
  type UserInfoData,
  getLogin,
  getInfo,
  refreshTokenApi
} from "@/api/user";
import { useMultiTagsStoreHook } from "./multiTags";
import { type DataInfo, setToken, removeToken, userKey } from "@/utils/auth";

export const useUserStore = defineStore("pure-user", {
  state: (): userType => ({
    // 头像
    avatar: storageLocal().getItem<DataInfo<number>>(userKey)?.avatar ?? "",
    // 用户名
    username: storageLocal().getItem<DataInfo<number>>(userKey)?.username ?? "",
    // 昵称
    nickname: storageLocal().getItem<DataInfo<number>>(userKey)?.nickname ?? "",
    // 页面级别权限
    roles: storageLocal().getItem<DataInfo<number>>(userKey)?.roles ?? [],
    // 按钮级别权限
    permissions:
      storageLocal().getItem<DataInfo<number>>(userKey)?.permissions ?? [],
    // 是否勾选了登录页的免登录
    isRemembered: false,
    // 登录页的免登录存储几天，默认7天
    loginDay: 7
  }),
  actions: {
    /** 存储头像 */
    SET_AVATAR(avatar: string) {
      this.avatar = avatar;
    },
    /** 存储用户名 */
    SET_USERNAME(username: string) {
      this.username = username;
    },
    /** 存储昵称 */
    SET_NICKNAME(nickname: string) {
      this.nickname = nickname;
    },
    /** 存储角色 */
    SET_ROLES(roles: Array<string>) {
      this.roles = roles;
    },
    /** 存储按钮级别权限 */
    SET_PERMS(permissions: Array<string>) {
      this.permissions = permissions;
    },
    /** 存储是否勾选了登录页的免登录 */
    SET_ISREMEMBERED(bool: boolean) {
      this.isRemembered = bool;
    },
    /** 设置登录页的免登录存储几天 */
    SET_LOGINDAY(value: number) {
      this.loginDay = Number(value);
    },
    /** 登入 */
    async loginByUsername(data: LoginParams) {
      return new Promise<UserResult>((resolve, reject) => {
        // 1. 先调用登录接口获取token
        getLogin(data)
          .then((loginRes: any) => {
            // 后端返回格式: {code, msg, token} - token在根级别
            const token = loginRes.token || loginRes.data?.token;
            if (loginRes.code === 200 && token) {

              // 2. 登录成功后，获取用户信息
              // 先临时存储token以便getInfo请求使用
              const tempTokenData: DataInfo<Date> = {
                accessToken: token,
                refreshToken: token, // 如果后端不支持refreshToken，使用相同的token
                expires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 默认24小时过期
              };
              setToken(tempTokenData);

              // 3. 获取用户信息
              getInfo()
                .then((infoRes: any) => {
                  // 后端返回格式: {code, msg, user, roles, permissions} - 数据在根级别
                  if (infoRes.code === 200) {
                    const user = infoRes.user || infoRes.data?.user || {};
                    const roles = infoRes.roles || infoRes.data?.roles || ["common"];
                    const permissions = infoRes.permissions || infoRes.data?.permissions || [];

                    // 构造兼容原有逻辑的返回数据
                    const userData: UserResult = {
                      success: true,
                      data: {
                        avatar: user.avatar || "",
                        username: user.userName,
                        nickname: user.nickName || user.userName,
                        roles: roles || ["common"],
                        permissions: permissions || [],
                        accessToken: token,
                        refreshToken: token,
                        expires: new Date(Date.now() + 24 * 60 * 60 * 1000)
                      }
                    };

                    // 重新设置token，包含完整用户信息
                    setToken(userData.data);
                    resolve(userData);
                  } else {
                    reject(new Error(infoRes.msg || "获取用户信息失败"));
                  }
                })
                .catch(error => {
                  reject(error);
                });
            } else {
              reject(new Error(loginRes.msg || "登录失败"));
            }
          })
          .catch(error => {
            reject(error);
          });
      });
    },
    /** 前端登出（不调用接口） */
    logOut() {
      this.username = "";
      this.roles = [];
      this.permissions = [];
      removeToken();
      useMultiTagsStoreHook().handleTags("equal", [...routerArrays]);
      resetRouter();
      router.push("/login");
    },
    /** 刷新`token` */
    async handRefreshToken(data) {
      return new Promise<RefreshTokenResult>((resolve, reject) => {
        refreshTokenApi(data)
          .then(data => {
            if (data) {
              setToken(data.data);
              resolve(data);
            }
          })
          .catch(error => {
            reject(error);
          });
      });
    }
  }
});

export function useUserStoreHook() {
  return useUserStore(store);
}
