/**
 * Upload-specific helpers for the 500MB E2E test rounds.
 *
 * Kept separate from helpers.mjs to avoid bloating the main CRUD helper file.
 * Exported functions:
 *   - getAuthToken(page)                      — read JWT from localStorage after login
 *   - apiGet/apiPost/apiPostMultipart          — axios-free HTTP via Node fetch
 *   - listUploads(token, factoryId)            — GET /api/mobile/{fid}/smart-bi/uploads
 *   - countExcelUploads(token, factoryId)      — convenience count wrapper
 *   - uploadFileViaPage(page, filePath)        — Playwright setInputFiles for ElUpload
 *   - uploadFileViaApi(token, factoryId, file) — direct API upload (bypass UI)
 *   - queryRestaurantSection(factoryId, name)  — POST /api/smartbi/restaurant/sections/{name}
 *   - sha256OfFile(path)                        — fs.createReadStream + crypto
 */

import { readFileSync, statSync, createReadStream } from 'fs';
import { createHash } from 'crypto';
import { basename } from 'path';
import { BASE } from './helpers.mjs';

// API base: tests hit 139:8086 nginx which proxies /api/mobile/** → 47:10010 Java
// and /api/smartbi/** → 47:8083 Python.
export const API_BASE = process.env.E2E_API_BASE || BASE;

// ===== HTTP primitives =====

export async function apiGet(url, token = null) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { method: 'GET', headers });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, ok: res.ok, data, rawText: text };
}

export async function apiPostJson(url, body, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, ok: res.ok, data, rawText: text };
}

/**
 * Multipart POST using Node's built-in FormData (Node 18+).
 * For large files (>50MB) we use fs.createReadStream wrapped in a Blob-like to avoid
 * loading the whole file into memory.
 */
export async function apiPostMultipart(url, filePath, fields = {}, token = null, { timeoutMs = 180000 } = {}) {
  const stats = statSync(filePath);
  const fileName = basename(filePath);

  // Node 18+ supports FormData + Blob from undici. For large files this reads into memory
  // but that's acceptable for our fixture sizes (55-120MB) on a dev box with 16GB RAM.
  const buf = readFileSync(filePath);
  const blob = new Blob([buf], { type: guessMime(fileName) });

  const form = new FormData();
  form.append('file', blob, fileName);
  for (const [k, v] of Object.entries(fields)) {
    form.append(k, String(v));
  }

  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const t0 = Date.now();
    const res = await fetch(url, { method: 'POST', headers, body: form, signal: ctrl.signal });
    const elapsedMs = Date.now() - t0;
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return {
      status: res.status,
      ok: res.ok,
      data,
      rawText: text,
      elapsedMs,
      fileSize: stats.size,
      fileName,
    };
  } catch (err) {
    return {
      status: 0,
      ok: false,
      data: null,
      error: err.name === 'AbortError' ? 'TIMEOUT' : err.message,
      fileSize: stats.size,
      fileName,
    };
  } finally {
    clearTimeout(timer);
  }
}

function guessMime(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith('.csv')) return 'text/csv';
  if (lower.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (lower.endsWith('.xls')) return 'application/vnd.ms-excel';
  return 'application/octet-stream';
}

// ===== Auth token extraction =====

/**
 * After `login()` from helpers.mjs succeeds, extract the JWT from localStorage.
 * The web-admin stores it as 'admin-token' (see apiClient interceptor).
 */
export async function getAuthToken(page) {
  return await page.evaluate(() => {
    return (
      localStorage.getItem('cretas_access_token') ||
      localStorage.getItem('admin-token') ||
      localStorage.getItem('token') ||
      localStorage.getItem('accessToken') ||
      null
    );
  });
}

/**
 * Also read user's factoryId from localStorage to avoid hardcoding.
 */
export async function getLoggedInFactoryId(page) {
  return await page.evaluate(() => {
    try {
      const raw = localStorage.getItem('cretas_user');
      if (!raw) return null;
      const u = JSON.parse(raw);
      return u?.factoryUser?.factoryId || u?.platformUser?.factoryId || null;
    } catch {
      return null;
    }
  });
}

// ===== Upload-list API wrapper =====

export async function listUploads(token, factoryId) {
  const url = `${API_BASE}/api/mobile/${factoryId}/smart-bi/uploads`;
  return apiGet(url, token);
}

export async function countExcelUploads(token, factoryId) {
  const resp = await listUploads(token, factoryId);
  if (!resp.ok) return { count: -1, error: `HTTP ${resp.status}: ${resp.rawText?.slice(0, 200)}` };
  const arr = resp.data?.data?.content || resp.data?.data || resp.data || [];
  const count = Array.isArray(arr) ? arr.length : (resp.data?.data?.totalElements ?? -1);
  return { count, raw: resp.data };
}

// ===== Direct-API upload (bypasses browser) =====

export async function uploadFileViaApi(token, factoryId, filePath, dataType = 'pos') {
  const url = `${API_BASE}/api/mobile/${factoryId}/smart-bi/upload`;
  return apiPostMultipart(url, filePath, { data_type: dataType, dataType }, token, { timeoutMs: 300000 });
}

// ===== Browser-UI upload via Playwright =====

/**
 * Find the hidden <input type="file"> inside ElUpload and set the file.
 * ElUpload in web-admin renders as `<div class="upload-area"><input type="file" hidden></div>`.
 */
export async function uploadFileViaPage(page, filePath) {
  // Primary path: the direct input[type=file]
  const input = await page.$('input[type="file"]');
  if (input) {
    await input.setInputFiles(filePath);
    return { method: 'input', ok: true };
  }
  // Fallback: look for el-upload container
  const elUpload = await page.$('.el-upload input[type="file"]');
  if (elUpload) {
    await elUpload.setInputFiles(filePath);
    return { method: 'el-upload', ok: true };
  }
  return { method: null, ok: false, error: 'no file input found on page' };
}

// ===== Restaurant section query (bypasses chat UI) =====

export async function queryRestaurantSection(factoryId, sectionName, extraParams = {}, token = null) {
  const url = `${API_BASE}/api/smartbi/restaurant/sections/${sectionName}`;
  const body = {
    factory_id: factoryId,
    sub_sector: '火锅',
    period: 'current',
    params: extraParams,
  };
  return apiPostJson(url, body, token);
}

// ===== File hashing =====

export function sha256OfFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}
