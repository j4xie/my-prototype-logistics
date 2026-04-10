// tests/canvas-v3/lib/api-client.mjs
import axios from 'axios';
import { execSync } from 'child_process';

const NGINX_BASE = 'http://139.196.165.140:8086/api/mobile';
const SERVER = 'root@47.100.235.168';
const INTERNAL_KEY = 'cretas-internal-sec-87a9caca9f57b1f2';

// Detect which backend port is active (Blue=10010 or Green=10020) via ss on server.
// Cached once per ApiClient instance.
function detectActivePort() {
  try {
    const output = execSync(
      `ssh ${SERVER} "ss -tlnp | grep -oE ':100[12]0' | head -1"`,
      { encoding: 'utf8' }
    ).trim();
    const port = output.replace(':', '');
    if (port === '10010' || port === '10020') {
      return port;
    }
  } catch (e) {
    // fall through
  }
  return '10010'; // default to blue
}

export class ApiClient {
  constructor() {
    this.tokens = new Map(); // factoryId -> token
    this.activePort = detectActivePort();
    console.log(`[api-client] Active backend port: ${this.activePort}`);
  }

  setToken(factoryId, token) {
    this.tokens.set(factoryId, token);
  }

  getToken(factoryId) {
    return this.tokens.get(factoryId);
  }

  // Login via nginx
  async login(username, password) {
    const resp = await axios.post(
      `${NGINX_BASE}/auth/unified-login`,
      { username, password },
      { timeout: 15000 }
    );
    return resp.data;
  }

  // GET via nginx — path starts with /
  async authedGet(factoryId, path, params = {}, tokenFactoryId = null) {
    const token = this.tokens.get(tokenFactoryId || factoryId);
    if (!token) throw new Error(`No token for factory ${tokenFactoryId || factoryId}`);

    const resp = await axios.get(
      `${NGINX_BASE}/${factoryId}${path}`,
      { headers: { Authorization: `Bearer ${token}` }, params, timeout: 15000 }
    );
    return resp.data;
  }

  // POST via SSH to localhost:10020 — avoids nginx POST body issues
  // Uses base64 encoding to safely pass body through SSH shell (handles Chinese/special chars)
  async authedPost(factoryId, path, body, tokenFactoryId = null) {
    const token = this.tokens.get(tokenFactoryId || factoryId);
    if (!token) throw new Error(`No token for factory ${tokenFactoryId || factoryId}`);

    const bodyB64 = Buffer.from(JSON.stringify(body)).toString('base64');
    const cmd = `ssh ${SERVER} "echo ${bodyB64} | base64 -d | curl -s -X POST -H 'Authorization: Bearer ${token}' -H 'Content-Type: application/json' 'http://localhost:${this.activePort}/api/mobile/${factoryId}${path}' -d @-"`;
    const output = execSync(cmd, { encoding: 'utf8' });
    try {
      return JSON.parse(output);
    } catch (e) {
      return { _raw: output, _parseError: e.message };
    }
  }

  // PUT via SSH
  // Uses base64 encoding to safely pass body through SSH shell (handles Chinese/special chars)
  async authedPut(factoryId, path, body, tokenFactoryId = null) {
    const token = this.tokens.get(tokenFactoryId || factoryId);
    if (!token) throw new Error(`No token for factory ${tokenFactoryId || factoryId}`);

    const bodyB64 = Buffer.from(JSON.stringify(body)).toString('base64');
    const cmd = `ssh ${SERVER} "echo ${bodyB64} | base64 -d | curl -s -X PUT -H 'Authorization: Bearer ${token}' -H 'Content-Type: application/json' 'http://localhost:${this.activePort}/api/mobile/${factoryId}${path}' -d @-"`;
    const output = execSync(cmd, { encoding: 'utf8' });
    try {
      return JSON.parse(output);
    } catch (e) {
      return { _raw: output, _parseError: e.message };
    }
  }

  // Create factory via internal API (requires X-Internal-Key, SSH only)
  // Uses base64 encoding to safely pass body through SSH shell (handles Chinese/special chars)
  async createFactory(factoryName, industryCode = 'FOOD', regionCode = '3101') {
    const bodyB64 = Buffer.from(JSON.stringify({
      factoryName,
      industryCode,
      regionCode,
      contactName: 'Canvas测试管理员',
      contactPhone: '13800000099',
    })).toString('base64');
    const cmd = `ssh ${SERVER} "echo ${bodyB64} | base64 -d | curl -s -X POST -H 'X-Internal-Key: ${INTERNAL_KEY}' -H 'Content-Type: application/json' 'http://localhost:${this.activePort}/api/internal/onboarding/create-factory' -d @-"`;
    const output = execSync(cmd, { encoding: 'utf8' });
    return JSON.parse(output);
  }

  // Reset a user's password via the reset-password API endpoint
  // Uses a known bootstrap admin (factory_admin1/123456) which has factory_super_admin role
  // Returns the new password that was set
  resetUserPassword(factoryId, username, newPassword) {
    // Get a bootstrap admin token (factory_admin1 has factory_super_admin role)
    // Use base64 encoding to avoid shell escaping issues with JSON
    const loginBodyB64 = Buffer.from(JSON.stringify({ username: 'factory_admin1', password: '123456' })).toString('base64');
    const loginOut = execSync(
      `ssh ${SERVER} "echo ${loginBodyB64} | base64 -d | curl -s -X POST -H 'Content-Type: application/json' 'http://localhost:${this.activePort}/api/mobile/auth/unified-login' -d @-"`,
      { encoding: 'utf8' }
    );
    const loginData = JSON.parse(loginOut);
    if (!loginData.success) throw new Error(`Bootstrap admin login failed: ${loginData.message}`);
    const bootstrapToken = loginData.data.accessToken;

    const cmd = `ssh ${SERVER} "curl -s -X POST -H 'Authorization: Bearer ${bootstrapToken}' 'http://localhost:${this.activePort}/api/mobile/auth/reset-password?factoryId=${factoryId}&username=${username}&newPassword=${newPassword}'"`;
    const out = execSync(cmd, { encoding: 'utf8' });
    const result = JSON.parse(out);
    if (!result.success) throw new Error(`Password reset failed: ${result.message}`);
    return newPassword;
  }

  // Cross-factory HTTP status check (for isolation tests)
  crossFactoryHttpCode(urlFactoryId, tokenFactoryId, path) {
    const token = this.tokens.get(tokenFactoryId);
    if (!token) throw new Error(`No token for ${tokenFactoryId}`);
    const cmd = `ssh ${SERVER} "curl -s -o /dev/null -w '%{http_code}' -H 'Authorization: Bearer ${token}' 'http://localhost:${this.activePort}/api/mobile/${urlFactoryId}${path}'"`;
    return execSync(cmd, { encoding: 'utf8' }).trim();
  }
}
