# tmp_v21_x1_launch.py
import paramiko, sys, time, os
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

def _read(p):
    return open(p, 'r', encoding='utf-8').read() if os.path.exists(p) else None

REMOTE_SCRIPTS = {
    "v21_eval_multiscale.py": _read("v21_eval_multiscale.py"),
    "v21_eval_softnms.py": _read("v21_eval_softnms.py"),
    "v21_eval_conf_scan.py": _read("v21_eval_conf_scan.py"),
    "v21_eval_p1_holdout.py": _read("v21_eval_p1_holdout.py"),
}

REFINE2 = "/root/runs/E_V2_v11l_refine2/weights/best.pt"
FINAL_CP = "/root/runs/E_V2_FINAL_cp/weights/best.pt"
RESULTS_DIR = "/root/v21_x1_results"

JOBS = [
    # GPU 0-3: multi-scale TTA at different imgsz
    (0, "v21_eval_multiscale.py", f"--model {REFINE2} --imgsz 960  --out {RESULTS_DIR}/ms_960.json"),
    (1, "v21_eval_multiscale.py", f"--model {REFINE2} --imgsz 1280 --out {RESULTS_DIR}/ms_1280.json"),
    (2, "v21_eval_multiscale.py", f"--model {REFINE2} --imgsz 1536 --out {RESULTS_DIR}/ms_1536.json"),
    (3, "v21_eval_multiscale.py", f"--model {REFINE2} --imgsz 1920 --out {RESULTS_DIR}/ms_1920.json"),
    # GPU 4: IoU / soft-nms proxy
    (4, "v21_eval_softnms.py",    f"--model {REFINE2} --out {RESULTS_DIR}/softnms.json"),
    # GPU 5: per-class conf F1 scan
    (5, "v21_eval_conf_scan.py",  f"--model {REFINE2} --out {RESULTS_DIR}/confscan.json"),
    # GPU 6: P1 holdout
    (6, "v21_eval_p1_holdout.py", f"--model {REFINE2} --out {RESULTS_DIR}/p1_holdout.json"),
    # GPU 7: final_cp reference (same as GPU 1 eval but other model)
    (7, "v21_eval_multiscale.py", f"--model {FINAL_CP} --imgsz 1280 --out {RESULTS_DIR}/ms_1280_finalcp.json"),
]

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('180.97.68.228', port=46325, username='root', password='Cretas2026!', timeout=15)

# Upload scripts
sftp = ssh.open_sftp()
for fname, content in REMOTE_SCRIPTS.items():
    if content is None:
        print(f"ERROR: {fname} not in local dir")
        sys.exit(1)
    with sftp.file(f"/root/{fname}", "w") as f:
        f.write(content)
sftp.close()
ssh.exec_command("chmod +x /root/v21_eval_*.py", timeout=10)
ssh.exec_command(f"mkdir -p {RESULTS_DIR}", timeout=10)
print(f"Uploaded {len(REMOTE_SCRIPTS)} scripts.")

# Launch each job as detached process
for gpu, script, args_str in JOBS:
    logfile = f"/root/v21_x1_gpu{gpu}.log"
    cmd = (f"cd /root && CUDA_VISIBLE_DEVICES={gpu} setsid python3 /root/{script} {args_str} "
           f"> {logfile} 2>&1 < /dev/null &")
    ssh.exec_command(cmd, timeout=10)
    print(f"Launched GPU {gpu}: {script}")

time.sleep(45)

print("\n=== Proc check after 45s ===")
stdin, stdout, stderr = ssh.exec_command("ps -ef | grep v21_eval | grep -v grep | wc -l", timeout=10)
n = int(stdout.read().decode().strip() or 0)
print(f"Active eval procs: {n}")

stdin, stdout, stderr = ssh.exec_command("nvidia-smi --query-gpu=index,utilization.gpu,memory.used --format=csv,noheader", timeout=10)
print(stdout.read().decode())

ssh.close()
print("\n8 parallel X1 evals running. Run tmp_v21_x1_aggregate.py in ~15 min.")
