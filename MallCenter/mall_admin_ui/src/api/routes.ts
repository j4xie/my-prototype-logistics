import { http } from "@/utils/http";
import type { BackendResult } from "./user";

/** 路由菜单项 */
export interface RouteItem {
  name?: string;
  path: string;
  hidden?: boolean;
  redirect?: string;
  component?: string;
  query?: string;
  alwaysShow?: boolean;
  meta?: {
    title: string;
    icon?: string;
    noCache?: boolean;
    link?: string;
    rank?: number;
    roles?: string[];
    auths?: string[];
  };
  children?: RouteItem[];
}

/** 兼容原有响应格式 */
type Result = {
  success: boolean;
  data: Array<any>;
};

/** 转换后端路由格式为前端格式 */
function transformRoutes(routes: RouteItem[]): any[] {
  return routes.map(route => {
    const transformed: any = {
      path: route.path,
      name: route.name,
      redirect: route.redirect,
      component: route.component,
      meta: {
        title: route.meta?.title || "",
        icon: route.meta?.icon,
        showLink: !route.hidden,
        rank: route.meta?.rank,
        roles: route.meta?.roles,
        auths: route.meta?.auths
      }
    };

    if (route.children && route.children.length > 0) {
      transformed.children = transformRoutes(route.children);
    }

    return transformed;
  });
}

/** 获取动态路由 */
export const getAsyncRoutes = () => {
  return http
    .request<BackendResult<RouteItem[]>>("get", "/getRouters")
    .then((res): Result => {
      if (res.code === 200 && res.data) {
        // 转换后端路由格式
        const transformedRoutes = transformRoutes(res.data);
        return {
          success: true,
          data: transformedRoutes
        };
      }
      return {
        success: false,
        data: []
      };
    })
    .catch(() => {
      return {
        success: false,
        data: []
      };
    });
};
