import paramiko, sys, re
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('180.97.68.228', port=46325, username='root', password='Cretas2026!', timeout=15)

def run(cmd):
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=15)
    return stdout.read().decode('utf-8', errors='replace').strip()

RUN = "/root/runs/V22_real"
LOG = "/root/v22_train.log"

epochs_done = int(run(f"grep -c '^[0-9]' {RUN}/results.csv 2>/dev/null || echo 0"))
raw = run(f"tail -c 2000 {LOG}")
latest = ''
for line in raw.replace('\r', '\n').split('\n'):
    if '/5' in line and 'it/s' in line:
        clean = re.sub(r'\x1b\[[0-9;]*m', '', line.strip())
        if clean: latest = clean

procs = int(run("ps aux | grep 'yolo train\\|torch.distributed' | grep -v grep | wc -l"))
last_map50 = run(f"tail -1 {RUN}/results.csv 2>/dev/null | awk -F, '{{if(NF>10 && $1+0>0) printf \"%.4f\", $8}}'")
gpu_utils = run("nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits")
utils = [int(u) for u in gpu_utils.replace(',', '\n').split('\n') if u.strip().isdigit()]
gpu_avg = sum(utils)/len(utils) if utils else 0
ssh.close()

if epochs_done >= 5:
    print(f"FINISHED: V22 5/5 done! Final mAP50 = {last_map50}")
elif procs == 0:
    print(f"ALERT: 0 procs, only {epochs_done}/5. Crashed!")
else:
    ep_m = re.search(r'(\d+)/5\s+[\d.]+G', latest) if latest else None
    cur_ep = int(ep_m.group(1)) if ep_m else 0
    it_m = re.search(r'(\d+)/(\d+)\s+[\d.]+it/s', latest) if latest else None
    if it_m:
        ci, ti = int(it_m.group(1)), int(it_m.group(2))
        ep_pct = ci * 100 / ti
        ov_pct = (cur_ep - 1 + ci/ti) * 100 / 5 if cur_ep > 0 else 0
    else:
        ep_pct = 0
        ov_pct = cur_ep * 100 / 5
    m_str = f"{last_map50}" if last_map50 else 'pending'
    print(f"V22 Epoch {cur_ep}/5 ({ep_pct:.0f}% of epoch, {ov_pct:.1f}% overall), last mAP50={m_str}, GPU avg={gpu_avg:.0f}%, procs={procs}")
    if latest:
        its_m = re.search(r'([\d.]+)it/s', latest)
        its = its_m.group(1) if its_m else '?'
        print(f"Current: {latest[:80]}... @ {its}it/s")
    print("Baseline V2.1 = 0.7083. Aim: V2.2 >0.71 on ULTRA val + P1 holdout improvement.")
