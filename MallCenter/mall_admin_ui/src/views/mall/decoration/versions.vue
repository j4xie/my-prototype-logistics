<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { ArrowLeft, RefreshRight } from "@element-plus/icons-vue";
import { ElMessageBox } from "element-plus";
import { message } from "@/utils/message";
import { getVersionHistory, rollbackVersion } from "@/api/mall/decoration";

defineOptions({ name: "DecorationVersions" });

const router = useRouter();
const route = useRoute();

const merchantId = computed(() =>
  route.query.merchantId ? Number(route.query.merchantId) : undefined
);
const merchantName = computed(
  () => (route.query.merchantName as string) || `商户 #${merchantId.value}`
);

const loading = ref(false);
const versions = ref<any[]>([]);

const goBack = () => router.back();

const fetchVersions = async () => {
  if (!merchantId.value) return;
  loading.value = true;
  try {
    const res = await getVersionHistory(merchantId.value, "home");
    if (res.code === 200) {
      versions.value = res.data || [];
    } else {
      message(res.msg || "获取版本历史失败", { type: "error" });
    }
  } catch {
    message("获取版本历史失败", { type: "error" });
  } finally {
    loading.value = false;
  }
};

const handleRollback = async (version: any) => {
  if (!merchantId.value) return;
  try {
    await ElMessageBox.confirm(
      `确认回滚到版本 "${version.description || version.id}"？当前配置将被覆盖。`,
      "确认回滚",
      { type: "warning" }
    );
  } catch {
    return;
  }

  try {
    const res = await rollbackVersion(version.id, merchantId.value);
    if (res.code === 200) {
      message("回滚成功", { type: "success" });
      fetchVersions();
    } else {
      message(res.msg || "回滚失败", { type: "error" });
    }
  } catch {
    message("回滚失败", { type: "error" });
  }
};

const formatTime = (time: string) => {
  if (!time) return "-";
  return new Date(time).toLocaleString("zh-CN");
};

const parseModules = (config: string) => {
  if (!config) return [];
  try {
    const parsed = JSON.parse(config);
    if (parsed.modulesConfig) {
      const modules =
        typeof parsed.modulesConfig === "string"
          ? JSON.parse(parsed.modulesConfig)
          : parsed.modulesConfig;
      return Array.isArray(modules) ? modules : [];
    }
    return [];
  } catch {
    return [];
  }
};

onMounted(fetchVersions);
</script>

<template>
  <div class="versions-container">
    <div class="versions-header">
      <el-button :icon="ArrowLeft" text @click="goBack">返回</el-button>
      <div class="header-title">
        <span class="title">版本历史</span>
        <el-tag size="small" type="info">{{ merchantName }}</el-tag>
      </div>
      <el-button :icon="RefreshRight" @click="fetchVersions">刷新</el-button>
    </div>

    <div v-loading="loading" class="versions-body">
      <el-timeline v-if="versions.length">
        <el-timeline-item
          v-for="(v, idx) in versions"
          :key="v.id"
          :timestamp="formatTime(v.createTime)"
          :type="idx === 0 ? 'primary' : ''"
          :hollow="idx !== 0"
        >
          <el-card shadow="hover" class="version-card">
            <div class="version-info">
              <div class="version-main">
                <el-tag v-if="idx === 0" size="small" type="success">当前版本</el-tag>
                <span class="version-desc">
                  {{ v.description || `版本 #${v.id}` }}
                </span>
                <el-tag v-if="v.source" size="small" type="info">
                  {{ v.source === "ai_chat" ? "AI对话" : v.source === "manual" ? "手动保存" : v.source }}
                </el-tag>
              </div>
              <div class="version-modules">
                <el-tag
                  v-for="mod in parseModules(v.configSnapshot).slice(0, 6)"
                  :key="mod.type"
                  size="small"
                  effect="plain"
                  class="mod-tag"
                >
                  {{ mod.type }}
                </el-tag>
                <span
                  v-if="parseModules(v.configSnapshot).length > 6"
                  class="more-modules"
                >
                  +{{ parseModules(v.configSnapshot).length - 6 }}
                </span>
              </div>
            </div>
            <div class="version-actions">
              <el-button
                v-if="idx !== 0"
                size="small"
                type="warning"
                @click="handleRollback(v)"
              >
                回滚到此版本
              </el-button>
            </div>
          </el-card>
        </el-timeline-item>
      </el-timeline>

      <el-empty v-else-if="!loading" description="暂无版本历史" />
    </div>
  </div>
</template>

<style scoped>
.versions-container {
  padding: 20px;
}

.versions-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-title .title {
  font-size: 16px;
  font-weight: 600;
}

.versions-body {
  max-width: 800px;
}

.version-card {
  margin-bottom: 4px;
}

.version-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.version-main {
  display: flex;
  align-items: center;
  gap: 8px;
}

.version-desc {
  font-weight: 500;
}

.version-modules {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.mod-tag {
  font-size: 11px;
}

.more-modules {
  font-size: 12px;
  color: #909399;
  padding: 0 4px;
}

.version-actions {
  margin-top: 10px;
}
</style>
