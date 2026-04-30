#!/bin/bash
# Regenerate Python gRPC stub from embedding.proto.
#
# Run this whenever backend/java/embedding-service/.../embedding.proto changes.
# Output stubs land in backend/python/grpc_stubs/embedding/ and are imported by
# backend/python/ai/embedding.py for the Phase 2B-α stage 5 SEMANTIC matcher.
#
# Requires: grpcio-tools (declared in backend/python/requirements.txt as a
#           BUILD-time dep). On dev machines, ensure your Python venv has it:
#               python -m pip install grpcio-tools
#
# Output:
#   backend/python/grpc_stubs/__init__.py
#   backend/python/grpc_stubs/embedding/__init__.py
#   backend/python/grpc_stubs/embedding/embedding_pb2.py
#   backend/python/grpc_stubs/embedding/embedding_pb2_grpc.py

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROTO_DIR="$REPO_ROOT/backend/java/embedding-service/src/main/proto"
OUT_DIR="$REPO_ROOT/backend/python/grpc_stubs/embedding"
PARENT_INIT="$REPO_ROOT/backend/python/grpc_stubs/__init__.py"

PYTHON_BIN="${PYTHON_BIN:-python}"

if [[ ! -d "$PROTO_DIR" ]]; then
    echo "ERROR: proto dir not found: $PROTO_DIR" >&2
    exit 1
fi

if [[ ! -f "$PROTO_DIR/embedding.proto" ]]; then
    echo "ERROR: embedding.proto not found in $PROTO_DIR" >&2
    exit 1
fi

mkdir -p "$OUT_DIR"
touch "$PARENT_INIT"
touch "$OUT_DIR/__init__.py"

cd "$REPO_ROOT/backend/python"
"$PYTHON_BIN" -m grpc_tools.protoc \
    -I="$PROTO_DIR" \
    --python_out="grpc_stubs/embedding" \
    --grpc_python_out="grpc_stubs/embedding" \
    embedding.proto

# Fix relative import in generated _pb2_grpc.py: protoc emits an absolute
# `import embedding_pb2 as embedding__pb2` which won't resolve when the file
# lives in a package. Convert to relative: `from . import embedding_pb2 ...`.
GRPC_FILE="grpc_stubs/embedding/embedding_pb2_grpc.py"
if grep -q '^import embedding_pb2 as embedding__pb2$' "$GRPC_FILE"; then
    sed -i 's/^import embedding_pb2 as embedding__pb2$/from . import embedding_pb2 as embedding__pb2/' "$GRPC_FILE"
    echo "Fixed relative import in $GRPC_FILE"
fi

echo "Regenerated stubs in $OUT_DIR"
