<script setup lang="ts">
import { ref, reactive, onMounted, computed } from "vue";
import { ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import { Search, Refresh, Plus, Edit, Delete, Key } from "@element-plus/icons-vue";
import { message } from "@/utils/message";
import {
  getUserList,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  resetUserPwd,
  changeUserStatus
} from "@/api/system/user";
import { getAllRoles } from "@/api/system/role";
import type { SysUser, SysUserForm, SysUserQuery, SysRole } from "@/api/system/types";

defineOptions({
  name: "SystemUser"
});

// 加载状态
const loading = ref(false);

// 用户列表
const tableData = ref<SysUser[]>([]);

// 角色列表
const roleList = ref<SysRole[]>([]);

// 分页信息
const pagination = reactive({
  pageNum: 1,
  pageSize: 10,
  total: 0
});

// 查询参数
const queryParams = reactive<SysUserQuery>({
  userName: "",
  nickName: "",
  phonenumber: "",
  status: undefined
});

// 对话框相关
const dialogVisible = ref(false);
const dialogTitle = ref("");
const dialogLoading = ref(false);

// 表单引用
const formRef = ref<FormInstance>();

// 表单数据
const formData = reactive<SysUserForm>({
  userName: "",
  nickName: "",
  password: "",
  email: "",
  phonenumber: "",
  sex: "0",
  status: "0",
  roleIds: [],
  remark: ""
});

// 是否编辑模式
const isEdit = computed(() => !!formData.userId);

// 表单校验规则
const formRules = reactive<FormRules<SysUserForm>>({
  userName: [
    { required: true, message: "请输入用户名", trigger: "blur" },
    { min: 2, max: 20, message: "用户名长度为2-20个字符", trigger: "blur" }
  ],
  nickName: [
    { required: true, message: "请输入昵称", trigger: "blur" },
    { min: 2, max: 20, message: "昵称长度为2-20个字符", trigger: "blur" }
  ],
  password: [
    { required: true, message: "请输入密码", trigger: "blur" },
    { min: 6, max: 20, message: "密码长度为6-20个字符", trigger: "blur" }
  ],
  email: [
    { type: "email", message: "请输入正确的邮箱地址", trigger: "blur" }
  ],
  phonenumber: [
    { pattern: /^1[3-9]\d{9}$/, message: "请输入正确的手机号码", trigger: "blur" }
  ]
});

// 重置密码对话框
const resetPwdDialogVisible = ref(false);
const resetPwdForm = reactive({
  userId: 0,
  userName: "",
  password: ""
});

// 获取用户列表
const fetchData = async () => {
  loading.value = true;
  try {
    const res = await getUserList({
      ...queryParams,
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize
    });
    if (res.code === 200) {
      tableData.value = res.rows;
      pagination.total = res.total;
    } else {
      message(res.msg || "获取用户列表失败", { type: "error" });
    }
  } catch (error) {
    message("获取用户列表失败", { type: "error" });
  } finally {
    loading.value = false;
  }
};

// 获取角色列表
const fetchRoles = async () => {
  try {
    const res = await getAllRoles();
    if (res.code === 200) {
      roleList.value = res.data;
    }
  } catch (error) {
    console.error("获取角色列表失败", error);
  }
};

// 搜索
const handleSearch = () => {
  pagination.pageNum = 1;
  fetchData();
};

// 重置
const handleReset = () => {
  queryParams.userName = "";
  queryParams.nickName = "";
  queryParams.phonenumber = "";
  queryParams.status = undefined;
  pagination.pageNum = 1;
  fetchData();
};

// 重置表单
const resetForm = () => {
  formData.userId = undefined;
  formData.userName = "";
  formData.nickName = "";
  formData.password = "";
  formData.email = "";
  formData.phonenumber = "";
  formData.sex = "0";
  formData.status = "0";
  formData.roleIds = [];
  formData.remark = "";
};

// 新增用户
const handleAdd = () => {
  resetForm();
  dialogTitle.value = "新增用户";
  dialogVisible.value = true;
};

// 编辑用户
const handleEdit = async (row: SysUser) => {
  resetForm();
  dialogTitle.value = "编辑用户";
  dialogLoading.value = true;
  dialogVisible.value = true;
  try {
    const res = await getUserById(row.userId);
    if (res.code === 200) {
      const user = res.data;
      formData.userId = user.userId;
      formData.userName = user.userName;
      formData.nickName = user.nickName;
      formData.email = user.email || "";
      formData.phonenumber = user.phonenumber || "";
      formData.sex = user.sex;
      formData.status = user.status;
      formData.roleIds = user.roleIds || [];
      formData.remark = user.remark || "";
    } else {
      message(res.msg || "获取用户信息失败", { type: "error" });
      dialogVisible.value = false;
    }
  } catch (error) {
    message("获取用户信息失败", { type: "error" });
    dialogVisible.value = false;
  } finally {
    dialogLoading.value = false;
  }
};

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (valid) {
      dialogLoading.value = true;
      try {
        const submitData = { ...formData };
        // 编辑时不传密码字段（除非有值）
        if (isEdit.value && !submitData.password) {
          delete submitData.password;
        }
        const res = isEdit.value
          ? await updateUser(submitData)
          : await createUser(submitData);
        if (res.code === 200) {
          message(isEdit.value ? "修改成功" : "新增成功", { type: "success" });
          dialogVisible.value = false;
          fetchData();
        } else {
          message(res.msg || (isEdit.value ? "修改失败" : "新增失败"), { type: "error" });
        }
      } catch (error) {
        message(isEdit.value ? "修改失败" : "新增失败", { type: "error" });
      } finally {
        dialogLoading.value = false;
      }
    }
  });
};

