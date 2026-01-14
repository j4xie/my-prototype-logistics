<script setup lang="ts">
import { ref, reactive, onMounted, nextTick } from "vue";
import { ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import type { ElTree } from "element-plus";
import { Search, Refresh, Plus, Edit, Delete } from "@element-plus/icons-vue";
import { message } from "@/utils/message";
import {
  getRoleList,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  changeRoleStatus
} from "@/api/system/role";
import { getMenuTreeSelect, getRoleMenuTreeSelect } from "@/api/system/menu";
import type { SysRole, SysRoleForm, SysRoleQuery, MenuTreeNode } from "@/api/system/types";

defineOptions({
  name: "SystemRole"
});

// 加载状态
const loading = ref(false);

// 角色列表
const tableData = ref<SysRole[]>([]);

// 菜单树数据
const menuTreeData = ref<MenuTreeNode[]>([]);

// 分页信息
const pagination = reactive({
  pageNum: 1,
  pageSize: 10,
  total: 0
});

// 查询参数
const queryParams = reactive<SysRoleQuery>({
  roleName: "",
  roleKey: "",
  status: undefined
});

// 对话框相关
const dialogVisible = ref(false);
const dialogTitle = ref("");
const dialogLoading = ref(false);

// 表单引用
const formRef = ref<FormInstance>();

// 菜单树引用
const menuTreeRef = ref<InstanceType<typeof ElTree>>();

// 表单数据
const formData = reactive<SysRoleForm>({
  roleName: "",
  roleKey: "",
  roleSort: 0,
  status: "0",
  menuIds: [],
  remark: ""
});

// 菜单展开/折叠状态
const menuExpand = ref(false);
const menuCheckAll = ref(false);
const menuCheckStrictly = ref(true);

// 表单校验规则
const formRules = reactive<FormRules<SysRoleForm>>({
  roleName: [
    { required: true, message: "请输入角色名称", trigger: "blur" },
    { min: 2, max: 20, message: "角色名称长度为2-20个字符", trigger: "blur" }
  ],
  roleKey: [
    { required: true, message: "请输入角色权限字符", trigger: "blur" },
    { min: 2, max: 50, message: "角色权限字符长度为2-50个字符", trigger: "blur" }
  ],
  roleSort: [
    { required: true, message: "请输入排序", trigger: "blur" }
  ]
});

// 获取角色列表
const fetchData = async () => {
  loading.value = true;
  try {
    const res = await getRoleList({
      ...queryParams,
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize
    });
    if (res.code === 200) {
      tableData.value = res.rows;
      pagination.total = res.total;
    } else {
      message(res.msg || "获取角色列表失败", { type: "error" });
    }
  } catch (error) {
    message("获取角色列表失败", { type: "error" });
  } finally {
    loading.value = false;
  }
};

// 获取菜单树
const fetchMenuTree = async () => {
  try {
    const res = await getMenuTreeSelect();
    if (res.code === 200) {
      menuTreeData.value = res.data;
    }
  } catch (error) {
    console.error("获取菜单树失败", error);
  }
};

// 搜索
const handleSearch = () => {
  pagination.pageNum = 1;
  fetchData();
};

// 重置
const handleReset = () => {
  queryParams.roleName = "";
  queryParams.roleKey = "";
  queryParams.status = undefined;
  pagination.pageNum = 1;
  fetchData();
};

// 重置表单
const resetForm = () => {
  formData.roleId = undefined;
  formData.roleName = "";
  formData.roleKey = "";
  formData.roleSort = 0;
  formData.status = "0";
  formData.menuIds = [];
  formData.remark = "";
  menuExpand.value = false;
  menuCheckAll.value = false;
  menuCheckStrictly.value = true;
};

// 获取所有菜单节点
const getMenuAllNodes = (): MenuTreeNode[] => {
  const nodes: MenuTreeNode[] = [];
  const traverse = (items: MenuTreeNode[]) => {
    items.forEach(item => {
      nodes.push(item);
      if (item.children && item.children.length > 0) {
        traverse(item.children);
      }
    });
  };
  traverse(menuTreeData.value);
  return nodes;
};

// 新增角色
const handleAdd = async () => {
  resetForm();
  dialogTitle.value = "新增角色";
  dialogVisible.value = true;
  await nextTick();
  if (menuTreeRef.value) {
    menuTreeRef.value.setCheckedKeys([]);
  }
};

// 编辑角色
const handleEdit = async (row: SysRole) => {
  resetForm();
  dialogTitle.value = "编辑角色";
  dialogLoading.value = true;
  dialogVisible.value = true;
  try {
    const [roleRes, menuRes] = await Promise.all([
      getRoleById(row.roleId),
      getRoleMenuTreeSelect(row.roleId)
    ]);
    if (roleRes.code === 200) {
      const role = roleRes.data;
      formData.roleId = role.roleId;
      formData.roleName = role.roleName;
      formData.roleKey = role.roleKey;
      formData.roleSort = role.roleSort || 0;
      formData.status = role.status;
      formData.remark = role.remark || "";
    }
    if (menuRes.code === 200) {
      await nextTick();
      if (menuTreeRef.value) {
        menuTreeRef.value.setCheckedKeys(menuRes.data.checkedKeys);
      }
    }
  } catch (error) {
    message("获取角色信息失败", { type: "error" });
    dialogVisible.value = false;
  } finally {
    dialogLoading.value = false;
  }
};

// 获取选中的菜单ID（包含半选中状态）
const getCheckedMenuIds = (): number[] => {
  if (!menuTreeRef.value) return [];
  const checkedKeys = menuTreeRef.value.getCheckedKeys() as number[];
  const halfCheckedKeys = menuTreeRef.value.getHalfCheckedKeys() as number[];
  return [...checkedKeys, ...halfCheckedKeys];
};

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (valid) {
      dialogLoading.value = true;
      try {
        const submitData = {
          ...formData,
          menuIds: getCheckedMenuIds()
        };
        const res = formData.roleId
          ? await updateRole(submitData)
          : await createRole(submitData);
        if (res.code === 200) {
          message(formData.roleId ? "修改成功" : "新增成功", { type: "success" });
          dialogVisible.value = false;
          fetchData();
        } else {
          message(res.msg || (formData.roleId ? "修改失败" : "新增失败"), { type: "error" });
        }
      } catch (error) {
        message(formData.roleId ? "修改失败" : "新增失败", { type: "error" });
      } finally {
        dialogLoading.value = false;
      }
    }
  });
};

