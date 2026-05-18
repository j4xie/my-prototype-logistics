// PR #872 (#860 follow-up) — 转发 / 分享链接 API client.
//
// Backend:
//   - POST /api/mobile/{factoryId}/share-links   (authenticated, RBAC)
//   - GET  /api/mobile/public/share/{token}      (PUBLIC, anonymous)
//
// axios baseURL = '/api/mobile' so paths start at "/{factoryId}/..." for
// authenticated calls and "/public/share/..." for the anonymous public call.

import { get, post } from './request';

/** What entity the share points at. Backend matches Java simple class name. */
export type ShareLinkEntityType = 'PurchaseOrder' | 'SalesOrder';

export interface CreateShareLinkRequest {
  entityType: ShareLinkEntityType;
  entityId: string;
  /** 0 = permanent. UI presets: 7 / 30 / 90 / 0. */
  expiresDays: number;
  includePrice: boolean;
}

export interface ShareLinkResponse {
  token: string;
  /** Full URL ready for clipboard copy. */
  url: string;
  /** ISO-8601; null = permanent. */
  expiresAt: string | null;
  permanent: boolean;
}

/** Public share payload returned by GET /public/share/{token}. */
export interface PublicSharePayload {
  entityType: ShareLinkEntityType;
  entityLabel: string;
  includePrice: boolean;
  /** ISO-8601; null = permanent. */
  expiresAt: string | null;
  /** Entity-specific shape (PO or SO read-only fields). */
  payload: Record<string, unknown>;
}

/**
 * Authenticated admin call — create a share link.
 * Returns the token + full URL (so caller can copy directly to clipboard).
 */
export async function createShareLink(
  factoryId: string,
  body: CreateShareLinkRequest
): Promise<ShareLinkResponse> {
  const res = await post<ShareLinkResponse>(`/${factoryId}/share-links`, body);
  if (!res.success || !res.data) {
    throw new Error(res.message || '创建分享链接失败');
  }
  return res.data;
}

/**
 * Anonymous public read — fetch share payload by token.
 * Throws on 404 (unknown token) or 410 (expired / revoked); SharePage.vue
 * differentiates by inspecting the axios error response status.
 */
export async function resolvePublicShare(token: string): Promise<PublicSharePayload> {
  const res = await get<PublicSharePayload>(`/public/share/${encodeURIComponent(token)}`);
  if (!res.success || !res.data) {
    throw new Error(res.message || '分享链接已失效');
  }
  return res.data;
}
