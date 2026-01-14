<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch } from "vue";
import { useRouter } from "vue-router";
import { Search, Refresh, MagicStick, View } from "@element-plus/icons-vue";
import { message } from "@/utils/message";
import { getThemes, getModules } from "@/api/mall/decoration";
import type { DecorationTheme, DecorationModule } from "@/api/mall/types/decoration";
import MerchantSelect from "@/components/MerchantSelect/index.vue";

defineOptions({
  name: "DecorationIndex"
});

const router = useRouter();

// 当前选中的商户
const selectedMerchantId = ref<number | null>(null);

// 主题列表
const themes = ref<DecorationTheme[]>([]);
const loadingThemes = ref(false);

// 模块列表
const modules = ref<DecorationModule[]>([]);
const loadingModules = ref(false);

// 筛选
const styleFilter = ref("");

// 获取主题列表
const fetchThemes = async () => {
  loadingThemes.value = true;
  try {
    const res = await getThemes(styleFilter.value || undefined);
    if (res.code === 200) {
      themes.value = res.data || [];
    } else {
      message(res.msg || "获取主题失败", { type: "error" });
    }
  } catch (error) {
    message("获取主题失败", { type: "error" });
  } finally {
    loadingThemes.value = false;
  }
};

// 获取模块列表
const fetchModules = async () => {
  loadingModules.value = true;
  try {
    const res = await getModules();
    if (res.code === 200) {
      modules.value = res.data || [];
    } else {
      message(res.msg || "获取模块失败", { type: "error" });
    }
  } catch (error) {
    message("获取模块失败", { type: "error" });
  } finally {
    loadingModules.value = false;
  }
};

// 解析主题配色
const parseColorConfig = (colorConfig: string | undefined) => {
  if (!colorConfig) return {};
  try {
    return JSON.parse(colorConfig);
  } catch {
    return {};
  }
};

// 跳转AI装修
const goToAiDesign = () => {
  if (!selectedMerchantId.value) {
    message("请先选择要装修的商户", { type: "warning" });
    return;
  }
  router.push(`/mall/merchant/decoration/ai-design?merchantId=${selectedMerchantId.value}`);
};

// 风格标签颜色
const getStyleTagType = (style: string) => {
  const map: Record<string, string> = {
    fresh: "success",
    luxury: "warning",
    simple: "",
    dopamine: "danger",
    elegant: "info"
  };
  return map[style] || "";
};

// 风格名称
const getStyleName = (tags: string | undefined) => {
  if (!tags) return "通用";
  const map: Record<string, string> = {
    fresh: "清新",
    luxury: "奢华",
    simple: "简约",
    dopamine: "多巴胺",
    elegant: "优雅"
  };
  const firstTag = tags.split(",")[0];
  return map[firstTag] || tags;
};

onMounted(() => {
  fetchThemes();
  fetchModules();
});
</script>

<template>
  <div class="decoration-container">
    <!-- 顶部操作栏 -->
    <el-card shadow="never" class="mb-4">
      <div class="flex justify-between items-center">
        <div class="flex items-center gap-4">
          <span class="text-lg font-medium">店铺装修管理</span>
          <el-divider direction="vertical" />
          <span class="text-sm text-gray-500">选择商户：</span>
          <MerchantSelect
            v-model="selectedMerchantId"
            placeholder="请选择要装修的商户"
            :clearable="false"
            :width="200"
          />
          <el-divider direction="vertical" />
          <el-select
            v-model="styleFilter"
            placeholder="筛选风格"
            clearable
            style="width: 120px"
            @change="fetchThemes"
          >
            <el-option label="清新" value="fresh" />
            <el-option label="奢华" value="luxury" />
            <el-option label="简约" value="simple" />
            <el-option label="多巴胺" value="dopamine" />
          </el-select>
        </div>
        <el-button type="primary" :icon="MagicStick" @click="goToAiDesign">
          AI智能装修
        </el-button>
      </div>
    </el-card>

    <!-- 主题预设 -->
    <el-card shadow="never" class="mb-4">
      <template #header>
        <div class="flex justify-between items-center">
          <span class="font-medium">主题预设</span>
          <el-button text :icon="Refresh" @click="fetchThemes">刷新</el-button>
        </div>
      </template>

      <div v-loading="loadingThemes" class="theme-grid">
        <div
          v-for="theme in themes"
          :key="theme.id"
          class="theme-card"
        >
          <div
            class="theme-preview"
            :style="{
              background: `linear-gradient(135deg, ${parseColorConfig(theme.colorConfig).primaryColor || '#52c41a'}, ${parseColorConfig(theme.colorConfig).secondaryColor || '#73d13d'})`
            }"
          >
            <div class="theme-overlay">
              <el-button
                type="primary"
                size="small"
                :icon="View"
                circle
              />
            </div>
          </div>
          <div class="theme-info">
            <div class="theme-name">{{ theme.name }}</div>
            <div class="theme-tags">
              <el-tag
                size="small"
                :type="getStyleTagType(theme.styleTags?.split(',')[0] || '')"
              >
                {{ getStyleName(theme.styleTags) }}
              </el-tag>
            </div>
          </div>
        </div>
      </div>

      <el-empty v-if="!loadingThemes && themes.length === 0" description="暂无主题" />
    </el-card>

    <!-- 可用模块 -->
    <el-card shadow="never">
      <template #header>
        <div class="flex justify-between items-center">
          <span class="font-medium">可用模块</span>
          <el-button text :icon="Refresh" @click="fetchModules">刷新</el-button>
        </div>
      </template>

      <div v-loading="loadingModules">
        <el-table :data="modules" stripe style="width: 100%">
          <el-table-column prop="name" label="模块名称" width="150" />
          <el-table-column prop="code" label="模块编码" width="180" />
          <el-table-column prop="moduleType" label="模块类型" width="120">
            <template #default="{ row }">
              <el-tag size="small">{{ row.moduleType }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="componentName" label="组件名" width="150" />
          <el-table-column prop="dataSourceApi" label="数据源API" />
          <el-table-column prop="status" label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">
                {{ row.status === 1 ? "启用" : "停用" }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <el-empty v-if="!loadingModules && modules.length === 0" description="暂无模块" />
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.decoration-container {
  padding: 20px;
}

.mb-4 {
  margin-bottom: 16px;
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}

.theme-card {
  border: 1px solid #eee;
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.3s;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);

    .theme-overlay {
      opacity: 1;
    }
  }
}

.theme-preview {
  height: 100px;
  position: relative;
}

.theme-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s;
}

.theme-info {
  padding: 12px;
}

.theme-name {
  font-weight: 500;
  margin-bottom: 8px;
}

.theme-tags {
  display: flex;
  gap: 4px;
}
</style>
