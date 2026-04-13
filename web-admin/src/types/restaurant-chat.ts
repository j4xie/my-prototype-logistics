/**
 * Restaurant chat panel types (P5 Task 5.1).
 *
 * Data flow:
 *   User input → ChatQueryRequest → Java endpoint → ChatQueryResponse
 *   → ChatTurn[] in panel state → rendered as ChatBubble with SectionPayload[]
 */

/** Output from one Python section endpoint (one entry in sections array) */
export interface SectionPayload {
  sectionName: string;
  status: 'ok' | 'skipped' | 'failed';
  data: Record<string, unknown>;       // Shape depends on sectionName
  warnings: string[];
  fromCache: boolean;
  computedAtMs: number;
}

/** A single chat turn (user message or AI response) */
export interface ChatTurn {
  id: string;
  role: 'user' | 'ai' | 'system';
  content: string;                     // Raw user text OR AI headline
  timestamp: number;
  intentCode?: string;
  toolName?: string;
  skillName?: string;
  sections?: SectionPayload[];
  followUpChips?: string[];
  error?: string;
}

/** Request to Java chat endpoint */
export interface ChatQueryRequest {
  query: string;
  factoryId: string;
  userId: string;
  subSector?: string;
  uploadId?: string;
}

/** Response from Java chat endpoint */
export interface ChatQueryResponse {
  success: boolean;
  intentCode: string;
  toolName?: string;
  skillName?: string;
  message?: string;
  sections: SectionPayload[];
  followUpChips?: string[];
  error?: string;
}
