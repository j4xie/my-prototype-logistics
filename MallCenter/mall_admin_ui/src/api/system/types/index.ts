/** 系统用户实体 */
export interface SysUser {
  /** 用户ID */
  userId: number;
  /** 用户名 */
  userName: string;
  /** 昵称 */
  nickName: string;
  /** 邮箱 */
  email?: string;
  /** 手机号 */
  phonenumber?: string;
  /** 性别：0男 1女 2未知 */
  sex: "0" | "1" | "2";
  /** 状态：0正常 1停用 */
  status: "0" | "1";
  /** 角色ID列表 */
  roleIds?: number[];
  /** 角色列表 */
  roles?: SysRole[];
  /** 头像 */
  avatar?: string;
  /** 部门ID */
  deptId?: number;
  /** 部门名称 */
  deptName?: string;
  /** 创建时间 */
  createTime?: string;
  /** 更新时间 */
  updateTime?: string;
  /** 备注 */
  remark?: string;
}

/** 用户表单数据 */
export interface SysUserForm {
  /** 用户ID */
  userId?: number;
  /** 用户名 */
  userName: string;
  /** 昵称 */
  nickName: string;
  /** 密码 */
  password?: string;
  /** 邮箱 */
  email?: string;
  /** 手机号 */
  phonenumber?: string;
  /** 性别 */
  sex: "0" | "1" | "2";
  /** 状态 */
  status: "0" | "1";
  /** 角色ID列表 */
  roleIds?: number[];
  /** 部门ID */
  deptId?: number;
  /** 备注 */
  remark?: string;
}

/** 用户查询参数 */
export interface SysUserQuery {
  /** 当前页 */
  pageNum?: number;
  /** 每页数量 */
  pageSize?: number;
  /** 用户名 */
  userName?: string;
  /** 昵称 */
  nickName?: string;
  /** 手机号 */
  phonenumber?: string;
  /** 状态 */
  status?: "0" | "1";
  /** 部门ID */
  deptId?: number;
}

/** 重置密码参数 */
export interface ResetPwdParams {
  userId: number;
  password: string;
}

/** 系统角色实体 */
export interface SysRole {
  /** 角色ID */
  roleId: number;
  /** 角色名称 */
  roleName: string;
  /** 角色权限字符串 */
  roleKey: string;
  /** 排序 */
  roleSort?: number;
  /** 状态：0正常 1停用 */
  status: "0" | "1";
  /** 数据范围 */
  dataScope?: string;
  /** 菜单ID列表 */
  menuIds?: number[];
  /** 创建时间 */
  createTime?: string;
  /** 更新时间 */
  updateTime?: string;
  /** 备注 */
  remark?: string;
}

/** 角色表单数据 */
export interface SysRoleForm {
  /** 角色ID */
  roleId?: number;
  /** 角色名称 */
  roleName: string;
  /** 角色权限字符串 */
  roleKey: string;
  /** 排序 */
  roleSort?: number;
  /** 状态 */
  status: "0" | "1";
  /** 菜单ID列表 */
  menuIds?: number[];
  /** 备注 */
  remark?: string;
}

/** 角色查询参数 */
export interface SysRoleQuery {
  /** 当前页 */
  pageNum?: number;
  /** 每页数量 */
  pageSize?: number;
  /** 角色名称 */
  roleName?: string;
  /** 角色权限字符串 */
  roleKey?: string;
  /** 状态 */
  status?: "0" | "1";
}

/** 系统菜单实体 */
export interface SysMenu {
  /** 菜单ID */
  menuId: number;
  /** 菜单名称 */
  menuName: string;
  /** 父菜单ID */
  parentId: number;
  /** 排序 */
  orderNum: number;
  /** 路由地址 */
  path?: string;
  /** 组件路径 */
  component?: string;
  /** 菜单类型：M目录 C菜单 F按钮 */
  menuType: "M" | "C" | "F";
  /** 显示状态：0显示 1隐藏 */
  visible: "0" | "1";
  /** 状态：0正常 1停用 */
  status: "0" | "1";
  /** 权限标识 */
  perms?: string;
  /** 菜单图标 */
  icon?: string;
  /** 子菜单 */
  children?: SysMenu[];
  /** 创建时间 */
  createTime?: string;
}

/** 菜单树节点 */
export interface MenuTreeNode {
  /** 节点ID */
  id: number;
  /** 节点标签 */
  label: string;
  /** 子节点 */
  children?: MenuTreeNode[];
}

/** 分页结果 */
export interface PageResult<T> {
  /** 数据列表 */
  rows: T[];
  /** 总数 */
  total: number;
}

/** API响应结果 */
export interface ApiResult<T = any> {
  /** 状态码 */
  code: number;
  /** 消息 */
  msg: string;
  /** 数据 */
  data: T;
}

/** 列表API响应结果（带分页） */
export interface ListResult<T> {
  /** 状态码 */
  code: number;
  /** 消息 */
  msg: string;
  /** 数据列表 */
  rows: T[];
  /** 总数 */
  total: number;
}
