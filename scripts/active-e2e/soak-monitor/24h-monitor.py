#!/usr/bin/env python3
"""scripts/active-e2e/soak-monitor/24h-monitor.py

Active E2E framework — automated soak monitor.

Replaces ad-hoc `tail journalctl | grep` patterns documented in the T6.5 Phase B
prod cutover audit (`docs/qa-audits/2026-05-09-t6-5-phase-b-prod-deploy-cutover.md`
§5). Runs as a long-lived process, polls a remote service over SSH at a fixed
cadence, accumulates hour-bucket metrics into NDJSON, emits checkpoint summaries
at T+1h / T+6h / T+24h (configurable), and prints stderr alerts when a
threshold is breached.

Per HARD rule `feedback_active_e2e_replaces_passive_soak.md` (2026-05-09): in a
0-customer-traffic state passive soak windows produce no signal. This monitor
exists for the *defensive* leg only — it confirms there is no F999 regression
and no SMARTBI_MIGRATED hits coming from non-F999 factories. Customer-perspective
signal still has to come from the active E2E suite (`record-batch.sh` /
`replay-and-compare.py` / `playwright/flows/*`).

Output schema (NDJSON, one event per line):

  {"event":"start","phase":<str>,"start_ts":<iso>,"end_ts":<iso>,...}
  {"event":"hour_bucket","phase":<str>,"hour":<int>,"window_start":<iso>,
   "window_end":<iso>,"metrics":{
     "smartbi_migrated_hits":<int>,
     "smartbi_migrated_by_factory":{"F999":12,...},
     "error_lines":<int>,"exception_lines":<int>,"http_5xx":<int>,
     "noresource_lines":<int>,"sample_lines":[<up to 5 redacted snippets>]}}
  {"event":"checkpoint","phase":<str>,"checkpoint":"T+Nh","window":<int hours>,
   "rollup":{<sum metrics>},"verdict":"GREEN|YELLOW|RED",
   "verdict_reasons":[<str>]}
  {"event":"alert","phase":<str>,"level":"warn|crit","reason":<str>,
   "ts":<iso>,"hour":<int>,"metrics":{...}}
  {"event":"end","phase":<str>,"final_verdict":<str>,...}

Usage:
  # Foreground (will run for full duration — ~24h default)
  python3 24h-monitor.py --phase t6-5-phase-b \
      --duration-hours 24 \
      --output ./out/soak/t6-5-phase-b-$(date +%Y%m%d_%H%M).ndjson

  # Self-validation (one bucket against current Phase B prod, then exit)
  python3 24h-monitor.py --phase test-validate --dry-run

The dry-run runs ONE one-minute lookback bucket and exits — safe to invoke
against live prod (no state changes; only `journalctl` reads).

Dependencies: stdlib only (subprocess + ssh client). Designed to be cron-friendly
via `start-monitor.sh` wrapper (nohup + NDJSON tail).
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

CST = timezone(timedelta(hours=8))


# --- Patterns we look for in journalctl output -------------------------------
#
# These patterns match the audit doc §5 monitor plan + the markers Phase B
# stubs emit. Any match counts as one "event" for the metric. Regex is matched
# per line (journalctl is line-oriented).
PATTERNS: dict[str, re.Pattern[str]] = {
    "smartbi_migrated_hits": re.compile(r"SMARTBI_MIGRATED", re.IGNORECASE),
    "error_lines": re.compile(r"\bERROR\b"),
    "exception_lines": re.compile(r"Exception(?!\w)", re.IGNORECASE),
    # Java stack-trace 5xx surrogate: "HTTP 5xx" or "status=5xx" or naked 500/502/503/504
    "http_5xx": re.compile(r"\b(5\d\d)\b.*?(error|status|HTTP)|status=5\d\d|HTTP\s+5\d\d", re.IGNORECASE),
    "noresource_lines": re.compile(r"NoResourceFoundException"),
}

# Pull factoryId out of stub-410 log lines (Phase B controller logs include
# the factoryId path-segment in the request URI).
FACTORY_RE = re.compile(r"/api/mobile/([A-Z0-9_]+)/")


@dataclass
class BucketMetrics:
    smartbi_migrated_hits: int = 0
    smartbi_migrated_by_factory: dict[str, int] = field(default_factory=dict)
    error_lines: int = 0
    exception_lines: int = 0
    http_5xx: int = 0
    noresource_lines: int = 0
    sample_lines: list[str] = field(default_factory=list)
    raw_line_count: int = 0

    def add_line(self, line: str) -> None:
        self.raw_line_count += 1
        # Track per-factory SMARTBI_MIGRATED hits (key audit signal — must
        # only come from F999 internal traffic per Phase B GO criteria).
        if PATTERNS["smartbi_migrated_hits"].search(line):
            self.smartbi_migrated_hits += 1
            m = FACTORY_RE.search(line)
            factory = m.group(1) if m else "UNKNOWN"
            self.smartbi_migrated_by_factory[factory] = (
                self.smartbi_migrated_by_factory.get(factory, 0) + 1
            )
        if PATTERNS["error_lines"].search(line):
            self.error_lines += 1
        if PATTERNS["exception_lines"].search(line):
            self.exception_lines += 1
        if PATTERNS["http_5xx"].search(line):
            self.http_5xx += 1
        if PATTERNS["noresource_lines"].search(line):
            self.noresource_lines += 1
        # Keep up to 5 sample lines (truncated to 240 chars) so checkpoints
        # have evidence when a verdict flips YELLOW / RED.
        if (
            len(self.sample_lines) < 5
            and any(p.search(line) for p in PATTERNS.values())
        ):
            self.sample_lines.append(line[:240])

    def to_dict(self) -> dict[str, Any]:
        return {
            "smartbi_migrated_hits": self.smartbi_migrated_hits,
            "smartbi_migrated_by_factory": dict(self.smartbi_migrated_by_factory),
            "error_lines": self.error_lines,
            "exception_lines": self.exception_lines,
            "http_5xx": self.http_5xx,
            "noresource_lines": self.noresource_lines,
            "sample_lines": list(self.sample_lines),
            "raw_line_count": self.raw_line_count,
        }


def now_cst() -> datetime:
    return datetime.now(tz=CST)


def iso(dt: datetime) -> str:
    return dt.isoformat(timespec="seconds")


def ssh_journalctl(
    ssh_target: str,
    services: list[str],
    since: datetime,
    until: datetime,
    timeout_sec: int = 60,
) -> str:
    """Run `journalctl -u <svc> --since=<ts> --until=<ts>` over SSH.

    Returns stdout as a single string (lines newline-separated). Raises
    subprocess.CalledProcessError if SSH itself fails — let the caller decide
    whether to keep going (typically yes; transient SSH blips should not abort
    the soak).
    """
    unit_args = []
    for svc in services:
        unit_args.extend(["-u", svc])
    cmd = [
        "ssh",
        "-o", "BatchMode=yes",
        "-o", "ConnectTimeout=10",
        "-o", "ServerAliveInterval=15",
        ssh_target,
        "journalctl",
        *unit_args,
        f"--since={since.strftime('%Y-%m-%d %H:%M:%S')}",
        f"--until={until.strftime('%Y-%m-%d %H:%M:%S')}",
        "--no-pager",
        "-o", "short-iso",
    ]
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=timeout_sec,
        check=True,
    )
    return result.stdout


def collect_bucket(
    ssh_target: str,
    services: list[str],
    window_start: datetime,
    window_end: datetime,
) -> BucketMetrics:
    metrics = BucketMetrics()
    try:
        stdout = ssh_journalctl(ssh_target, services, window_start, window_end)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
        # Soft fail: emit a fake "alert" line so the bucket records the gap.
        metrics.sample_lines.append(f"[MONITOR_SSH_FAIL] {type(e).__name__}: {e}")
        return metrics
    for line in stdout.splitlines():
        if line.strip():
            metrics.add_line(line)
    return metrics


def evaluate_verdict(
    rollup: BucketMetrics,
    elapsed_hours: float,
    args: argparse.Namespace,
) -> tuple[str, list[str]]:
    """Return (verdict, reasons).

    Verdict ladder (per audit §5.3 rollback triggers):
      - GREEN: 0 non-F999 SMARTBI_MIGRATED, http_5xx rate within budget
      - YELLOW: thresholds approaching, but no rollback trigger yet
      - RED: rollback trigger hit (non-F999 410 OR 5xx > 1%/hr OR NoResource > 0)
    """
    reasons: list[str] = []
    non_f999 = {
        f: c
        for f, c in rollup.smartbi_migrated_by_factory.items()
        if f != "F999"
    }
    if non_f999:
        reasons.append(
            f"non-F999 SMARTBI_MIGRATED hits: {non_f999} "
            "— nginx route miss or direct-IP bypass, investigate before rollback"
        )
    if rollup.noresource_lines > 0:
        reasons.append(
            f"NoResourceFoundException count={rollup.noresource_lines} "
            "(post-Apr-11 SG tightening should have eliminated these)"
        )
    # Convert to per-hour rate so thresholds stay comparable across windows.
    hours = max(elapsed_hours, 1e-3)
    err_rate = rollup.http_5xx / hours
    if err_rate > args.alert_5xx_per_hour:
        reasons.append(
            f"5xx rate {err_rate:.1f}/hr > threshold {args.alert_5xx_per_hour}/hr"
        )

    if reasons:
        return ("RED", reasons)
    # YELLOW band: noise that's not yet a rollback trigger
    if rollup.error_lines / hours > args.alert_error_per_hour:
        return (
            "YELLOW",
            [
                f"error log volume {rollup.error_lines / hours:.0f}/hr > "
                f"warn {args.alert_error_per_hour}/hr (no rollback, but investigate)"
            ],
        )
    return ("GREEN", [])


def write_event(out_fh, event: dict[str, Any]) -> None:
    out_fh.write(json.dumps(event, ensure_ascii=False) + "\n")
    out_fh.flush()


def merge_into(rollup: BucketMetrics, bucket: BucketMetrics) -> None:
    rollup.smartbi_migrated_hits += bucket.smartbi_migrated_hits
    for f, c in bucket.smartbi_migrated_by_factory.items():
        rollup.smartbi_migrated_by_factory[f] = (
            rollup.smartbi_migrated_by_factory.get(f, 0) + c
        )
    rollup.error_lines += bucket.error_lines
    rollup.exception_lines += bucket.exception_lines
    rollup.http_5xx += bucket.http_5xx
    rollup.noresource_lines += bucket.noresource_lines
    rollup.raw_line_count += bucket.raw_line_count
    # Keep sample_lines length capped overall
    for s in bucket.sample_lines:
        if len(rollup.sample_lines) < 20:
            rollup.sample_lines.append(s)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    p.add_argument("--phase", required=True,
                   help="Phase identifier (e.g. t6-5-phase-b). Goes into NDJSON + filename.")
    p.add_argument("--start-ts", default=None,
                   help="Start time (ISO 8601). Default: now CST. "
                        "Use to backdate when starting monitor mid-soak.")
    p.add_argument("--duration-hours", type=float, default=24.0,
                   help="Total soak duration in hours (default 24).")
    p.add_argument("--interval-seconds", type=int, default=3600,
                   help="Bucket cadence in seconds (default 3600 = hourly).")
    p.add_argument("--ssh-target", default="root@47.100.235.168",
                   help="SSH target for journalctl reads (default root@47.100.235.168).")
    p.add_argument("--services", default="cretas-backend,cretas-backend-green",
                   help="Comma-separated systemd unit names to tail.")
    p.add_argument("--checkpoints", default="1,6,24",
                   help="Comma-separated hour offsets for rollup summaries (default 1,6,24).")
    p.add_argument("--alert-5xx-per-hour", type=float, default=10.0,
                   help="WARN/RED threshold: 5xx log lines per hour rolling (default 10).")
    p.add_argument("--alert-error-per-hour", type=float, default=200.0,
                   help="YELLOW threshold: ERROR log lines per hour rolling (default 200).")
    p.add_argument("--output", default=None,
                   help="NDJSON output path. Default: ./out/soak/<phase>-<ts>.ndjson")
    p.add_argument("--dry-run", action="store_true",
                   help="Run ONE 1-minute lookback bucket and exit. Self-validation mode.")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    services = [s.strip() for s in args.services.split(",") if s.strip()]
    checkpoints = sorted(int(c.strip()) for c in args.checkpoints.split(",") if c.strip())

    if args.start_ts:
        start_ts = datetime.fromisoformat(args.start_ts).astimezone(CST)
    else:
        start_ts = now_cst()
    end_ts = start_ts + timedelta(hours=args.duration_hours)

    out_path = Path(
        args.output
        or f"./out/soak/{args.phase}-{start_ts.strftime('%Y%m%d_%H%M%S')}.ndjson"
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)

    rollup = BucketMetrics()

    with out_path.open("w", encoding="utf-8") as fh:
        write_event(fh, {
            "event": "start",
            "phase": args.phase,
            "start_ts": iso(start_ts),
            "end_ts": iso(end_ts),
            "duration_hours": args.duration_hours,
            "interval_seconds": args.interval_seconds,
            "ssh_target": args.ssh_target,
            "services": services,
            "checkpoints": checkpoints,
            "alert_thresholds": {
                "5xx_per_hour": args.alert_5xx_per_hour,
                "error_per_hour": args.alert_error_per_hour,
            },
            "dry_run": args.dry_run,
        })
        sys.stderr.write(
            f"[soak-monitor] phase={args.phase} start={iso(start_ts)} "
            f"end={iso(end_ts)} interval={args.interval_seconds}s "
            f"output={out_path}\n"
        )

        if args.dry_run:
            window_end = now_cst()
            window_start = window_end - timedelta(minutes=1)
            sys.stderr.write(
                f"[soak-monitor] DRY-RUN: querying {iso(window_start)} → "
                f"{iso(window_end)} (1 min lookback)\n"
            )
            bucket = collect_bucket(args.ssh_target, services, window_start, window_end)
            write_event(fh, {
                "event": "hour_bucket",
                "phase": args.phase,
                "hour": 0,
                "window_start": iso(window_start),
                "window_end": iso(window_end),
                "metrics": bucket.to_dict(),
            })
            verdict, reasons = evaluate_verdict(bucket, 1.0 / 60, args)
            write_event(fh, {
                "event": "end",
                "phase": args.phase,
                "final_verdict": verdict,
                "verdict_reasons": reasons,
                "rollup": bucket.to_dict(),
                "dry_run": True,
            })
            sys.stderr.write(
                f"[soak-monitor] DRY-RUN done. verdict={verdict} "
                f"raw_lines={bucket.raw_line_count}\n"
            )
            return 0

        # Hour-bucket loop
        hour = 0
        while True:
            window_start = start_ts + timedelta(seconds=args.interval_seconds * hour)
            window_end = window_start + timedelta(seconds=args.interval_seconds)
            if window_end > end_ts:
                window_end = end_ts

            # Sleep until window_end (hour boundary), then query the just-closed window.
            now = now_cst()
            wait_sec = (window_end - now).total_seconds()
            if wait_sec > 0:
                time.sleep(wait_sec)

            bucket = collect_bucket(args.ssh_target, services, window_start, window_end)
            hour += 1
            write_event(fh, {
                "event": "hour_bucket",
                "phase": args.phase,
                "hour": hour,
                "window_start": iso(window_start),
                "window_end": iso(window_end),
                "metrics": bucket.to_dict(),
            })
            merge_into(rollup, bucket)

            # Per-bucket alert (transient spike)
            v, reasons = evaluate_verdict(bucket, 1.0, args)
            if v == "RED":
                write_event(fh, {
                    "event": "alert",
                    "phase": args.phase,
                    "level": "crit",
                    "reason": "; ".join(reasons),
                    "ts": iso(now_cst()),
                    "hour": hour,
                    "metrics": bucket.to_dict(),
                })
                sys.stderr.write(
                    f"[soak-monitor] ALERT crit @hour={hour}: {'; '.join(reasons)}\n"
                )

            if hour in checkpoints:
                v, reasons = evaluate_verdict(rollup, float(hour), args)
                write_event(fh, {
                    "event": "checkpoint",
                    "phase": args.phase,
                    "checkpoint": f"T+{hour}h",
                    "window_hours": hour,
                    "rollup": rollup.to_dict(),
                    "verdict": v,
                    "verdict_reasons": reasons,
                })
                sys.stderr.write(
                    f"[soak-monitor] CHECKPOINT T+{hour}h verdict={v} "
                    f"smartbi_hits={rollup.smartbi_migrated_hits} "
                    f"5xx={rollup.http_5xx} errors={rollup.error_lines}\n"
                )

            if window_end >= end_ts:
                break

        # Final
        v, reasons = evaluate_verdict(rollup, args.duration_hours, args)
        write_event(fh, {
            "event": "end",
            "phase": args.phase,
            "final_verdict": v,
            "verdict_reasons": reasons,
            "rollup": rollup.to_dict(),
        })
        sys.stderr.write(
            f"[soak-monitor] DONE phase={args.phase} verdict={v}\n"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
