/**
 * 教程引导状态管理
 *
 * 支持多个教程(首页/工序操作/批次管理)
 * 每个教程有多个步骤，首次使用自动触发
 * "我的"页面可重置所有教程
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface TutorialStep {
  /** 图标名 (MaterialCommunityIcons) */
  icon: string;
  /** 图标颜色 */
  iconColor?: string;
  /** 图标背景色 */
  iconBg?: string;
  /** 标题 */
  title: string;
  /** 说明文字 */
  text: string;
}

export interface TutorialConfig {
  id: string;
  steps: TutorialStep[];
}

interface TutorialState {
  completedTutorials: Record<string, boolean>;
  activeTutorial: string | null;
  activeStep: number;

  startTutorial: (tutorialId: string) => void;
  nextStep: (totalSteps: number) => void;
  skipTutorial: () => void;
  completeTutorial: () => void;
  resetAllTutorials: () => void;
  isTutorialCompleted: (tutorialId: string) => boolean;
  shouldAutoStart: (tutorialId: string) => boolean;
}

export const useTutorialStore = create<TutorialState>()(
  persist(
    (set, get) => ({
      completedTutorials: {},
      activeTutorial: null,
      activeStep: 0,

      startTutorial: (tutorialId) => {
        set({ activeTutorial: tutorialId, activeStep: 0 });
      },

      nextStep: (totalSteps) => {
        const { activeStep, activeTutorial } = get();
        if (activeStep + 1 >= totalSteps) {
          // Tutorial complete
          set((state) => ({
            activeTutorial: null,
            activeStep: 0,
            completedTutorials: {
              ...state.completedTutorials,
              [activeTutorial!]: true,
            },
          }));
        } else {
          set({ activeStep: activeStep + 1 });
        }
      },

      skipTutorial: () => {
        const { activeTutorial } = get();
        if (activeTutorial) {
          set((state) => ({
            activeTutorial: null,
            activeStep: 0,
            completedTutorials: {
              ...state.completedTutorials,
              [activeTutorial]: true,
            },
          }));
        }
      },

      completeTutorial: () => {
        const { activeTutorial } = get();
        if (activeTutorial) {
          set((state) => ({
            activeTutorial: null,
            activeStep: 0,
            completedTutorials: {
              ...state.completedTutorials,
              [activeTutorial]: true,
            },
          }));
        }
      },

      resetAllTutorials: () => {
        set({ completedTutorials: {}, activeTutorial: null, activeStep: 0 });
      },

      isTutorialCompleted: (tutorialId) => {
        return get().completedTutorials[tutorialId] === true;
      },

      shouldAutoStart: (tutorialId) => {
        return !get().completedTutorials[tutorialId] && get().activeTutorial === null;
      },
    }),
    {
      name: 'tutorial-state',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// ==================== Tutorial Configs ====================

export const TUTORIAL_HOME: TutorialConfig = {
  id: 'ws-home',
  steps: [
    {
      icon: 'cog-play', iconColor: '#4F46E5', iconBg: '#EEF2FF',
      title: '工序操作',
      text: '这是你最常用的功能。选择工序后可以给员工扫码签到/签退记工时，也可以直接报产量。一个入口完成所有操作。',
    },
    {
      icon: 'clipboard-check', iconColor: '#059669', iconBg: '#ECFDF5',
      title: '我的报工',
      text: '查看你提交过的所有报工记录，包括每条的审批状态（待审批/已通过/已驳回）。',
    },
    {
      icon: 'pencil-outline', iconColor: '#666', iconBg: '#f5f5f5',
      title: '自定义快捷操作',
      text: '点击快捷操作右上角的铅笔图标，可以添加或隐藏功能按钮，按你的习惯自定义。',
    },
    {
      icon: 'clipboard-list', iconColor: '#2563EB', iconBg: '#EFF6FF',
      title: '下一批任务',
      text: '首页蓝色卡片显示你下一个需要处理的生产任务。点击"开始任务"可以进入执行流程。',
    },
    {
      icon: 'view-dashboard', iconColor: '#7C3AED', iconBg: '#F5F3FF',
      title: '底部导航',
      text: '底部Tab可以切换到：批次管理（查看所有批次）、人员管理（查看员工状态）、我的（设置和教程）。',
    },
  ],
};

export const TUTORIAL_PROCESS_OPERATION: TutorialConfig = {
  id: 'ws-process-operation',
  steps: [
    {
      icon: 'format-list-checks', iconColor: '#EA580C', iconBg: '#FFF7ED',
      title: '第一步：选择工序',
      text: '进入后先选择你要操作的工序。每张卡片显示工序名称、计划量和完成进度。',
    },
    {
      icon: 'login', iconColor: '#059669', iconBg: '#ECFDF5',
      title: '第二步：员工签到',
      text: '选好工序后，点击绿色"扫码签到"按钮，扫描员工工牌完成签到。系统自动记录上班时间。',
    },
    {
      icon: 'logout', iconColor: '#DC2626', iconBg: '#FEF2F2',
      title: '员工签退',
      text: '下班时点击红色"扫码签退"按钮，扫描工牌签退。系统自动计算每人每工序的工时。',
    },
    {
      icon: 'counter', iconColor: '#2563EB', iconBg: '#EFF6FF',
      title: '第三步：报产量',
      text: '在下方输入这个时间段的产出数量，点击提交。可以每小时报一次，系统会自动累加。提交后等待主管审批。',
    },
    {
      icon: 'qrcode-scan', iconColor: '#7C3AED', iconBg: '#F5F3FF',
      title: '代报工',
      text: '报产量时可以先扫描员工工牌，记录是谁生产的。不扫就默认是你自己报的。',
    },
  ],
};

export const TUTORIAL_BATCHES: TutorialConfig = {
  id: 'ws-batches',
  steps: [
    {
      icon: 'filter-variant', iconColor: '#1890ff', iconBg: '#E6F7FF',
      title: '筛选批次',
      text: '顶部标签可以按状态筛选：全部、进行中、待开始、已完成。快速找到你要管理的批次。',
    },
    {
      icon: 'package-variant', iconColor: '#059669', iconBg: '#ECFDF5',
      title: '批次详情',
      text: '点击任意批次卡片查看详情，包括生产进度、原料消耗和报工记录。',
    },
    {
      icon: 'format-list-checks', iconColor: '#EA580C', iconBg: '#FFF7ED',
      title: '工序视图',
      text: '点击右上角可切换到工序任务视图，按工序查看进度和报工。',
    },
  ],
};