// 删除用户
const handleDelete = async (row: SysUser) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除用户「${row.userName}」吗？`,
      "删除确认",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning"
      }
    );
    const res = await deleteUser(row.userId);
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

// 修改用户状态
const handleStatusChange = async (row: SysUser) => {
  const statusText = row.status === "0" ? "启用" : "停用";
  try {
    await ElMessageBox.confirm(
      `确定要${statusText}用户「${row.userName}」吗？`,
      "状态确认",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning"
      }
    );
    const res = await changeUserStatus(row.userId, row.status);
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

// 打开重置密码对话框
const handleResetPwd = (row: SysUser) => {
  resetPwdForm.userId = row.userId;
  resetPwdForm.userName = row.userName;
  resetPwdForm.password = "";
  resetPwdDialogVisible.value = true;
};

// 提交重置密码
const submitResetPwd = async () => {
  if (!resetPwdForm.password) {
    message("请输入新密码", { type: "warning" });
    return;
  }
  if (resetPwdForm.password.length < 6 || resetPwdForm.password.length > 20) {
    message("密码长度为6-20个字符", { type: "warning" });
    return;
  }
  try {
    const res = await resetUserPwd({
      userId: resetPwdForm.userId,
      password: resetPwdForm.password
    });
    if (res.code === 200) {
      message("重置密码成功", { type: "success" });
      resetPwdDialogVisible.value = false;
    } else {
      message(res.msg || "重置密码失败", { type: "error" });
    }
  } catch (error) {
    message("重置密码失败", { type: "error" });
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

// 格式化性别
const formatSex = (sex: string) => {
  const sexMap: Record<string, string> = { "0": "男", "1": "女", "2": "未知" };
  return sexMap[sex] || "未知";
};

onMounted(() => {
  fetchData();
  fetchRoles();
});
</script>

<template>
  <div class="system-user">
    <!-- 搜索区域 -->
    <el-card shadow="never" class="search-card">
      <el-form :model="queryParams" :inline="true">
        <el-form-item label="用户名">
          <el-input
            v-model="queryParams.userName"
            placeholder="请输入用户名"
            clearable
            style="width: 180px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="昵称">
          <el-input
            v-model="queryParams.nickName"
            placeholder="请输入昵称"
            clearable
            style="width: 180px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input
            v-model="queryParams.phonenumber"
            placeholder="请输入手机号"
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
          <span class="title">用户列表</span>
          <el-button type="primary" :icon="Plus" @click="handleAdd">
            新增用户
          </el-button>
        </div>
      </template>

      <el-table :data="tableData" v-loading="loading" stripe border>
        <el-table-column prop="userId" label="用户ID" width="80" />
        <el-table-column prop="userName" label="用户名" width="120" />
        <el-table-column prop="nickName" label="昵称" width="120" />
        <el-table-column prop="phonenumber" label="手机号" width="130" />
        <el-table-column prop="email" label="邮箱" min-width="180" show-overflow-tooltip />
        <el-table-column label="性别" width="80">
          <template #default="{ row }">
            {{ formatSex(row.sex) }}
          </template>
        </el-table-column>
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
        <el-table-column prop="createTime" label="创建时间" width="180" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link :icon="Edit" @click="handleEdit(row)">
              编辑
            </el-button>
            <el-button type="warning" link :icon="Key" @click="handleResetPwd(row)">
              重置密码
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
            <el-form-item label="用户名" prop="userName">
              <el-input
                v-model="formData.userName"
                placeholder="请输入用户名"
                :disabled="isEdit"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="昵称" prop="nickName">
              <el-input v-model="formData.nickName" placeholder="请输入昵称" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20" v-if="!isEdit">
          <el-col :span="12">
            <el-form-item label="密码" prop="password">
              <el-input
                v-model="formData.password"
                type="password"
                placeholder="请输入密码"
                show-password
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="手机号" prop="phonenumber">
              <el-input v-model="formData.phonenumber" placeholder="请输入手机号" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="邮箱" prop="email">
              <el-input v-model="formData.email" placeholder="请输入邮箱" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="性别" prop="sex">
              <el-radio-group v-model="formData.sex">
                <el-radio value="0">男</el-radio>
                <el-radio value="1">女</el-radio>
                <el-radio value="2">未知</el-radio>
              </el-radio-group>
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
            <el-form-item label="角色" prop="roleIds">
              <el-select
                v-model="formData.roleIds"
                multiple
                placeholder="请选择角色"
                style="width: 100%"
              >
                <el-option
                  v-for="role in roleList"
                  :key="role.roleId"
                  :label="role.roleName"
                  :value="role.roleId"
                  :disabled="role.status === '1'"
                />
              </el-select>
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

    <!-- 重置密码对话框 -->
    <el-dialog
      v-model="resetPwdDialogVisible"
      title="重置密码"
      width="400px"
      :close-on-click-modal="false"
    >
      <el-form label-width="80px">
        <el-form-item label="用户名">
          <el-input v-model="resetPwdForm.userName" disabled />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input
            v-model="resetPwdForm.password"
            type="password"
            placeholder="请输入新密码"
            show-password
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resetPwdDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitResetPwd">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.system-user {
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
}
</style>
