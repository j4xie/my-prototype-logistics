/**
 * useBookmarks - SmartBI 书签/场景快照系统
 * 使用 localStorage 持久化，支持生成分享链接
 */
import { ref, readonly } from 'vue';

// ==================== Types ====================

export interface BookmarkState {
  uploadId?: number;
  periodType: string;
  year: number;
  startMonth: number;
  endMonth: number;
  chartTypes: string[];
  filters: Record<string, unknown>;
  viewMode?: string;
  [key: string]: unknown;
}

export interface Bookmark {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  state: BookmarkState;
  thumbnail?: string;
}

// ==================== Constants ====================

const STORAGE_PREFIX = 'smartbi_bookmarks_';
const AUTO_SAVE_KEY_SUFFIX = '__last';
const MAX_BOOKMARKS = 50;

// ==================== Helpers ====================

function generateId(): string {
  return `bm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function storageKey(dashboardId: string): string {
  return `${STORAGE_PREFIX}${dashboardId}`;
}

function autoSaveKey(dashboardId: string): string {
  return `${STORAGE_PREFIX}${dashboardId}${AUTO_SAVE_KEY_SUFFIX}`;
}

function loadFromStorage(key: string): Bookmark[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw) as Bookmark[];
  } catch {
    return [];
  }
}

function saveToStorage(key: string, data: Bookmark[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn('[useBookmarks] localStorage write failed:', e);
  }
}

function encodeState(state: BookmarkState): string {
  try {
    return btoa(encodeURIComponent(JSON.stringify(state)));
  } catch {
    return '';
  }
}

function decodeState(encoded: string): BookmarkState | null {
  try {
    return JSON.parse(decodeURIComponent(atob(encoded))) as BookmarkState;
  } catch {
    return null;
  }
}

// ==================== Composable ====================

export function useBookmarks(dashboardId: string) {
  const bookmarks = ref<Bookmark[]>([]);
  const activeBookmarkId = ref<string | null>(null);

  // ---------- Load ----------

  function loadBookmarks(): void {
    bookmarks.value = loadFromStorage(storageKey(dashboardId));
  }

  // ---------- Save ----------

  function saveBookmark(
    name: string,
    state: BookmarkState,
    description?: string
  ): Bookmark {
    const now = new Date().toISOString();
    const bookmark: Bookmark = {
      id: generateId(),
      name,
      description,
      createdAt: now,
      updatedAt: now,
      state: { ...state },
    };

    const existing = loadFromStorage(storageKey(dashboardId));

    // Enforce max limit — remove oldest
    while (existing.length >= MAX_BOOKMARKS) existing.shift();

    existing.push(bookmark);
    saveToStorage(storageKey(dashboardId), existing);
    bookmarks.value = [...existing];
    activeBookmarkId.value = bookmark.id;

    return bookmark;
  }

  // ---------- Apply ----------

  function applyBookmark(id: string): BookmarkState | null {
    const bm = bookmarks.value.find(b => b.id === id);
    if (!bm) return null;
    activeBookmarkId.value = id;
    return { ...bm.state };
  }

  // ---------- Update ----------

  function updateBookmark(id: string, updates: Partial<Bookmark>): void {
    const existing = loadFromStorage(storageKey(dashboardId));
    const idx = existing.findIndex(b => b.id === id);
    if (idx < 0) return;
    existing[idx] = {
      ...existing[idx],
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
    };
    saveToStorage(storageKey(dashboardId), existing);
    bookmarks.value = [...existing];
  }

  // ---------- Delete ----------

  function deleteBookmark(id: string): void {
    const existing = loadFromStorage(storageKey(dashboardId)).filter(b => b.id !== id);
    saveToStorage(storageKey(dashboardId), existing);
    bookmarks.value = [...existing];
    if (activeBookmarkId.value === id) activeBookmarkId.value = null;
  }

  // ---------- Auto-save ----------

  function autoSaveLastState(state: BookmarkState): void {
    try {
      localStorage.setItem(autoSaveKey(dashboardId), JSON.stringify(state));
    } catch (e) {
      console.warn('[useBookmarks] auto-save failed:', e);
    }
  }

  function restoreLastState(): BookmarkState | null {
    try {
      const raw = localStorage.getItem(autoSaveKey(dashboardId));
      if (!raw) return null;
      return JSON.parse(raw) as BookmarkState;
    } catch {
      return null;
    }
  }

  // ---------- Share URL ----------

  function generateShareUrl(id: string): string {
    const bm = bookmarks.value.find(b => b.id === id);
    if (!bm) return window.location.href;
    const encoded = encodeState(bm.state);
    const url = new URL(window.location.href);
    url.searchParams.set('bm', encoded);
    url.searchParams.set('bmName', encodeURIComponent(bm.name));
    return url.toString();
  }

  function parseShareUrl(url: string): BookmarkState | null {
    try {
      const u = new URL(url);
      const encoded = u.searchParams.get('bm');
      if (!encoded) return null;
      return decodeState(encoded);
    } catch {
      return null;
    }
  }

  // ---------- Reorder ----------

  function reorderBookmarks(newOrder: string[]): void {
    const existing = loadFromStorage(storageKey(dashboardId));
    const map = new Map(existing.map(b => [b.id, b]));
    const reordered = newOrder.map(id => map.get(id)).filter(Boolean) as Bookmark[];
    // Append any not in newOrder at the end
    for (const b of existing) {
      if (!newOrder.includes(b.id)) reordered.push(b);
    }
    saveToStorage(storageKey(dashboardId), reordered);
    bookmarks.value = [...reordered];
  }

  // ---------- Init ----------

  loadBookmarks();

  return {
    bookmarks: readonly(bookmarks),
    activeBookmarkId: readonly(activeBookmarkId),
    loadBookmarks,
    saveBookmark,
    applyBookmark,
    updateBookmark,
    deleteBookmark,
    autoSaveLastState,
    restoreLastState,
    generateShareUrl,
    parseShareUrl,
    reorderBookmarks,
  };
}
