// tests/canvas-v3/lib/api-client.mjs
import axios from 'axios';
import { execSync } from 'child_process';

const NGINX_BASE = 'http://139.196.165.140:8086/api/mobile';
const SERVER = 'root@47.100.235.168';
const INTERNAL_KEY = 'cretas-internal-sec-87a9caca9f57b1f2';

export class ApiClient {
  constructor() {
    this.tokens = new Map(); // factoryId -> token
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
  async authedPost(factoryId, path, body, tokenFactoryId = null) {
    const token = this.tokens.get(tokenFactoryId || factoryId);
    if (!token) throw new Error(`No token for factory ${tokenFactoryId || factoryId}`);

    // Escape JSON for shell
    const bodyJson = JSON.stringify(body).replace(/'/g, "'\\''");
    const cmd = `ssh ${SERVER} "curl -s -X POST -H 'Authorization: Bearer ${token}' -H 'Content-Type: application/json' 'http://localhost:10020/api/mobile/${factoryId}${path}' -d '${bodyJson}'"`;
    const output = execSync(cmd, { encoding: 'utf8' });
    try {
      return JSON.parse(output);
    } catch (e) {
      return { _raw: output, _parseError: e.message };
    }
  }

  // PUT via SSH
  async authedPut(factoryId, path, body, tokenFactoryId = null) {
    const token = this.tokens.get(tokenFactoryId || factoryId);
    if (!token) throw new Error(`No token for factory ${tokenFactoryId || factoryId}`);

    const bodyJson = JSON.stringify(body).replace(/'/g, "'\\''");
    const cmd = `ssh ${SERVER} "curl -s -X PUT -H 'Authorization: Bearer ${token}' -H 'Content-Type: application/json' 'http://localhost:10020/api/mobile/${factoryId}${path}' -d '${bodyJson}'"`;
    const output = execSync(cmd, { encoding: 'utf8' });
    try {
      return JSON.parse(output);
    } catch (e) {
      return { _raw: output, _parseError: e.message };
    }
  }

  // Create factory via internal API (requires X-Internal-Key, SSH only)
  async createFactory(factoryName, industryCode = 'FOOD', regionCode = '3101') {
    const body = JSON.stringify({
      factoryName,
      industryCode,
      regionCode,
      contactName: 'Canvas测试管理员',
      contactPhone: '13800000099',
    }).replace(/'/g, "'\\''");
    const cmd = `ssh ${SERVER} "curl -s -X POST -H 'X-Internal-Key: ${INTERNAL_KEY}' -H 'Content-Type: application/json' 'http://localhost:10020/api/internal/onboarding/create-factory' -d '${body}'"`;
    const output = execSync(cmd, { encoding: 'utf8' });
    return JSON.parse(output);
  }

  // Cross-factory HTTP status check (for isolation tests)
  crossFactoryHttpCode(urlFactoryId, tokenFactoryId, path) {
    const token = this.tokens.get(tokenFactoryId);
    if (!token) throw new Error(`No token for ${tokenFactoryId}`);
    const cmd = `ssh ${SERVER} "curl -s -o /dev/null -w '%{http_code}' -H 'Authorization: Bearer ${token}' 'http://localhost:10020/api/mobile/${urlFactoryId}${path}'"`;
    return execSync(cmd, { encoding: 'utf8' }).trim();
  }
}
