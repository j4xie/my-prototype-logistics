/**
 * Composable for 餐饮指数字典 KB chat.
 *
 * Independent of useAiChat (which is form-fill specific). Wraps
 * sendKbChat with messages/loading/sources state.
 *
 * Multi-turn: sends `history` (last N user/assistant pairs) so the
 * Python rewriter can resolve follow-up references.
 */
import { ref } from 'vue';
import {
  sendKbChat,
  type KbChatMessage,
  type KbSourceRef,
} from '@/api/foodKb';

export interface KbChatTurn {
  role: 'user' | 'assistant';
  content: string;
  sources?: KbSourceRef[];
  relatedQuestions?: string[];
}

const MAX_HISTORY_TURNS = 10;
const DEFAULT_ERROR_REPLY = '抱歉，知识库暂时不可用，请稍后重试。';

export function useKbChat() {
  const messages = ref<KbChatTurn[]>([]);
  const loading = ref(false);
  const lastSources = ref<KbSourceRef[]>([]);
  const lastRelatedQuestions = ref<string[]>([]);

  function buildHistory(): KbChatMessage[] {
    return messages.value
      .slice(-MAX_HISTORY_TURNS * 2)
      .map((m) => ({ role: m.role, content: m.content }));
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading.value) return;

    const history = buildHistory();
    messages.value.push({ role: 'user', content: trimmed });
    loading.value = true;

    try {
      const res = await sendKbChat(trimmed, history);
      const answer = res.answer || DEFAULT_ERROR_REPLY;
      const sources = res.sources || [];
      const related = res.relatedQuestions || [];

      messages.value.push({
        role: 'assistant',
        content: answer,
        sources,
        relatedQuestions: related,
      });
      lastSources.value = sources;
      lastRelatedQuestions.value = related;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      messages.value.push({
        role: 'assistant',
        content: `${DEFAULT_ERROR_REPLY}（${detail}）`,
      });
      lastSources.value = [];
      lastRelatedQuestions.value = [];
    } finally {
      loading.value = false;
    }
  }

  function reset() {
    messages.value = [];
    loading.value = false;
    lastSources.value = [];
    lastRelatedQuestions.value = [];
  }

  return {
    messages,
    loading,
    lastSources,
    lastRelatedQuestions,
    sendMessage,
    reset,
  };
}
