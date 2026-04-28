/**
 * 餐饮指数字典 KB chat API client.
 * Calls FastAPI: POST /api/food-kb/manual-chat
 *
 * Uses pythonFetch (auto snake_case → camelCase). Server returns
 * `related_questions` → arrives as `relatedQuestions`.
 */
import { pythonFetch } from '@/api/smartbi/common';

export interface KbChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface KbSourceRef {
  title: string;
  source: string;
  similarity: number;
}

export interface KbChatResponse {
  success: boolean;
  answer: string;
  sources: KbSourceRef[];
  relatedQuestions: string[];
  message?: string;
}

export interface KbRelatedResponse {
  success: boolean;
  relatedQuestions: string[];
  message?: string;
}

export async function sendKbChat(
  question: string,
  history?: KbChatMessage[],
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<KbChatResponse> {
  const result = await pythonFetch('/api/food-kb/manual-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      history: history && history.length > 0 ? history : null,
    }),
    signal: options.signal,
    timeoutMs: options.timeoutMs ?? 60_000,
  });
  return result as KbChatResponse;
}

export async function fetchKbRelatedQuestions(
  question: string,
  answer: string,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<KbRelatedResponse> {
  const result = await pythonFetch('/api/food-kb/manual-chat/related', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, answer }),
    signal: options.signal,
    timeoutMs: options.timeoutMs ?? 15_000,
  });
  return result as KbRelatedResponse;
}