// 删除角色
const handleDelete = async (row: SysRole) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除角色「${row.roleName}」吗？`,
      "删除确认",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning"
      }
    );
    const res = await deleteRole(row.roleId);
    if (res.code === 200) {
      message("删除成功", { type: "success" });
      fetchData();
    } else {
      message(res.msg || "删除失败", { type: "error" });
    }
  } catch (error) {
    if (error !== "cancel") {
      message("删除失败", { type: "error" });
    }
  }
};

// 修改角色状态
const handleStatusChange = async (row: SysRole) => {
  const statusText = row.status === "0" ? "启用" : "停用";
  try {
    await ElMessageBox.confirm(
      `确定要${statusText}角色「${row.roleName}」吗？`,
      "状态确认",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning"
      }
    );
    const res = await changeRoleStatus(row.roleId, row.status);
    if (res.code === 200) {
      message(`${statusText}成功`, { type: "success" });
    } else {
      // 恢复原状态
      row.status = row.status === "0" ? "1" : "0";
      message(res.msg || `${statusText}失败`, { type: "error" });
    }
  } catch (error) {
    // 恢复原状态
    row.status = row.status === "0" ? "1" : "0";
    if (error !== "cancel") {
      message(`${statusText}失败`, { type: "error" });
    }
  }
};

// 菜单树展开/折叠
const handleMenuExpand = (expand: boolean) => {
  const nodes = getMenuAllNodes();
  nodes.forEach(node => {
    if (menuTreeRef.value) {
      const treeNode = menuTreeRef.value.getNode(node.id);
      if (treeNode) {
        treeNode.expanded = expand;
      }
    }
  });
};

// 菜单树全选/取消全选
const handleMenuCheckAll = (checkAll: boolean) => {
  if (menuTreeRef.value) {
    if (checkAll) {
      const nodes = getMenuAllNodes();
      menuTreeRef.value.setCheckedKeys(nodes.map(n => n.id));
    } else {
      menuTreeRef.value.setCheckedKeys([]);
    }
  }
};

// 分页大小改变
const handleSizeChange = (size: number) => {
  pagination.pageSize = size;
  pagination.pageNum = 1;
  fetchData();
};

// 页码改变
const handleCurrentChange = (current: number) => {
  pagination.pageNum = current;
  fetchData();
};

onMounted(() => {
  fetchData();
  fetchMenuTree();
});
</script>

<template>
  <div class="system-role">
    <!-- 搜索区域 -->
    <el-card shadow="never" class="search-card">
      <el-form :model="queryParams" :inline="true">
        <el-form-item label="角色名称">
          <el-input
            v-model="queryParams.roleName"
            placeholder="请输入角色名称"
            clearable
            style="width: 180px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="权限字符">
          <el-input
            v-model="queryParams.roleKey"
            placeholder="请输入权限字符"
            clearable
            style="width: 180px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select
            v-model="queryParams.status"
            placeholder="请选择状态"
            clearable
            style="width: 120px"
          >
            <el-option label="正常" value="0" />
            <el-option label="停用" value="1" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleSearch">
            搜索
          </el-button>
          <el-button :icon="Refresh" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 表格区域 -->
    <el-card shadow="never" class="table-card">
      <template #header>
        <div class="table-header">
          <span class="title">角色列表</span>
          <el-button type="primary" :icon="Plus" @click="handleAdd">
            新增角色
          </el-button>
        </div>
      </template>

      <el-table :data="tableData" v-loading="loading" stripe border>
        <el-table-column prop="roleId" label="角色ID" width="80" />
        <el-table-column prop="roleName" label="角色名称" width="150" />
        <el-table-column prop="roleKey" label="权限字符" width="150" />
        <el-table-column prop="roleSort" label="排序" width="80" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-switch
              v-model="row.status"
              active-value="0"
              inactive-value="1"
              @change="handleStatusChange(row)"
            />
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" min-width="180" />
        <el-table-column prop="remark" label="备注" min-width="200" show-overflow-tooltip />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link :icon="Edit" @click="handleEdit(row)">
              编辑
            </el-button>
            <el-button type="danger" link :icon="Delete" @click="handleDelete(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.pageNum"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>

    <!-- 新增/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="600px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="100px"
        v-loading="dialogLoading"
      >
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="角色名称" prop="roleName">
              <el-input v-model="formData.roleName" placeholder="请输入角色名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="权限字符" prop="roleKey">
              <el-input v-model="formData.roleKey" placeholder="请输入权限字符" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="排序" prop="roleSort">
              <el-input-number
                v-model="formData.roleSort"
                :min="0"
                :max="9999"
                controls-position="right"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态" prop="status">
              <el-radio-group v-model="formData.status">
                <el-radio value="0">正常</el-radio>
                <el-radio value="1">停用</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="24">
            <el-form-item label="菜单权限">
              <div class="menu-tree-toolbar">
                <el-checkbox v-model="menuExpand" @change="handleMenuExpand">
                  展开/折叠
                </el-checkbox>
                <el-checkbox v-model="menuCheckAll" @change="handleMenuCheckAll">
                  全选/全不选
                </el-checkbox>
                <el-checkbox v-model="menuCheckStrictly">
                  父子联动
                </el-checkbox>
              </div>
              <div class="menu-tree-wrapper">
                <el-tree
                  ref="menuTreeRef"
                  :data="menuTreeData"
                  :props="{ label: 'label', children: 'children' }"
                  node-key="id"
                  show-checkbox
                  :check-strictly="!menuCheckStrictly"
                  default-expand-all
                />
              </div>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="24">
            <el-form-item label="备注" prop="remark">
              <el-input
                v-model="formData.remark"
                type="textarea"
                :rows="3"
                placeholder="请输入备注"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="dialogLoading">
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.system-role {
  padding: 20px;

  .search-card {
    margin-bottom: 16px;
  }

  .table-card {
    .table-header {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .title {
        font-size: 16px;
        font-weight: 600;
      }
    }
  }

  .pagination-wrapper {
    display: flex;
    justify-content: flex-end;
    margin-top: 20px;
  }

  .menu-tree-toolbar {
    margin-bottom: 10px;

    .el-checkbox {
      margin-right: 15px;
    }
  }

  .menu-tree-wrapper {
    border: 1px solid var(--el-border-color);
    border-radius: 4px;
    padding: 10px;
    max-height: 300px;
    overflow: auto;
  }
}
</style>
