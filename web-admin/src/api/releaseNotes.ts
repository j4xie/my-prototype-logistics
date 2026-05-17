// U-FEED-1 (Sprint 4 Wave 2 Chat L) — release-notes feed API client.
import { get } from './request';

export interface ReleaseNote {
  id: string;
  version: string;
  title: string;
  body: string; // markdown
  severity: 'info' | 'improvement' | 'breaking';
  publishedAt: string; // YYYY-MM-DD
  expiresAt?: string | null;
}

interface ListResponse {
  content: ReleaseNote[];
  total: number;
}

export async function fetchActiveReleaseNotes(limit = 10): Promise<ReleaseNote[]> {
  // #820 fix: baseURL 已是 /api/mobile, 这里不能再加 /mobile 否则成 /api/mobile/mobile/...
  const res = await get<ListResponse>('/system/release-notes', { params: { limit } });
  if (!res.success || !res.data) return [];
  return res.data.content ?? [];
}
