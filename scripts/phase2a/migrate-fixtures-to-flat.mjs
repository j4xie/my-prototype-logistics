/**
 * migrate-fixtures-to-flat.mjs
 *
 * One-time migration: add top-level alias fields (verb / path / factory) to
 * existing java-smartbi-golden fixtures that were recorded before the
 * record-java-golden.mjs update (Phase 2A T2 P1-1 fix).
 *
 * Also detects HTTP-200 + success:false responses and marks them with
 * _serverSuccessFalse: true in the response object (P1-2 fix).
 *
 * Safe to run multiple times — already-migrated files are skipped.
 *
 * Usage:
 *   node scripts/phase2a/migrate-fixtures-to-flat.mjs
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const DIR = path.join(REPO_ROOT, 'tests/fixtures/java-smartbi-golden');

const files = await fs.readdir(DIR);
let migrated = 0;
let alreadyFlat = 0;
let skippedNoMeta = 0;
let flaggedSuccessFalse = 0;

for (const f of files.sort()) {
  if (!f.endsWith('.json')) continue;

  const p = path.join(DIR, f);
  const raw = await fs.readFile(p, 'utf8');
  const data = JSON.parse(raw);

  // Detect and flag HTTP-200 success:false responses (P1-2)
  // Do this regardless of whether we need to flatten, so existing flat files
  // also get the flag if they're missing it.
  const response = data.response;
  let needsSuccessFalseFlag = false;
  if (
    response &&
    typeof response === 'object' &&
    response.httpStatus === 200 &&
    response.success === false &&
    !response._serverSuccessFalse
  ) {
    needsSuccessFalseFlag = true;
  }

  // Check if already flat (P1-1)
  if (data.verb && data.path && data.factory) {
    alreadyFlat++;
    // Still apply success:false flag if needed
    if (needsSuccessFalseFlag) {
      data.response._serverSuccessFalse = true;
      await fs.writeFile(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
      flaggedSuccessFalse++;
      console.log(`FLAG  ${f} (success:false, already flat)`);
    }
    continue;
  }

  // Needs top-level alias fields
  if (!data._meta) {
    console.warn(`SKIP  ${f}: no _meta field`);
    skippedNoMeta++;
    continue;
  }

  const m = data._meta;

  // Build migrated fixture: top-level aliases first, then response, then _meta
  const out = {
    // Spec-required top-level fields (T5 contract test reads these)
    verb: m.verb,
    path: m.path,
    factory: m.factory,
    response: data.response,
    // Preserve detail metadata
    _meta: m,
  };

  // Preserve any other original top-level fields that aren't the four we handle
  for (const k of Object.keys(data)) {
    if (!['verb', 'path', 'factory', 'response', '_meta'].includes(k)) {
      out[k] = data[k];
    }
  }

  // Apply success:false flag on the response inside out
  if (needsSuccessFalseFlag) {
    out.response._serverSuccessFalse = true;
    flaggedSuccessFalse++;
  }

  await fs.writeFile(p, JSON.stringify(out, null, 2) + '\n', 'utf8');
  migrated++;

  const flagNote = needsSuccessFalseFlag ? ' [+serverSuccessFalse]' : '';
  console.log(`OK    ${f}${flagNote}`);
}

console.log('');
console.log(`migrated:             ${migrated}`);
console.log(`already flat (skip):  ${alreadyFlat}`);
console.log(`skipped (no _meta):   ${skippedNoMeta}`);
console.log(`flagged success:false: ${flaggedSuccessFalse}`);
