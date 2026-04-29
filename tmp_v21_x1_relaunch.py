"""Relaunch X1 with proper GPU isolation via per-GPU wrapper shell scripts."""
import paramiko, sys, time
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

REFINE2 = "/root/runs/E_V2_v11l_refine2/weights/best.pt"
FINAL_CP = "/root/runs/E_V2_FINAL_cp/weights/best.pt"
RESULTS_DIR = "/root/v21_x1_results"

# (gpu, script, args)
JOBS = [
    (0, "v21_eval_multiscale.py", f"--model {REFINE2} --imgsz 960  --out {RESULTS_DIR}/ms_960.json"),
    (1, "v21_eval_multiscale.py", f"--model {REFINE2} --imgsz 1280 --out {RESULTS_DIR}/ms_1280.json"),
    (2, "v21_eval_multiscale.py", f"--model {REFINE2} --imgsz 1536 --out {RESULTS_DIR}/ms_1536.json"),
    (3, "v21_eval_multiscale.py", f"--model {REFINE2} --imgsz 1920 --out {RESULTS_DIR}/ms_1920.json"),
    (4, "v21_eval_softnms.py",    f"--model {REFINE2} --out {RESULTS_DIR}/softnms.json"),
    (5, "v21_eval_conf_scan.py",  f"--model {REFINE2} --out {RESULTS_DIR}/confscan.json"),
    (6, "v21_eval_p1_holdout.py", f"--model {REFINE2} --out {RESULTS_DIR}/p1_holdout.json"),
    (7, "v21_eval_multiscale.py", f"--model {FINAL_CP} --imgsz 1280 --out {RESULTS_DIR}/ms_1280_finalcp.json"),
]

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('180.97.68.228', port=46325, username='root', password='Cretas2026!', timeout=15)

def run(cmd, timeout=30):
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    return stdout.read().decode('utf-8', errors='replace').strip()

# Step 1: kill all v21_eval + clean GPU
print("=== Killing existing v21_eval procs ===")
print(run("pkill -9 -f v21_eval ; sleep 3 ; ps -ef | grep v21_eval | grep -v grep || echo CLEAN"))
time.sleep(10)
print(run('nvidia-smi --query-gpu=index,utilization.gpu,memory.used --format=csv,noheader'))

# Step 2: keep already completed result JSONs (ms_960, ms_1536 survivors, p1_holdout)
print("\n=== Existing results (keep valid, redo broken) ===")
print(run(f"ls {RESULTS_DIR}/"))

# Step 3: write per-GPU wrapper shell scripts with EXPORT env var
print("\n=== Writing per-GPU wrappers ===")
sftp = ssh.open_sftp()
for gpu, script, args_str in JOBS:
    wrapper = f'''#!/bin/bash
export CUDA_VISIBLE_DEVICES={gpu}
export PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
cd /root
exec python3 /root/{script} {args_str}
'''
    path = f"/root/v21_launch_gpu{gpu}.sh"
    with sftp.file(path, "w") as f:
        f.write(wrapper)
sftp.close()
run("chmod +x /root/v21_launch_gpu*.sh")
print("8 wrapper scripts written.")

# Step 4: launch via wrapper (setsid bash /root/v21_launch_gpuN.sh)
print("\n=== Launching 8 jobs ===")
for gpu, script, args_str in JOBS:
    logfile = f"/root/v21_x1_gpu{gpu}.log"
    cmd = f"setsid bash /root/v21_launch_gpu{gpu}.sh > {logfile} 2>&1 < /dev/null &"
    ssh.exec_command(cmd, timeout=10)
    print(f"  GPU {gpu}: launched")

time.sleep(60)

# Step 5: verify each on distinct GPU
print("\n=== Per-GPU compute apps (should be 8 distinct GPUs) ===")
print(run('nvidia-smi --query-compute-apps=gpu_uuid,pid,used_memory --format=csv,noheader'))
print()
print('=== GPU util ===')
print(run('nvidia-smi --query-gpu=index,utilization.gpu,memory.used --format=csv,noheader'))
print()
print('=== Procs ===')
print(run('ps -ef | grep v21_eval | grep -v grep | wc -l'))

ssh.close()
