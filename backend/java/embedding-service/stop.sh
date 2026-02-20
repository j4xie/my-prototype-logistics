#!/bin/bash
# Embedding Service Stop Script

PID=$(pgrep -f "embedding-service.*jar")
if [ -n "$PID" ]; then
    kill $PID
    echo "Embedding service stopped (PID: $PID)"
else
    echo "Embedding service not running"
fi
