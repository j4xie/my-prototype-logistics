import * as fs from 'fs';
import * as path from 'path';

export interface SharedState {
  createdAt: string;
  orderCode?: string;
  planCode?: string;
  fmrCode?: string;
  batchNumber?: string;
  productId?: number;
  productName?: string;
  quantity?: number;
}

const STATE_FILE = path.join(__dirname, '..', '.shared-state.json');

export function writeState(state: Partial<SharedState>): void {
  const existing = readState();
  const merged: SharedState = {
    createdAt: new Date().toISOString(),
    ...existing,
    ...state,
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(merged, null, 2), 'utf-8');
}

export function readState(): SharedState | null {
  if (!fs.existsSync(STATE_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

export function clearState(): void {
  if (fs.existsSync(STATE_FILE)) {
    fs.unlinkSync(STATE_FILE);
  }
}

export function requireState(): SharedState {
  const s = readState();
  if (!s) {
    throw new Error(
      `.shared-state.json 不存在 — 这个 spec 依赖 cross-end-phase1 先跑`
    );
  }
  return s;
}
