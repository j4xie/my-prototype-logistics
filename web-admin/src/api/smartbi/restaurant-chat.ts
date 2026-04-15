/**
 * Restaurant Chat API Client (P5 Task 5.1).
 *
 * Calls the Java AIIntentService chat endpoint, which routes through
 * the Tool-Skill pipeline and (optionally) invokes Python sections.
 *
 * post<T>(url, data?, config?) returns Promise<ApiResponse<T>>.
 * The request interceptor in api/request.ts unwraps ApiResponse automatically:
 * if response.success is false it throws ApiError, otherwise returns the
 * ApiResponse object. So we cast to ChatQueryResponse directly.
 */
import type {
  ChatQueryRequest,
  ChatQueryResponse,
} from '@/types/restaurant-chat';
import { post } from './common';

/**
 * Send a natural language query to the restaurant diagnostic chat.
 * Routes through Java AIIntentService (layers 1-8: exact/phrase/regex/
 * keyword/semantic/classifier/fusion/LLM) → Tool or Skill execution →
 * (optionally) Python section endpoints for deep analysis.
 */
export async function askRestaurantQuestion(
  request: ChatQueryRequest,
): Promise<ChatQueryResponse> {
  const response = await post<ChatQueryResponse>(
    `/${request.factoryId}/smart-bi/query`,
    {
      query: request.query,
      userId: request.userId,
      context: {
        subSector: request.subSector,
        uploadId: request.uploadId,
      },
    },
  );
  // post<T> returns ApiResponse<T>; data holds the ChatQueryResponse.
  // If backend wraps response in { success, data }, unwrap it here.
  // If backend returns ChatQueryResponse directly (success field inline), use as-is.
  const raw = response as unknown as { data?: ChatQueryResponse } & ChatQueryResponse;
  return raw.data ?? raw;
}

/**
 * Clear conversation state for the current user session.
 * Calls the Java conversation clear endpoint which delegates to
 * ConversationStateService.clear(factoryId, userId).
 */
export async function clearRestaurantConversation(
  factoryId: string,
  userId: string,
): Promise<void> {
  await post<void>(
    `/${factoryId}/conversation/clear?userId=${encodeURIComponent(userId)}`,
    {},
  );
}
