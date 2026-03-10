import { post } from './request';

export interface AiChatRequest {
  messages: { role: string; content: string }[];
  temperature?: number;
}

export function sendAiChat(messages: { role: string; content: string }[], temperature = 0.3) {
  return post<string>('/ai/chat', { messages, temperature });
}
