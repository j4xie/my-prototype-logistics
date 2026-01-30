#!/bin/bash
# Embedding Service Startup Script

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
JAR_FILE="$SCRIPT_DIR/embedding-service-1.0.0.jar"
LOG_FILE="$SCRIPT_DIR/embedding-service.log"
# v13.0: Use original ONNX model (fine-tuned model requires conversion to ONNX)
# Fine-tuned model: /www/wwwroot/cretas/models/gte-base-zh-finetuned-contrastive (safetensors, not ONNX compatible)
MODEL_PATH="/www/wwwroot/cretas/models/gte-base-zh"

# Check if already running
PID=$(pgrep -f "embedding-service.*jar")
if [ -n "$PID" ]; then
    echo "Embedding service already running (PID: $PID)"
    exit 0
fi

# Start the service
nohup java -jar -Xmx512M "$JAR_FILE" \
    --grpc.server.port=9090 \
    --embedding.model-path="$MODEL_PATH" \
    > "$LOG_FILE" 2>&1 &

echo "Embedding service started (PID: $!)"
