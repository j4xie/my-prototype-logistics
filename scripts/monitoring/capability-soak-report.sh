#!/bin/bash
# capability-soak-report.sh — 24h aggregation of capability-watch.sh log lines.
#
# Replaces manual "24h soak" verification (spec §7 Day 12). The 15-min cron is
# the soak; this script summarizes overnight runs into a single daily verdict.
#
# Run from cron daily (e.g. 09:00) AFTER overnight observation. Or one-shot:
#   ssh root@47.100.235.168 'bash /www/wwwroot/cretas/capability-soak-report.sh'
#
# Cron line:
#   0 9 * * * /www/wwwroot/cretas/capability-soak-report.sh >> /var/log/capability-soak.log 2>&1
#
# Format:
#   [TS] DAILY-SUMMARY runs=N pass=N% alert=N% lat_avg=Xms lat_p95=Xms worst="..."
#   [TS] DAILY-VERDICT pass|warn|fail (≥99% PASS = pass, 95-99% = warn, <95% = fail)
#
# v1.0 (Apr 26 2026, Phase 4.5)

set -uo pipefail

LOG_FILE="${LOG_FILE:-/var/log/capability-watch.log}"
WINDOW_HOURS="${WINDOW_HOURS:-24}"
TS="$(date '+%Y-%m-%dT%H:%M:%S')"

if [ ! -f "$LOG_FILE" ]; then
    echo "[$TS] DAILY-SUMMARY ERROR log file not found: $LOG_FILE"
    exit 2
fi

# Cutoff = now - WINDOW_HOURS (in seconds since epoch)
NOW_EPOCH=$(date +%s)
CUTOFF_EPOCH=$((NOW_EPOCH - WINDOW_HOURS * 3600))

# Filter lines newer than cutoff. capability-watch emits ISO timestamps in [].
RECENT=$(awk -v cutoff="$CUTOFF_EPOCH" '
    {
        # Parse [YYYY-MM-DDTHH:MM:SS] from line start
        if (match($0, /^\[([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})\]/, m)) {
            cmd = sprintf("date -d \"%s-%s-%sT%s:%s:%s\" +%%s", m[1], m[2], m[3], m[4], m[5], m[6])
            cmd | getline epoch
            close(cmd)
            if (epoch >= cutoff) print $0
        }
    }
' "$LOG_FILE")

TOTAL=$(echo "$RECENT" | grep -c . || true)
TOTAL="${TOTAL:-0}"

if [ "$TOTAL" -eq 0 ]; then
    echo "[$TS] DAILY-SUMMARY runs=0 (no log lines in last ${WINDOW_HOURS}h, cron may not be installed?)"
    echo "[$TS] DAILY-VERDICT skip"
    exit 0
fi

PASS=$(echo "$RECENT" | grep -c " OK " || true)
PASS="${PASS:-0}"
ALERT=$((TOTAL - PASS))
PASS_PCT=$((PASS * 100 / TOTAL))
ALERT_PCT=$((ALERT * 100 / TOTAL))

# Extract latency values (lat=Xms format)
LATENCIES=$(echo "$RECENT" | grep -oE "lat=[0-9]+ms" | grep -oE "[0-9]+" || true)
LAT_AVG=0
LAT_P95=0
WORST_LINE=""
if [ -n "$LATENCIES" ]; then
    # Avg
    LAT_AVG=$(echo "$LATENCIES" | awk '{sum+=$1; n++} END {if(n>0) printf "%.0f", sum/n; else print 0}')
    # p95 (sort + index)
    LAT_P95=$(echo "$LATENCIES" | sort -n | awk -v p=0.95 '
        {a[NR]=$1}
        END {
            if (NR == 0) print 0
            else {
                idx = int(NR * p)
                if (idx < 1) idx = 1
                print a[idx]
            }
        }
    ')
    # Worst line (highest lat=)
    WORST_LAT=$(echo "$LATENCIES" | sort -n | tail -1)
    WORST_LINE=$(echo "$RECENT" | grep "lat=${WORST_LAT}ms" | head -1 | sed "s/^\[[^]]*\] //;s/ errs=.*$//")
fi

# Verdict
if [ "$PASS_PCT" -ge 99 ]; then
    VERDICT="pass"
elif [ "$PASS_PCT" -ge 95 ]; then
    VERDICT="warn"
else
    VERDICT="fail"
fi

echo "[$TS] DAILY-SUMMARY runs=$TOTAL pass=${PASS_PCT}% alert=${ALERT_PCT}% lat_avg=${LAT_AVG}ms lat_p95=${LAT_P95}ms worst=\"$WORST_LINE\""
echo "[$TS] DAILY-VERDICT $VERDICT (threshold: pass≥99% / warn≥95% / fail<95%)"

# Show first 3 ALERT lines for context (if any)
if [ "$ALERT" -gt 0 ]; then
    echo "[$TS] DAILY-SUMMARY first 3 ALERT lines:"
    echo "$RECENT" | grep " ALERT " | head -3 | sed "s/^/  /"
fi

# Exit code: 0 = pass/warn (don't break cron), 1 = fail (alert via cron mailer)
[ "$VERDICT" = "fail" ] && exit 1 || exit 0
