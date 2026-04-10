// tests/canvas-v3/lib/ssh-client.mjs
import { execSync } from 'child_process';

const SERVER = 'root@47.100.235.168';
const PG_ENV = 'PGPASSWORD=cretas123';
const PG_CMD = 'psql -h localhost -U cretas_user -d cretas_prod_db';

export function sshQuery(sql) {
  // Use -A for unaligned output, -t for tuples only
  const escaped = sql.replace(/"/g, '\\"');
  const cmd = `ssh ${SERVER} "${PG_ENV} ${PG_CMD} -t -A -c \\"${escaped}\\""`;
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

export function sshExec(command) {
  return execSync(`ssh ${SERVER} "${command}"`, { encoding: 'utf8' });
}

export function sshLogGrep(pattern) {
  try {
    // Logback rolling files at /www/wwwroot/cretas/logs/cretas-backend.log (business logs)
    // and cretas-prod*.log (startup only). Search both locations to cover Blue-Green.
    return execSync(
      `ssh ${SERVER} "grep -h '${pattern}' /www/wwwroot/cretas/logs/cretas-backend.log /www/wwwroot/cretas/cretas-prod.log /www/wwwroot/cretas/cretas-prod-green.log 2>/dev/null | tail -20"`,
      { encoding: 'utf8' }
    ).trim();
  } catch (e) {
    return '';
  }
}
