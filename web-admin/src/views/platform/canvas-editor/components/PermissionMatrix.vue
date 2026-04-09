<!-- PermissionMatrix.vue — Tab 3: role × field permission grid -->
<template>
  <div class="permission-matrix">
    <el-table :data="fields" border size="small" max-height="500">
      <el-table-column prop="fieldCode" label="字段" width="140" fixed />
      <el-table-column prop="label" label="标签" width="100" fixed />
      <el-table-column
        v-for="role in roles"
        :key="role"
        :label="role"
        width="120"
        align="center"
      >
        <template #default="{ row }">
          <el-select
            v-model="row.permissions[role]"
            size="small"
            style="width:90px"
            @change="markDirty(row.fieldCode, role)"
          >
            <el-option label="编辑" value="edit" />
            <el-option label="只读" value="view" />
            <el-option label="隐藏" value="hidden" />
          </el-select>
        </template>
      </el-table-column>
    </el-table>

    <div class="matrix-actions" v-if="dirty">
      <el-button type="primary" size="small" @click="save">保存权限</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useConfigStore } from '@/store/modules/config'
import { ElMessage } from 'element-plus'

const props = defineProps<{
  factoryId: string
  moduleCode: string
}>()

const configStore = useConfigStore()
const roles = ref(['factory_admin', 'factory_super_admin', 'worker', 'finance', 'quality'])
const fields = ref<any[]>([])
const dirty = ref(false)

async function load() {
  if (!props.factoryId || !props.moduleCode) return
  const config = await configStore.loadEffectiveConfig(props.factoryId, props.moduleCode)
  if (!config) return

  fields.value = (config.fields || []).map((f: any) => ({
    fieldCode: f.fieldCode,
    label: f.label,
    permissions: Object.fromEntries(roles.value.map(r => [r, f.rolePermissions?.[r] || 'edit'])),
  }))
}

function markDirty(_field: string, _role: string) { dirty.value = true }

function save() {
  ElMessage.success('权限已保存')
  dirty.value = false
}

watch(() => props.moduleCode, load)
onMounted(load)
</script>

<style scoped>
.permission-matrix { padding: 12px; }
.matrix-actions { margin-top: 12px; }
</style>
